"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { 
  ArrowLeft, 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Loader2,
  Plus
} from "lucide-react";

export default function WalletPage() {
  const supabase = supabaseBrowser();

  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user ?? null;
      if (!mounted) return;
      
      if (!u) {
        setLoading(false);
        return;
      }
      setUser(u);

      // 1. Fetch Wallet Balance
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", u.id)
        .maybeSingle();

      setBalance(wallet?.balance ?? 0);

      // 2. Fetch Transactions
      const { data: txs } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false });

      setTransactions(txs ?? []);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (loading)
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 lg:p-12 pb-24 selection:bg-brand-purple selection:text-white">
      
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand-purple/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-blue/10 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <div>
          <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-4 group w-fit">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
            <Wallet className="w-8 h-8 text-brand-purple" /> My Wallet
          </h1>
        </div>

        {/* --- 1. BALANCE CARD --- */}
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#1A1A24] to-[#121217] p-8 md:p-10 shadow-2xl group">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-purple/10 via-transparent to-brand-blue/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/50 text-sm font-bold uppercase tracking-widest">
                <CreditCard className="w-4 h-4" /> Available Balance
              </div>
              <div className="text-6xl md:text-7xl font-black text-white tracking-tighter">
                ₹{balance.toLocaleString()}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <Link
                href="/dashboard/wallet/add-money"
                className="flex-1 sm:flex-none px-8 py-4 bg-white text-black font-bold rounded-2xl hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
              >
                <Plus className="w-5 h-5" /> Add Funds
              </Link>
              {/* If you have a withdraw page, link it here, otherwise keep button */}
              <button className="flex-1 sm:flex-none px-8 py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                Withdraw
              </button>
            </div>
          </div>
        </div>

        {/* --- 2. TRANSACTION HISTORY --- */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-brand-blue" /> Transaction History
          </h2>

          {transactions.length === 0 ? (
            <div className="text-center py-12 bg-[#121217] rounded-[24px] border border-white/10">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-white/20" />
              </div>
              <p className="text-white/40">No transactions yet.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {transactions.map((t) => {
                const isPositive = t.amount > 0;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-5 bg-[#121217] hover:bg-[#1A1A24] border border-white/5 hover:border-white/10 rounded-2xl transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
                        isPositive 
                          ? "bg-green-500/10 border-green-500/20 text-green-500" 
                          : "bg-red-500/10 border-red-500/20 text-red-500"
                      }`}>
                        {isPositive ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="font-bold text-white text-lg capitalize">
                          {t.type.replace(/_/g, " ")}
                        </div>
                        <div className="text-sm text-white/40 font-mono">
                          {new Date(t.created_at).toLocaleDateString()} • {new Date(t.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    </div>
                    
                    <div className={`text-xl font-bold font-mono ${
                      isPositive ? "text-green-400" : "text-white"
                    }`}>
                      {isPositive ? "+" : ""}₹{Math.abs(t.amount).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>  
    </div>
  );
}