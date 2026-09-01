"use client";

// Razorpay Standard Checkout — one implementation for every call site.
//
// The three call sites (fund escrow, hire from applicants, hire from a company
// task) previously each open-coded their gateway modal, which is how the
// Cashfree paths drifted apart. This is the single place checkout lives.
//
// Nothing here decides anything about money: the server sets the amount, and
// /api/payments/verify-payment re-checks the HMAC and re-reads the payment from
// Razorpay before writing escrow. A tampered response simply fails verification.

import { toast } from "sonner";

export interface RazorpayOrderResponse {
  order_id?: string;
  orderId?: string;
  amount: number;          // paise
  currency?: string;
  key_id: string;
  gig_title?: string | null;
  prefill?: { name?: string; email?: string; contact?: string };
}

async function loadCheckoutScript(): Promise<void> {
  if (typeof (window as any).Razorpay !== "undefined") return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the payment window."));
    document.body.appendChild(s);
  });
}

export async function openRazorpayCheckout(
  data: RazorpayOrderResponse,
  opts: {
    onSuccess?: () => void;
    description?: string;
    /** Escrow funding settles at /api/payments/verify-payment; Company Pro has its own. */
    verifyUrl?: string;
  } = {}
): Promise<void> {
  await loadCheckoutScript();
  const verifyUrl = opts.verifyUrl || "/api/payments/verify-payment";

  const orderId = data.order_id || data.orderId;

  const rzp = new (window as any).Razorpay({
    key: data.key_id,
    amount: data.amount,
    currency: data.currency || "INR",
    order_id: orderId,
    name: "DoItForMe",
    description: (opts.description || data.gig_title || "Escrow funding").slice(0, 80),
    prefill: data.prefill || {},
    theme: { color: "#8825F5" },
    handler: async (resp: any) => {
      const v = toast.loading("Confirming payment…");
      try {
        const res = await fetch(verifyUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          }),
        });
        const out = await res.json();
        if (!res.ok) {
          // The money may well have been captured. Never say "failed" flatly —
          // a poster who believes it failed will pay a second time.
          toast.error(out.error || "Payment received but not yet confirmed — support will reconcile it.", {
            id: v,
            duration: 8000,
          });
          return;
        }
        toast.success("Payment confirmed. Escrow is funded.", { id: v });
        opts.onSuccess?.();
      } catch {
        toast.error("Payment taken but confirmation failed — we'll reconcile it.", { id: v, duration: 8000 });
      }
    },
    modal: {
      ondismiss: () => toast.message("Payment cancelled — nothing was charged."),
    },
  });

  rzp.on("payment.failed", (resp: any) => {
    toast.error(resp?.error?.description || "Payment failed. Nothing was charged.");
  });

  rzp.open();
}
