"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Loader2, Lock } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { friendlyError } from "@/lib/errors";
import { SERVICES, SERVICE_BY_KEY, quoteFor, isServiceKey, AGENCY_FEE_AUDIENCE } from "@/lib/agency";
import { platformFeeFor } from "@/lib/fees";

/**
 * What an outreach member is owed, and what each sale is worth to them.
 *
 * THIS PAGE EXISTS BECAUSE THE ATTRIBUTION CHAIN DOES NOT WORK BY ITSELF.
 * The obvious route — outreach_leads.converted_company_id -> companies ->
 * gigs.company_id — cannot answer "which lead earned this", because the end
 * client never transacts on DoItForMe. Almmatix sells to them off-platform, so
 * every gig's company_id is Almmatix. The commission is its own gig, and
 * outreach_commissions records the link. Without that row this page would have
 * nothing to compute from, which is why the table exists at all.
 *
 * NET IS THE HEADLINE NUMBER, GROSS IS THE FOOTNOTE. A member told "15,000"
 * who receives 13,500 has been misled however correct the arithmetic was, and
 * the first payout is the one conversation that sets whether they trust the
 * rest. The platform fee is shown, not hidden and not omitted.
 *
 * Reads go through the browser client against RLS: outreach_commissions is
 * readable only where earner_id = auth.uid() or is_admin(), so there is no
 * authorization a route could add. Deliberately NOT team-readable — the shared
 * pipeline argument that makes outreach_leads visible to the whole team does
 * not extend to anybody's pay.
 */

