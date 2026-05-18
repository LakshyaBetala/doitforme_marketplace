// Server-to-server payment notification from Cashfree.
// Verifies the HMAC signature, then runs the same idempotent escrow-funding
// path as /api/payments/verify-payment so closed-tab payments still settle.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySignature(rawBody: string, timestamp: string, providedB64: string): boolean {
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!secret || !timestamp || !providedB64) return false;
  const expected = createHmac("sha256", secret)
    .update(timestamp + rawBody)
    .digest("base64");
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(providedB64, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-webhook-timestamp") || "";
  const signature = req.headers.get("x-webhook-signature") || "";

  // 1. Authenticate Cashfree itself.
  if (!verifySignature(rawBody, timestamp, signature)) {
    console.error("[cashfree-webhook] bad signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const type: string = payload?.type || "";
  const orderId: string | undefined = payload?.data?.order?.order_id;
  const paymentStatus: string | undefined = payload?.data?.payment?.payment_status;
  const cfPaymentId: string | undefined = payload?.data?.payment?.cf_payment_id;
  const orderTags = payload?.data?.order?.order_tags || {};
  const gigId: string | undefined = orderTags.gig_id;
  const workerId: string | undefined = orderTags.worker_id;
  const tagType: string = orderTags.type || "";

  if (!orderId) {
    return NextResponse.json({ ok: true, skipped: "no order_id" });
  }

  // 2. We only care about successful PAYMENT_SUCCESS events.
  if (type !== "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus !== "SUCCESS") {
    return NextResponse.json({ ok: true, skipped: `type=${type} status=${paymentStatus}` });
  }

  // 3. Branch on order type so we settle the right thing.
  if (tagType === "COMPANY_PRO") {
    return handleCompanyPro(orderId, cfPaymentId, orderTags);
  }

  if (!gigId || !workerId) {
    return NextResponse.json({ ok: true, skipped: "missing gig/worker tags" });
  }

  return handleGigEscrow(orderId, gigId, workerId, cfPaymentId);
}

async function handleGigEscrow(
  orderId: string,
  gigId: string,
  workerId: string,
  cfPaymentId?: string
) {
  // Fetch the PENDING transaction created at order-creation time.
  const { data: txn } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("gateway_order_id", orderId)
    .single();

  if (!txn) {
    console.error(`[cashfree-webhook] no txn for order ${orderId}`);
    return NextResponse.json({ ok: true, skipped: "no txn" });
  }
  if (txn.status === "COMPLETED") {
    return NextResponse.json({ ok: true, skipped: "already completed" });
  }

  const breakdown = txn.provider_data?.breakdown || {};
  const basePrice = Number(breakdown.base_price || 0);
  const deposit = Number(breakdown.deposit || 0);
  const platformFee = Number(breakdown.platform_fee || 0);
  const gatewayFee = Number(breakdown.gateway_fee || 0);
  const amountHeld = basePrice + deposit;

  await supabaseAdmin
    .from("transactions")
    .update({ status: "COMPLETED", gateway_payment_id: cfPaymentId || null })
    .eq("id", txn.id);

  const { data: gig } = await supabaseAdmin
    .from("gigs")
    .select("title, poster_id, status, max_workers")
    .eq("id", gigId)
    .single();
  if (!gig) return NextResponse.json({ ok: true, skipped: "no gig" });

  if (gig.status === "assigned") {
    return NextResponse.json({ ok: true, skipped: "gig already assigned" });
  }

  const handshakeCode = Math.floor(1000 + Math.random() * 9000).toString();

  await supabaseAdmin.from("escrow").upsert(
    {
      gig_id: gigId,
      poster_id: gig.poster_id,
      worker_id: workerId,
      original_amount: basePrice,
      platform_fee: platformFee,
      gateway_fee: gatewayFee,
      amount_held: amountHeld,
      status: "HELD",
      release_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      handshake_code: handshakeCode,
      escrow_category: deposit > 0 ? "RENTAL_DEPOSIT" : "GIG",
    },
    { onConflict: "gig_id,worker_id" }
  );

  await supabaseAdmin
    .from("applications")
    .update({ status: "accepted" })
    .eq("gig_id", gigId)
    .eq("worker_id", workerId);

  const { count: acceptedCountRaw } = await supabaseAdmin
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("gig_id", gigId)
    .eq("status", "accepted");
  const acceptedCount = acceptedCountRaw || 1;
  const isFull = acceptedCount >= (gig.max_workers || 1);

  const { data: allEscrows } = await supabaseAdmin
    .from("escrow")
    .select("amount_held, platform_fee, gateway_fee, original_amount")
    .eq("gig_id", gigId);

  let totalAmountHeld = 0,
    totalPlatformFee = 0,
    totalGatewayFee = 0,
    totalOriginalAmount = 0;
  for (const e of allEscrows || []) {
    totalAmountHeld += Number(e.amount_held || 0);
    totalPlatformFee += Number(e.platform_fee || 0);
    totalGatewayFee += Number(e.gateway_fee || 0);
    totalOriginalAmount += Number(e.original_amount || 0);
  }

  const gigUpdate: any = {
    assigned_worker_id: workerId,
    payment_status: "ESCROW_FUNDED",
    escrow_status: "HELD",
    escrow_amount: totalAmountHeld,
    escrow_locked_at: new Date().toISOString(),
    platform_fee: totalPlatformFee,
    net_worker_pay: totalOriginalAmount - totalPlatformFee,
    gateway_fee: totalGatewayFee,
  };
  if (isFull) {
    gigUpdate.status = "assigned";
    await supabaseAdmin
      .from("applications")
      .update({ status: "rejected" })
      .eq("gig_id", gigId)
      .eq("status", "applied");
  }
  await supabaseAdmin.from("gigs").update(gigUpdate).eq("id", gigId);

  return NextResponse.json({ ok: true, settled: orderId });
}

async function handleCompanyPro(orderId: string, cfPaymentId: string | undefined, tags: any) {
  const userId: string | undefined = tags.user_id;
  if (!userId) return NextResponse.json({ ok: true, skipped: "no user_id" });

  const { data: txn } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("gateway_order_id", orderId)
    .single();
  if (!txn || txn.status === "COMPLETED") {
    return NextResponse.json({ ok: true, skipped: "already processed or missing" });
  }

  await supabaseAdmin
    .from("transactions")
    .update({ status: "COMPLETED", gateway_payment_id: cfPaymentId || null })
    .eq("id", txn.id);

  const proUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("companies")
    .update({ pro_until: proUntil })
    .eq("user_id", userId);

  return NextResponse.json({ ok: true, pro_until: proUntil });
}
