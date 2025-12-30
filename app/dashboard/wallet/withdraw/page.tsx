"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet, Loader2, IndianRupee, Send } from "lucide-react";

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
    const loadData = async () => {
      try {
        // 1. Get User
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
            router.push("/login");
            return;
        }
        setUser(data.user);

        // 2. Get Wallet Balance
        const { data: wallet, error } = await supabase
          .from("wallets")
          .select("balance")
          .eq("user_id", data.user.id)
          .single();

        if (error) throw error;
        setBalance(wallet?.balance ?? 0);
      } catch (err) {
        console.error("Error loading wallet:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase, router]);

  const submitRequest = async () => {
    setError("");
    const amt = Number(amount);
    
    if (!amt || amt < 50) return setError("Minimum withdrawal is ₹50");
    if (amt > balance) return setError("Insufficient wallet balance");
    if (!upi.includes("@")) return setError("Invalid UPI ID (must contain '@')");

    setSubmitting(true);

    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          amount: amt,
          upi,
        }),
      });

      const out = await res.json();

      if (!out.success) {
        throw new Error(out.error || "Request failed");
      }

      alert("Withdrawal request submitted successfully!");
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-brand-purple" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-purple/10 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand-blue/10 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Back Button */}
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 w-fit group"
        >
          <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="font-medium">Back to Dashboard</span>
        </Link>

        {/* Main Card */}
        <div className="bg-[#121217] border border-white/10 rounded-[32px] p-8 shadow-2xl">
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-brand-purple/20 flex items-center justify-center text-brand-purple">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Withdraw Funds</h1>
              <p className="text-white/40 text-sm">Transfer money to your bank</p>
            </div>
          </div>

          {/* Balance Display */}
          <div className="bg-[#0B0B11] border border-white/10 rounded-2xl p-6 mb-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-brand-purple/5"></div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Available Balance</p>
            <h2 className="text-4xl font-black text-white relative z-10 flex items-center justify-center gap-1">
              <span className="text-2xl text-white/50">₹</span>{balance}
            </h2>
          </div>

          {/* Form */}
          <div className="space-y-4">
            
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-2 ml-1">Amount</label>
              <div className="relative">
                <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#1A1A24] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white focus:border-brand-purple outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-white/40 uppercase mb-2 ml-1">UPI ID</label>
              <input
                type="text"
                placeholder="example@okaxis"
                value={upi}
                onChange={(e) => setUpi(e.target.value)}
                className="w-full bg-[#1A1A24] border border-white/10 rounded-xl py-4 px-4 text-white focus:border-brand-purple outline-none transition-colors"
              />
            </div>

            <button
              onClick={submitRequest}
              disabled={submitting}
              className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Confirm Withdraw <Send className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-white/30 mt-4">
              Transfers are processed within 24 hours.
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}