type Row = {
  id: string;
  tranche: "first" | "final";
  amount: number;
  gig_id: string | null;
  created_at: string;
  note: string | null;
  lead?: { company_name?: string | null; service_key?: string | null; won_value?: number | null } | null;
  gig?: { id?: string; status?: string | null; payment_status?: string | null } | null;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

const TRANCHE_LABEL: Record<Row["tranche"], string> = {
  first: "40% · client paid",
  final: "60% · work accepted",
};

/**
 * The state of a tranche IS the state of its gig. Derived rather than stored,
 * for the reason CLAUDE.md gives: a second state machine beside the money is
 * the one that goes stale, and it is always the one the UI reads.
 */
function stateOf(row: Row): { label: string; tone: "wait" | "live" | "done" } {
  if (!row.gig_id) return { label: "Not raised yet", tone: "wait" };
  const pay = String(row.gig?.payment_status ?? "").toUpperCase();
  const status = String(row.gig?.status ?? "").toLowerCase();
  if (status === "completed" || pay === "PAYOUT_PENDING" || pay === "RELEASED") {
    return { label: "Released to you", tone: "done" };
  }
  if (pay === "HELD" || pay === "ESCROW_FUNDED") return { label: "In escrow", tone: "live" };
  return { label: "Raised", tone: "live" };
}

const TONE: Record<"wait" | "live" | "done", string> = {
  wait: "border-[var(--w-line-strong)] bg-[var(--w-page)] text-[var(--w-muted)]",
  live: "border-[var(--w-violet)]/30 bg-[var(--w-violet-soft)] text-[var(--w-ink-strong)]",
  done: "border-[var(--w-line-strong)] bg-[var(--w-surface)] text-[var(--w-ink-strong)]",
};

export default function EarningsPage() {
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setLoading(false);

      const { data: profile } = await supabase
        .from("users")
        .select("is_elite, inner_circle_role")
        .eq("id", user.id)
        .maybeSingle();

      const ok = Boolean(profile?.is_elite) && profile?.inner_circle_role === "OUTREACH";
      setAllowed(ok);
      if (!ok) return setLoading(false);

      const { data, error: err } = await supabase
        .from("outreach_commissions")
        .select(
          "id, tranche, amount, gig_id, created_at, note, " +
            "lead:lead_id(company_name, service_key, won_value), " +
            "gig:gig_id(id, status, payment_status)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (err) throw err;
      setRows((data as unknown as Row[]) || []);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Net is derived, not stored — storing it would be a second opinion about a
  // number lib/fees.ts already owns, and the rate is a business dial that moves.
  const totals = useMemo(() => {
    const net = (gross: number) => gross - platformFeeFor(gross, AGENCY_FEE_AUDIENCE);
    let released = 0;
    let pending = 0;
    for (const r of rows) {
      const s = stateOf(r);
      if (s.tone === "done") released += net(r.amount);
      else pending += net(r.amount);
    }
    return { released, pending, all: released + pending };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--w-faint)]" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <Lock className="mx-auto h-6 w-6 text-[var(--w-faint)]" />
        <h1 className="mt-4 text-[20px] font-bold text-[var(--w-ink-strong)]">Outreach only</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--w-muted)]">
          This page shows outreach commissions. If you are on the build side, your briefs are
          under My briefs.
        </p>
        <Link
          href="/inner-circle"
          className="mt-6 inline-flex min-h-[44px] items-center rounded-[var(--w-r-md)] border border-[var(--w-line-strong)] px-4 text-[14px] font-bold text-[var(--w-ink-strong)]"
        >
          Back to the Inner Circle
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8 pb-24 sm:px-6">
      <Link
        href="/inner-circle/outreach"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--w-muted)] transition-colors hover:text-[var(--w-ink-strong)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Pipeline
      </Link>

      <h1 className="mt-4 text-[27px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--w-ink-strong)] sm:text-[31px]">
        What you have earned
      </h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-[var(--w-muted)]">
        You earn 10% of every project a client you found goes on to buy, paid in two parts. Every
        figure below is what reaches your bank, after the platform fee.
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Paid out to you", value: totals.released },
          { label: "On the way", value: totals.pending },
          { label: "Earned in total", value: totals.all },
        ].map((t) => (
          <div
            key={t.label}
            className="rounded-[var(--w-r-md)] border border-[var(--w-line-strong)] bg-[var(--w-surface)] p-4"
          >
            <p className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[var(--w-faint)]">
              {t.label}
            </p>
            <p className="mt-1.5 text-[23px] font-bold tabular-nums tracking-[-0.02em] text-[var(--w-ink-strong)]">
              {inr(t.value)}
            </p>
          </div>
        ))}
      </div>

      {error && <p className="mt-5 text-[13.5px] font-semibold text-[var(--w-orange)]">{error}</p>}

      <section className="mt-10">
        <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--w-ink-strong)]">
          Deal by deal
        </h2>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-[var(--w-r-lg)] border border-dashed border-[var(--w-line-strong)] p-8 text-center">
            <Banknote className="mx-auto h-5 w-5 text-[var(--w-faint)]" />
            <p className="mt-3 text-[14.5px] font-bold text-[var(--w-ink-strong)]">
              Nothing here yet.
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-[var(--w-muted)]">
              A commission appears the moment a lead you own is marked won. Until then the
              pipeline is where the work is.
            </p>
            <Link
              href="/inner-circle/outreach"
              className="mt-5 inline-flex min-h-[44px] items-center rounded-[var(--w-r-md)] bg-[var(--w-violet)] px-4 text-[14px] font-bold text-white"
            >
              Open the pipeline
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((r) => {
              const s = stateOf(r);
              const fee = platformFeeFor(r.amount, AGENCY_FEE_AUDIENCE);
              const svcKey = r.lead?.service_key;
              const svc = isServiceKey(svcKey) ? SERVICE_BY_KEY[svcKey] : null;
              return (
                <li
                  key={r.id}
                  className="rounded-[var(--w-r-md)] border border-[var(--w-line-strong)] bg-[var(--w-surface)] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-[var(--w-ink-strong)]">
                        {r.lead?.company_name ?? "A client you found"}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--w-muted)]">
                        {svc ? svc.name : "Project"}
                        {r.lead?.won_value ? ` · deal ${inr(r.lead.won_value)}` : ""} ·{" "}
                        {TRANCHE_LABEL[r.tranche]}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[19px] font-bold tabular-nums tracking-[-0.01em] text-[var(--w-ink-strong)]">
                        {inr(r.amount - fee)}
                      </p>
                      <p className="text-[12px] tabular-nums text-[var(--w-faint)]">
                        {inr(r.amount)} less {inr(fee)} fee
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-bold ${TONE[s.tone]}`}
                    >
                      {s.label}
                    </span>
                    {r.gig_id && (
                      <Link
                        href={`/gig/${r.gig_id}`}
                        className="text-[12.5px] font-bold text-[var(--w-violet)] hover:underline"
                      >
                        Open the payment
                      </Link>
                    )}
                  </div>
                  {r.note && (
                    <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--w-muted)]">{r.note}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* What each sale is worth, so nobody has to ask. */}
      <section className="mt-12">
        <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--w-ink-strong)]">
          What each sale pays you
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--w-muted)]">
          Your commission is 10% of the deal, less the platform fee. These are the list prices —
          a bigger scope pays proportionally more.
        </p>
        <div className="mt-4 overflow-hidden rounded-[var(--w-r-md)] border border-[var(--w-line-strong)]">
          <table className="w-full text-left">
            <thead className="bg-[var(--w-page)]">
              <tr>
                <th className="px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--w-faint)]">
                  Service
                </th>
                <th className="px-4 py-2.5 text-right text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--w-faint)]">
                  Deal
                </th>
                <th className="px-4 py-2.5 text-right text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--w-faint)]">
                  You get
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--w-line)]">
              {SERVICES.map((s) => {
                const q = quoteFor(s);
                return (
                  <tr key={s.key}>
                    <td className="px-4 py-3">
                      <p className="text-[14px] font-bold text-[var(--w-ink-strong)]">{s.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-[var(--w-muted)]">{s.pitch}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[14px] tabular-nums text-[var(--w-ink)]">
                      {inr(s.price)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-[14px] font-bold tabular-nums text-[var(--w-ink-strong)]">
                      {inr(q.outreach.net)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
