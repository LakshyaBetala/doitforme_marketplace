// Server-to-server payment notification from Cashfree.
// Verifies the HMAC signature, then runs the same idempotent escrow-funding
// path as /api/payments/verify-payment so closed-tab payments still settle.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { settleGigEscrow, settleCompanyPro } from "@/lib/paymentSettlement";

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

// GET → simple health/liveness response so the URL doesn't 405 in a browser.
// Cashfree only sends POSTs; the real work is below.
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "cashfree-webhook",
    method: "POST",
    message: "Endpoint operational. Cashfree posts JSON here with HMAC signature.",
  });
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

  // 1b. Replay window. The signature covers the timestamp, so a captured payload
  // stays valid forever without this. Idempotency limits the blast radius but
  // does not stop an old event being replayed against a re-created order.
  // Cashfree sends epoch seconds; 5 minutes is generous for their retries.
  const REPLAY_WINDOW_SECONDS = 300;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > REPLAY_WINDOW_SECONDS) {
    console.error(`[cashfree-webhook] stale or invalid timestamp: ${timestamp}`);
    return NextResponse.json({ error: "Stale webhook" }, { status: 401 });
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
    return NextResponse.json(await settleCompanyPro(orderId, cfPaymentId, orderTags));
  }

  if (!gigId || !workerId) {
    return NextResponse.json({ ok: true, skipped: "missing gig/worker tags" });
  }

  // Amount paid, straight from the signed payload. Escrow must never be funded
  // for more than the payer actually paid — a partial/underpaid order would
  // otherwise mark the gig fully funded.
  const paidAmount = Number(payload?.data?.payment?.payment_amount);

  return NextResponse.json(await settleGigEscrow(orderId, gigId, workerId, cfPaymentId, paidAmount));
}

