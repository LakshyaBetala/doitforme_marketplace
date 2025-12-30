"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function AddMoneyPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    })();
  }, []);

  const startPayment = async () => {
    const amt = Number(amount);
    if (!amt || amt < 10) {
      alert("Minimum amount is ₹10");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/wallet/add-money", {
      method: "POST",
      body: JSON.stringify({
        amount: amt,
        userId: user.id,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      alert("Failed to create order");
      setLoading(false);
      return;
    }

    // Minimal Razorpay integration — existing code expects global Razorpay
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      amount: data.amount,
      currency: "INR",
      name: "DoItForMe Wallet",
      order_id: data.orderId,
      handler: async function (response: any) {
        await fetch("/api/wallet/verify", {
          method: "POST",
          body: JSON.stringify({
            userId: user.id,
            amount: amt,
            orderId: data.orderId,
            razorpayPaymentId: response.razorpay_payment_id,
          }),
        });

        router.push("/dashboard/wallet");
      },
    };

    //@ts-ignore
    const rzp = new window.Razorpay(options);
    rzp.open();

    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="page-title mb-4">Add Money</h1>

      <input
        type="number"
        className="w-full p-3 border rounded mb-4"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Enter amount (₹)"
      />

      <button
        onClick={startPayment}
        disabled={loading}
        className="w-full btn-primary"
      >
        {loading ? "Processing..." : "Add Money"}
      </button>
    </div>
  );
}
