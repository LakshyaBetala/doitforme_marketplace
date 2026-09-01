// Server-to-server payment notification from Razorpay.
//
// This is what makes payment robust rather than best-effort: the browser
// callback in lib/razorpayCheckout.ts only fires if the tab survives. If the
// user closes it, loses signal, or the confirm request fails, this webhook is
// the path that still funds escrow. Both run the same settlement in
// lib/paymentSettlement.ts and both are idempotent, so whichever arrives first
// wins and the other is a no-op.
//
// Setup (manual, in the Razorpay dashboard → Settings → Webhooks):
//   URL     https://doitforme.in/api/webhooks/razorpay
//   Events  payment.captured, payment.failed
//   Secret  → RAZORPAY_WEBHOOK_SECRET

import { NextResponse } from "next/server";
import { verifyRazorpayWebhook } from "@/lib/razorpay";
import { settleGigEscrow, settleCompanyPro } from "@/lib/paymentSettlement";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET → liveness, so the URL doesn't 405 when opened in a browser.
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "razorpay-webhook",
    method: "POST",
    configured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET),
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature") || "";

  // Fail closed. Without the secret configured we cannot tell a real Razorpay
  // event from a forged one, and this endpoint funds escrow — so refuse rather
  // than trust an unverified payload.
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    console.error("[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET is not set — refusing to settle");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  if (!verifyRazorpayWebhook(rawBody, signature)) {
    console.error("[razorpay-webhook] bad signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }

  const event: string = payload?.event || "";
  const payment = payload?.payload?.payment?.entity;

  if (!payment) {
    return NextResponse.json({ ok: true, skipped: `no payment entity (event=${event})` });
  }

  const orderId: string | undefined = payment.order_id;
  if (!orderId) return NextResponse.json({ ok: true, skipped: "no order_id" });

  // A failed payment leaves a PENDING transaction that would otherwise sit
  // there forever, making the queue unreadable and hiding real stuck orders.
  // Mark it FAILED — never touch a row that already settled.
  if (event === "payment.failed" || payment.status === "failed") {
    // `transactions` has no failure column, so the reason rides along in
    // provider_data — read first so the existing breakdown is not clobbered.
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id, provider_data")
      .eq("gateway_order_id", orderId)
      .eq("status", "PENDING")
      .maybeSingle();

    if (!existing) return NextResponse.json({ ok: true, skipped: "no pending txn" });

    await supabaseAdmin
      .from("transactions")
      .update({
        status: "FAILED",
        gateway_payment_id: payment.id || null,
        provider_data: {
          ...(existing.provider_data || {}),
          failure_reason: payment.error_description || payment.error_reason || "Payment failed",
          failed_at: new Date().toISOString(),
        },
      })
      .eq("id", existing.id)
      .eq("status", "PENDING");

    return NextResponse.json({ ok: true, failed: orderId });
  }

  // Only a captured payment means money actually moved. `authorized` is a hold
  // that can still fail, and settling on it would fund escrow for nothing.
  if (event !== "payment.captured" || payment.status !== "captured") {
    return NextResponse.json({ ok: true, skipped: `event=${event} status=${payment.status}` });
  }

  // Notes are set server-side at order creation, so they are as trustworthy as
  // the signed payload carrying them.
  const notes = payment.notes || {};
  const paidAmount = Number(payment.amount) / 100; // paise → rupees

  if (notes.type === "COMPANY_PRO") {
    return NextResponse.json(await settleCompanyPro(orderId, payment.id, notes));
  }

  const gigId: string | undefined = notes.gig_id;
  const workerId: string | undefined = notes.worker_id;
  if (!gigId || !workerId) {
    return NextResponse.json({ ok: true, skipped: "missing gig/worker notes" });
  }

  return NextResponse.json(
    await settleGigEscrow(orderId, gigId, workerId, payment.id, paidAmount)
  );
}
