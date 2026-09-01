// Which gateway is live.
//
// Cashfree onboarding stalled on the marketplace declaration, so Razorpay is
// now the default. Cashfree is kept whole rather than ripped out: if its
// approval lands, set PAYMENT_PROVIDER=CASHFREE and the old path is live again
// with no code change.
//
// Falls back to whichever provider actually has credentials, so a missing env
// var degrades to "use the other one" instead of a runtime crash at checkout.

export type PaymentProvider = "RAZORPAY" | "CASHFREE";

export function activeProvider(): PaymentProvider {
  const want = String(process.env.PAYMENT_PROVIDER || "").toUpperCase();
  const hasRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const hasCashfree = Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);

  if (want === "CASHFREE" && hasCashfree) return "CASHFREE";
  if (want === "RAZORPAY" && hasRazorpay) return "RAZORPAY";
  if (hasRazorpay) return "RAZORPAY";
  return "CASHFREE";
}
