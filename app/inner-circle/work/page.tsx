"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { workflowFor, workflowHeadline, type WorkflowStep } from "@/lib/innerCircle";
import { friendlyError } from "@/lib/errors";
import {
  AlertTriangle, ArrowRight, Check, Circle, Hammer, Loader2, Lock, MessageCircle,
} from "lucide-react";

/**
 * My briefs — the tech member's delivery workflow, one brief at a time.
 *
 * The steps are computed by workflowFor() in lib/innerCircle.ts from the gig row
 * itself. That is deliberate: gigs.status, gigs.payment_status and
 * gigs.managed_status are already three descriptions of the same thing, and
 * storing a fourth would give the UI a number that can disagree with the money.
 * Here the tracker cannot be wrong, because it is only a reading of the columns
 * the escrow actually depends on.
 *
 * What this page is FOR: the gap between "you are hired" and "you are paid" is
 * where students lose work and lose money — starting before escrow is funded,
 * agreeing scope in a DM, not knowing that silence from the client still pays
 * after 24 hours. None of that was stated anywhere. Each step says whose move it
 * is, which is the single most useful fact at any given moment.
 */

type Brief = {
  id: string;
  title: string;
  price: number | null;
  status: string | null;
  payment_status: string | null;
  assigned_worker_id: string | null;
  delivered_at: string | null;
  auto_release_at: string | null;
  dispute_reason: string | null;
  created_at: string;
  companies?: { name?: string | null } | null;
  paid_out?: boolean;
};

