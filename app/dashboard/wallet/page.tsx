"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";

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
      setUser(u);
      if (!u) return;

      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", u.id)
        .maybeSingle();

      setBalance(wallet?.balance ?? 0);

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
      <div className="flex items-center justify-center min-h-screen">
        Loading Wallet…
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="page-title mb-4">Wallet</h1>

      <div className="card mb-6">
        <h2 className="text-xl font-semibold mb-2">Current Balance</h2>
        <div className="text-3xl font-bold text-primary">₹{balance}</div>

        <Link
          href="/dashboard/wallet/add-money"
          className="block w-full mt-4 btn-primary text-center"
        >
          Add Money
        </Link>
      </div>

      <h2 className="text-xl font-semibold mb-3">Transaction History</h2>

      {transactions.length === 0 && (
        <p className="text-gray-600">No transactions yet.</p>
      )}

      <div className="space-y-3">
        {transactions.map((t) => (
          <div
            key={t.id}
            className="p-4 bg-white rounded-xl shadow flex justify-between"
          >
            <div>
              <div className="font-medium">{t.type}</div>
              <div className="text-sm text-gray-500">
                {new Date(t.created_at).toLocaleString()}
              </div>
            </div>
            <div
              className={`font-bold ${
                t.amount > 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {t.amount > 0 ? "+" : ""}
              ₹{t.amount}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
