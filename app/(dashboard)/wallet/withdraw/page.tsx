"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function WithdrawPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [user, setUser] = useState<any | null>(null);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      const { data: wallet } = await supabase
        .from("wallets")
        .select("balance, frozen_amount")
        .eq("user_id", data.user.id)
        .single();

      setBalance(wallet?.balance ?? 0);
      setLoading(false);
    })();
  }, []);

  const submitRequest = async () => {
    setError("");
    const amt = Number(amount);
    if (!amt || amt < 50) return setError("Minimum withdrawal is ₹50");
    if (amt > balance) return setError("Amount exceeds wallet balance");
    if (!upi.includes("@")) return setError("Invalid UPI ID");

    setSubmitting(true);

    const res = await fetch("/api/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({
        userId: user.id,
        amount: amt,
        upi,
      }),
    });

    const out = await res.json();

    if (!out.success) {
      setSubmitting(false);
      return setError(out.error || "Request failed");
    }

    router.push("/dashboard/wallet");
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading Wallet…
      </div>
    );

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Withdraw Money</h1>

      <p className="mb-4 text-lg">Available Balance: ₹{balance}</p>

      {error && <p className="text-red-600 mb-3">{error}</p>}

      <input
        type="number"
        className="w-full p-3 border rounded mb-3"
        placeholder="Amount to withdraw"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <input
        type="text"
        className="w-full p-3 border rounded mb-4"
        placeholder="Your UPI ID (example@upi)"
        value={upi}
        onChange={(e) => setUpi(e.target.value)}
      />

      <button
        onClick={submitRequest}
        disabled={submitting}
        className="w-full bg-purple-600 text-white p-3 rounded-lg"
      >
        {submitting ? "Submitting..." : "Submit Withdrawal Request"}
      </button>
    </div>
  );
}