function StepRow({ step, last }: { step: WorkflowStep; last: boolean }) {
  const { state } = step;

  const dot =
    state === "done"
      ? "border-[var(--ok-solid)] bg-[var(--ok-solid)] text-white"
      : state === "blocked"
      ? "border-[var(--bad-solid)] bg-[var(--bad-solid)] text-white"
      : state === "current"
      ? "border-[var(--w-orange)] bg-[var(--w-orange)] text-[#371448]"
      : "border-[var(--w-line-strong)] bg-[var(--w-raised)] text-[var(--w-faint)]";

  const owner =
    step.owner === "you" ? "Your move" : step.owner === "client" ? "With the client" : "With us";

  return (
    <li className="flex gap-3.5">
      {/* The rail. A connector between dots reads as progress far faster than
          numbering the steps does. */}
      <div className="flex flex-col items-center">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${dot}`}
          aria-hidden
        >
          {state === "done" ? (
            <Check size={14} strokeWidth={3} />
          ) : state === "blocked" ? (
            <AlertTriangle size={13} strokeWidth={2.6} />
          ) : state === "current" ? (
            <Circle size={9} strokeWidth={5} />
          ) : (
            <Circle size={7} strokeWidth={4} />
          )}
        </span>
        {!last && (
          <span
            aria-hidden
            className={`mt-1 w-[2px] flex-1 rounded ${
              state === "done" ? "bg-[var(--ok-line)]" : "bg-[var(--w-line)]"
            }`}
          />
        )}
      </div>

      <div className={`min-w-0 pb-5 ${state === "todo" ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`text-[14.5px] ${
              state === "current" || state === "blocked"
                ? "font-extrabold text-[var(--w-ink-strong)]"
                : "font-bold text-[var(--w-ink)]"
            }`}
          >
            {step.title}
          </p>
          {(state === "current" || state === "blocked") && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${
                step.owner === "you"
                  ? "bg-[var(--w-orange-soft)] text-[var(--w-orange-ink)]"
                  : "bg-[var(--w-violet-soft)] text-[var(--w-violet)]"
              }`}
            >
              {owner}
            </span>
          )}
        </div>
        <p className="mt-1 max-w-[62ch] text-[13px] leading-[1.6] text-[var(--w-muted)]">
          {step.detail}
        </p>
      </div>
    </li>
  );
}

export default function InnerCircleWorkPage() {
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
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

      const isTech = Boolean(profile?.is_elite) && profile?.inner_circle_role === "TECH";
      setAllowed(isTech);
      if (!isTech) return setLoading(false);

      // Everything assigned to me, finished or not. The tracker is as useful as a
      // record of a completed brief as it is as a prompt on a live one.
      const { data: gigs, error: gigErr } = await supabase
        .from("gigs")
        .select(
          "id, title, price, status, payment_status, assigned_worker_id, delivered_at, auto_release_at, dispute_reason, created_at, companies:company_id(name)"
        )
        .eq("assigned_worker_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (gigErr) throw gigErr;

      // Paid-ness lives in payout_queue, not on the gig, so the last step cannot
      // be derived from the gig alone.
      const { data: payouts } = await supabase
        .from("payout_queue")
        .select("gig_id, status")
        .eq("worker_id", user.id);
      const paidGigs = new Set(
        (payouts || [])
          .filter((p: any) => String(p.status).toLowerCase() === "completed")
          .map((p: any) => p.gig_id)
      );

      const rows = ((gigs as any[]) || []).map((g) => ({ ...g, paid_out: paidGigs.has(g.id) }));
      setBriefs(rows);
      // Open the one that needs them, not just the newest.
      const needsYou = rows.find((g) => {
        const h = workflowHeadline(workflowFor(g));
        return h && (h.state === "blocked" || (h.state === "current" && h.owner === "you"));
      });
      setOpenId((needsYou ?? rows[0])?.id ?? null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[var(--w-violet)]" />
      </div>
    );
  }

  // The nav only shows this page to TECH members, but a nav is a convenience and
  // not a boundary — somebody will arrive here by URL.
  if (!allowed) {
    return (
      <div className="max-w-[56ch] rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-7">
        <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-[var(--chip)] text-[var(--w-muted)]">
          <Lock size={18} />
        </span>
        <h1
          className="mt-3.5 text-[22px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
          style={{ fontFamily: "var(--font-display), sans-serif" }}
        >
          This is for Inner Circle builders
        </h1>
        <p className="mt-2 text-[14px] leading-[1.65] text-[var(--w-muted)]">
          Company briefs are handed out here. You can ask to join — a person reads every
          application.
        </p>
        <Link
          href="/inner-circle"
          className="mt-5 inline-flex min-h-[46px] items-center gap-2 rounded-[11px] bg-[var(--w-orange)] px-5 text-[14.5px] font-bold text-[#371448] hover:opacity-90"
        >
          About the Inner Circle <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <p className="text-[13px] font-bold text-[var(--w-faint)]">THE INNER CIRCLE</p>
      <h1
        className="mt-1.5 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--w-ink-strong)] sm:text-[34px]"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        My briefs
      </h1>
      <p className="mt-2 max-w-[62ch] text-[14.5px] leading-[1.6] text-[var(--w-muted)]">
        Every brief you have been put forward for, and exactly where it has got to. If a step says
        it is your move, it is.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-[13.5px] text-[var(--bad)]">
          {error}
        </p>
      )}

      {briefs.length === 0 ? (
        <div className="mt-7 rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] px-6 py-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[13px] bg-[var(--w-violet-soft)] text-[var(--w-violet)]">
            <Hammer size={21} />
          </span>
          <h2
            className="mt-4 text-[20px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            No briefs yet
          </h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-[1.6] text-[var(--w-muted)]">
            We put members forward as company work comes in. Finished work on the open board is the
            strongest thing you can do in the meantime — it is what we point to.
          </p>
          <Link
            href="/feed"
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-[11px] border border-[var(--w-line-strong)] px-5 text-[14px] font-bold text-[var(--w-ink)] hover:bg-[var(--chip)]"
          >
            Explore open work <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <ul className="mt-7 grid gap-4">
          {briefs.map((brief) => {
            const steps = workflowFor(brief);
            const head = workflowHeadline(steps);
            const open = openId === brief.id;
            const done = steps.every((s) => s.state === "done");

            return (
              <li
                key={brief.id}
                className="overflow-hidden rounded-[16px] border border-[var(--w-line-strong)] bg-[var(--w-raised)]"
              >
                <button
                  onClick={() => setOpenId(open ? null : brief.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-[var(--chip)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15.5px] font-extrabold text-[var(--w-ink-strong)]">
                        {brief.title}
                      </span>
                      {brief.companies?.name && (
                        <span className="shrink-0 rounded-full bg-[var(--chip)] px-2 py-0.5 text-[11px] font-bold text-[var(--w-muted)]">
                          {brief.companies.name}
                        </span>
                      )}
                    </span>
                    {head && (
                      <span
                        className={`mt-1 block truncate text-[13px] ${
                          head.state === "blocked"
                            ? "font-bold text-[var(--bad)]"
                            : done
                            ? "text-[var(--w-muted)]"
                            : head.owner === "you"
                            ? "font-bold text-[var(--w-orange-ink)]"
                            : "text-[var(--w-muted)]"
                        }`}
                      >
                        {done ? "Finished and paid" : head.title}
                      </span>
                    )}
                  </span>
                  {brief.price != null && (
                    <span
                      className="shrink-0 text-[17px] font-extrabold tracking-[-0.02em] text-[var(--w-ink-strong)]"
                      style={{ fontFamily: "var(--font-display), sans-serif" }}
                    >
                      ₹{brief.price}
                    </span>
                  )}
                </button>

                {open && (
                  <div className="border-t border-[var(--w-line)] p-5 pb-1">
                    <ol className="grid">
                      {steps.map((s, i) => (
                        <StepRow key={s.key} step={s} last={i === steps.length - 1} />
                      ))}
                    </ol>
                    <div className="flex flex-wrap gap-2.5 border-t border-[var(--w-line)] py-4">
                      <Link
                        href={`/gig/${brief.id}`}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-[11px] bg-[var(--w-orange)] px-5 text-[14px] font-bold text-[#371448] hover:opacity-90"
                      >
                        Open the brief <ArrowRight size={15} />
                      </Link>
                      <Link
                        href="/messages"
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-[11px] border border-[var(--w-line-strong)] px-4 text-[14px] font-bold text-[var(--w-ink)] hover:bg-[var(--chip)]"
                      >
                        <MessageCircle size={15} /> Message the client
                      </Link>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
