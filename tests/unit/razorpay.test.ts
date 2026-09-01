import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  verifyRazorpaySignature,
  verifyRazorpayWebhook,
  razorpayConfigured,
  razorpayIsTestMode,
} from "../../lib/razorpay";

// lib/razorpay reads these inside each function rather than at module load, so
// assigning them here (before any test body runs) is enough.
process.env.RAZORPAY_KEY_SECRET = "test_secret_do_not_use";
process.env.RAZORPAY_KEY_ID = "rzp_test_dummy";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";

const sign = (data: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(data).digest("hex");

test("a genuine checkout signature is accepted", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";
  const signature = sign(`${orderId}|${paymentId}`, "test_secret_do_not_use");
  assert.equal(verifyRazorpaySignature({ orderId, paymentId, signature }), true);
});

test("a tampered signature is rejected", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";
  const good = sign(`${orderId}|${paymentId}`, "test_secret_do_not_use");
  const bad = good.slice(0, -1) + (good.slice(-1) === "a" ? "b" : "a");
  assert.equal(verifyRazorpaySignature({ orderId, paymentId, signature: bad }), false);
});

test("a signature for a DIFFERENT order is rejected", () => {
  // The attack this actually stops: replaying a real payment against another
  // order id to fund somebody else's escrow.
  const signature = sign(`order_OTHER|pay_XYZ789`, "test_secret_do_not_use");
  assert.equal(
    verifyRazorpaySignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature }),
    false
  );
});

test("a signature made with the wrong secret is rejected", () => {
  const signature = sign(`order_ABC123|pay_XYZ789`, "attacker_secret");
  assert.equal(
    verifyRazorpaySignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature }),
    false
  );
});

test("missing fields are rejected rather than throwing", () => {
  assert.equal(verifyRazorpaySignature({ orderId: "", paymentId: "p", signature: "s" }), false);
  assert.equal(verifyRazorpaySignature({ orderId: "o", paymentId: "", signature: "s" }), false);
  assert.equal(verifyRazorpaySignature({ orderId: "o", paymentId: "p", signature: "" }), false);
  // A length mismatch must not throw out of timingSafeEqual.
  assert.equal(verifyRazorpaySignature({ orderId: "o", paymentId: "p", signature: "short" }), false);
});

test("webhook signature is verified over the raw body", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: {} });
  assert.equal(verifyRazorpayWebhook(body, sign(body, "test_webhook_secret")), true);
  assert.equal(verifyRazorpayWebhook(body, sign(body, "wrong_secret")), false);
  assert.equal(verifyRazorpayWebhook(body + " ", sign(body, "test_webhook_secret")), false);
  assert.equal(verifyRazorpayWebhook(body, ""), false);
});

test("configuration helpers reflect the environment", () => {
  assert.equal(razorpayConfigured(), true);
  assert.equal(razorpayIsTestMode(), true);
});
