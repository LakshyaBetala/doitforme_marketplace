// Razorpay Orders + signature verification.
//
// Native fetch rather than the `razorpay` SDK, matching how the Cashfree path
// talks to its gateway — one less runtime dependency in the serverless bundle,
// and identical error handling.
//
// Env:
//   RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET      server-side only
//   NEXT_PUBLIC_RAZORPAY_KEY_ID                the same key id, safe to expose
//
// The secret NEVER leaves the server: it signs and verifies here only.

import crypto from "crypto";

const API = "https://api.razorpay.com/v1";

export function razorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const raw = `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

/** Razorpay is in test mode when the key id carries the rzp_test_ prefix. */
export function razorpayIsTestMode(): boolean {
  return String(process.env.RAZORPAY_KEY_ID || "").startsWith("rzp_test_");
}

export interface RazorpayOrder {
  id: string;
  amount: number;      // paise
  currency: string;
  receipt: string | null;
  status: string;
}

/**
 * Create an order. `amountRupees` is converted to paise here so no caller has
 * to remember the unit — passing rupees to Razorpay would undercharge by 100x.
 */
export async function createRazorpayOrder(args: {
  amountRupees: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const paise = Math.round(Number(args.amountRupees) * 100);
  if (!Number.isFinite(paise) || paise < 100) {
    throw new Error("Amount must be at least ₹1.");
  }

  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authHeader() },
    body: JSON.stringify({
      amount: paise,
      currency: "INR",
      // Razorpay caps receipt at 40 chars and rejects longer ones outright.
      receipt: args.receipt.slice(0, 40),
      notes: args.notes || {},
      payment_capture: 1,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.description || "Payment initiation failed at gateway";
    if (res.status === 401) throw new Error("Payment gateway rejected our credentials.");
    throw new Error(msg);
  }
  return data as RazorpayOrder;
}

/**
 * HMAC-SHA256(order_id|payment_id, key_secret), compared in constant time.
 *
 * A plain === on the hex strings leaks timing; timingSafeEqual does not. It
 * throws on length mismatch, hence the length guard first.
 */
export function verifyRazorpaySignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !args.orderId || !args.paymentId || !args.signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${args.orderId}|${args.paymentId}`)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(args.signature), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;      // created | authorized | captured | refunded | failed
  amount: number;      // paise
  method?: string;
  error_description?: string | null;
}

/**
 * Re-read the payment from Razorpay. The signature proves the callback was not
 * forged; only this proves the money was actually captured, so settlement must
 * gate on both.
 */
export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || "Could not verify payment with gateway");
  return data as RazorpayPayment;
}

/** Webhook signature: HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyRazorpayWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
