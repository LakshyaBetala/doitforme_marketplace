"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ThumbsUp, BadgeCheck, Briefcase, Loader2 } from "lucide-react";

/**
 * The trust row: verified · jobs done · recommendations.
 *
 * With zero completed gigs on the platform, star ratings are empty on every
 * profile, so a poster choosing between 20 applicants has nothing to go on.
 * These three signals work from day one — verification and recommendations do
 * not require a completed transaction to exist.
 *
 * Numbers are stated plainly rather than dressed up: "3 people recommend them"
 * reads as fact, "⭐ 3 RECOMMENDATIONS!" reads as a badge nobody believes.
 */

type Props = {
  userId: string;
  jobsCompleted?: number | null;
  kycVerified?: boolean | null;
  /** Hide the action button on your own profile. */
  isSelf?: boolean;
  /** Show the Recommend action. Off by default: vouching only means something
   *  once you've actually worked together, so surfaces that show strangers
   *  (like applicant review) must not offer it. */
  canRecommend?: boolean;
  className?: string;
};

export default function TrustSignals({
  userId,
  jobsCompleted = 0,
  kycVerified = false,
  isSelf = false,
  canRecommend = false,
  className = "",
}: Props) {
  const [count, setCount] = useState(0);
  const [hasRecommended, setHasRecommended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/recommend?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setCount(data.count || 0);
      setHasRecommended(Boolean(data.hasRecommended));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async () => {
    setBusy(true);
    // Optimistic: the button should feel instant, and a failure reverts below.
    const wasRecommended = hasRecommended;
    setHasRecommended(!wasRecommended);
    setCount((c) => (wasRecommended ? Math.max(0, c - 1) : c + 1));

    try {
      const res = await fetch("/api/recommend", {
        method: wasRecommended ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHasRecommended(wasRecommended);
        setCount((c) => (wasRecommended ? c + 1 : Math.max(0, c - 1)));
        toast.error(data.error || "Couldn't do that right now.");
        return;
      }
      if (!wasRecommended) toast.success("Recommended — they've been told.");
    } catch {
      setHasRecommended(wasRecommended);
      setCount((c) => (wasRecommended ? c + 1 : Math.max(0, c - 1)));
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  };

  const jobs = jobsCompleted || 0;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {kycVerified && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brand-purple)]/10 border border-[var(--brand-purple)]/25 text-[11px] font-medium text-[var(--brand-purple-soft)]">
          <BadgeCheck size={13} />
          Verified student
        </span>
      )}

      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-white/70">
        <Briefcase size={12} />
        <span className="tabular-nums">{jobs}</span> {jobs === 1 ? "job done" : "jobs done"}
      </span>

      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-medium text-white/70">
        <ThumbsUp size={12} />
        {loading ? (
          <span className="text-white/40">…</span>
        ) : (
          <>
            <span className="tabular-nums">{count}</span>{" "}
            {count === 1 ? "recommends them" : "recommend them"}
          </>
        )}
      </span>

      {canRecommend && !isSelf && !loading && (
        <button
          onClick={toggle}
          disabled={busy}
          aria-pressed={hasRecommended}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition disabled:opacity-50 min-h-[32px] ${
            hasRecommended
              ? "bg-[var(--brand-purple)] border-[var(--brand-purple)] text-white"
              : "bg-white/[0.04] border-white/[0.12] text-white/80 hover:bg-white/[0.08]"
          }`}
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <ThumbsUp size={12} />}
          {hasRecommended ? "Recommended" : "Recommend"}
        </button>
      )}
    </div>
  );
}
