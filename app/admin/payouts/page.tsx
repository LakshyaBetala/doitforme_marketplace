"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Copy, Check, AlertTriangle, RefreshCw, Smartphone } from "lucide-react";

/**
 * Payout console.
 *
 * Every payouts provider withholds the product from unregistered/proprietorship
 * businesses, so transfers cannot be fully automated until doitforme is a
 * registered entity. Everything except the final tap IS automated: the queue
 * decides who is owed what, to which validated UPI, and this screen turns each
 * row into a single prefilled UPI intent. Nothing is retyped, which removes the
 * only step where a payout can go to the wrong person.
 *
 * Open this on a phone with a UPI app installed — the pay button is a
 * `upi://` intent that desktop browsers cannot handle.
 */

type Row = {
  id: string;
  worker_id: string;
  gig_id: string;
  amount: number;
  upi_id: string;
  status: string;
  created_at: string;
  worker_name: string;
  gig_title: string;
  upi_valid: boolean;
  upi_warning: string | null;
};

/** Prefilled UPI intent — opens GPay/PhonePe/Paytm with everything filled in. */
function upiLink(row: Row) {
  const p = new URLSearchParams({
    pa: row.upi_id,
    pn: row.worker_name,
    am: Number(row.amount).toFixed(2),
    cu: "INR",
    tn: `doitforme payout ${row.gig_id.slice(0, 8)}`,
  });
  return `upi://pay?${p.toString()}`;
}

export default function AdminPayoutsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payouts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.items || []);
      setTotalPending(data.totalPending || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load payouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: "PAID" | "FAILED" | "RETRY") => {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(action === "PAID" ? "Marked paid — worker notified" : "Updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const copy = async (row: Row) => {
    await navigator.clipboard.writeText(row.upi_id);
    setCopied(row.id);
    setTimeout(() => setCopied(null), 1500);
  };

  const pending = rows.filter((r) => r.status === "PENDING");
  const attention = rows.filter((r) => r.status !== "PENDING");

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-white">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors px-3 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08]"
          >
            <ChevronLeft size={18} />
            <span className="text-xs font-semibold">Admin</span>
          </Link>
          <button
            onClick={load}
            aria-label="Refresh payouts"
            className="inline-flex items-center gap-2 px-3 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 hover:text-white transition-colors text-xs font-semibold"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <h1
          className="text-3xl md:text-4xl font-semibold tracking-tight mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
        >
          Payouts
        </h1>
        <p className="text-sm text-white/60 mb-6 leading-relaxed">
          {pending.length} pending ·{" "}
          <span className="text-white font-semibold tabular-nums">₹{totalPending.toLocaleString("en-IN")}</span> owed.
          Open this on your phone and tap Pay — the UPI app opens prefilled.
        </p>

        <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-8">
          <Smartphone size={18} className="text-[#C9A9FF] shrink-0 mt-0.5" />
          <p className="text-xs text-white/60 leading-relaxed">
            Fully automated transfers need a payouts product, which requires a registered
            business. Once that&apos;s approved and the payout credentials are set, the cron
            drains this queue on its own and this page becomes read-only.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="animate-spin text-white/40" size={28} />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-[var(--card)] border border-white/[0.08] rounded-2xl px-6 py-16 text-center">
            <p className="text-white/60 text-sm">Nothing to pay out. Everything is settled.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...pending, ...attention].map((row) => (
              <div
                key={row.id}
                className={`bg-[var(--card)] border rounded-2xl p-4 md:p-5 ${
                  row.status === "FAILED"
                    ? "border-red-500/30"
                    : row.status === "PROCESSING"
                    ? "border-amber-500/30"
                    : "border-white/[0.08]"
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[15px] truncate">{row.worker_name}</p>
                    <p className="text-xs text-white/50 truncate mt-0.5">{row.gig_title}</p>
                  </div>
                  <p className="text-xl font-semibold tabular-nums shrink-0">
                    ₹{Number(row.amount).toLocaleString("en-IN")}
                  </p>
                </div>

                <button
                  onClick={() => copy(row)}
                  className="flex items-center gap-2 text-xs text-white/70 hover:text-white font-mono bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 mb-3 w-full text-left"
                >
                  <span className="truncate flex-1">{row.upi_id}</span>
                  {copied === row.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>

                {(!row.upi_valid || row.upi_warning) && (
                  <p
                    className={`flex items-start gap-2 text-[11px] mb-3 ${
                      row.upi_valid ? "text-amber-400" : "text-red-400"
                    }`}
                  >
                    <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                    {row.upi_warning}
                  </p>
                )}

                {row.status !== "PENDING" && (
                  <p className="text-[11px] uppercase tracking-wider text-white/40 mb-3">{row.status}</p>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={upiLink(row)}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold min-h-[44px] transition ${
                      row.upi_valid
                        ? "bg-[var(--brand-purple)] hover:opacity-90 text-white"
                        : "bg-white/[0.04] text-white/30 pointer-events-none"
                    }`}
                  >
                    Pay ₹{Number(row.amount).toLocaleString("en-IN")}
                  </a>
                  <button
                    onClick={() => act(row.id, "PAID")}
                    disabled={busy === row.id}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-sm font-semibold min-h-[44px] transition disabled:opacity-50"
                  >
                    {busy === row.id ? <Loader2 size={15} className="animate-spin" /> : "Mark paid"}
                  </button>
                  {row.status === "PENDING" && (
                    <button
                      onClick={() => act(row.id, "FAILED")}
                      disabled={busy === row.id}
                      className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-red-500/10 border border-white/[0.08] text-sm font-semibold text-white/60 hover:text-red-400 min-h-[44px] transition disabled:opacity-50"
                    >
                      Hold
                    </button>
                  )}
                  {row.status !== "PENDING" && (
                    <button
                      onClick={() => act(row.id, "RETRY")}
                      disabled={busy === row.id}
                      className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-semibold text-white/60 min-h-[44px] transition disabled:opacity-50"
                    >
                      Requeue
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
