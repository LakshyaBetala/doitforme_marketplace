"use client";

import { useCallback, useEffect, useState } from "react";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Avatar from "@/components/ui/Avatar";
import TrustSignals from "@/components/TrustSignals";
import EmptyState from "@/components/ui/EmptyState";
import { toast } from "sonner";
import {
  Loader2, ChevronLeft, MessageSquare, FileText, ExternalLink,
  GraduationCap, Users, BadgeCheck,
} from "lucide-react";

/**
 * Applicant review — the screen a student poster never had.
 *
 * Companies got /company/task/[id] with pitches, skills, resumes and a hire
 * button. Student posters got a link to chat, which shows a name and nothing to
 * judge on, so choosing between applicants meant interviewing each one from
 * scratch. That friction is a large part of why 267 applications produced 4
 * acceptances.
 *
 * Everything needed to decide is on one card: who they are, what they said,
 * what they've done, and their resume. Hiring pays through escrow.
 */

type Applicant = {
  id: string;
  worker_id: string;
  pitch: string | null;
  status: string;
  created_at: string;
  negotiated_price: number | null;
  users: {
    id: string;
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    college: string | null;
    skills: string[] | null;
    portfolio_links: string[] | null;
    experience: string | null;
    resume_url: string | null;
    rating: number | null;
    rating_count: number | null;
    jobs_completed: number | null;
    kyc_verified: boolean | null;
  } | null;
};

export default function ApplicantsPage() {
  const params = useParams();
  const router = useRouter();
  const gigId = params?.id as string;
  const supabase = supabaseBrowser();

  const [gig, setGig] = useState<any>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiring, setHiring] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/login");

    const { data: gigData } = await supabase
      .from("gigs")
      .select("id, title, price, poster_id, status, assigned_worker_id, listing_type")
      .eq("id", gigId)
      .single();

    // Only the poster may see who applied — applicant identities and pitches
    // are not public.
    if (!gigData || gigData.poster_id !== user.id) {
      toast.error("That isn't your listing.");
      return router.push("/activity");
    }
    setGig(gigData);

    const { data } = await supabase
      .from("applications")
      .select(`id, worker_id, pitch, status, created_at, negotiated_price,
        users!applications_worker_id_fkey(id, name, username, avatar_url, college, skills,
        portfolio_links, experience, resume_url, rating, rating_count, jobs_completed, kyc_verified)`)
      .eq("gig_id", gigId)
      .order("created_at", { ascending: true });

    setApplicants((data as any) || []);
    setLoading(false);
  }, [gigId, router, supabase]);

  useEffect(() => { load(); }, [load]);

  const hire = async (workerId: string, name: string) => {
    if (!confirm(`Hire ${name}? You'll pay now and we hold the money until you approve their work.`)) return;
    setHiring(workerId);
    const t = toast.loading("Opening checkout…");
    try {
      const res = await fetch("/api/gig/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId, workerId }),
      });
      const data = await res.json();
      if (!res.ok || (!data.paymentSessionId && data.provider !== "RAZORPAY")) {
        toast.error(data.error || "Couldn't start checkout.", { id: t });
        return;
      }
      toast.dismiss(t);
      if (data.provider === "RAZORPAY") {
        await openRazorpayCheckout(data, { onSuccess: () => router.refresh() });
        return;
      }
      const { load: loadCashfree } = await import("@cashfreepayments/cashfree-js");
      const cashfree = await loadCashfree({
        mode: process.env.NEXT_PUBLIC_CASHFREE_MODE === "production" ? "production" : "sandbox",
      });
      cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.", { id: t });
    } finally {
      setHiring(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[var(--background)] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-white">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <Link
          href="/activity"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white transition px-3 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-8"
        >
          <ChevronLeft size={18} />
          <span className="text-xs font-semibold">Activity</span>
        </Link>

        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight mb-1"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
        >
          {applicants.length} {applicants.length === 1 ? "applicant" : "applicants"}
        </h1>
        <p className="text-sm text-white/55 mb-8 truncate">
          {gig?.title} · <span className="tabular-nums">₹{gig?.price}</span>
        </p>

        {applicants.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nobody has applied yet"
            description="We'll notify you the moment someone does. Sharing the link speeds it up."
            actionLabel="Back to Activity"
            actionHref="/activity"
          />
        ) : (
          <div className="space-y-4">
            {applicants.map((app) => {
              const w = app.users;
              const isHired = app.status === "accepted";
              const alreadyFilled = Boolean(gig?.assigned_worker_id);

              return (
                <div
                  key={app.id}
                  className={`rounded-2xl border p-5 ${
                    isHired
                      ? "bg-[var(--brand-purple)]/[0.06] border-[var(--brand-purple)]/30"
                      : "bg-[var(--card)] border-white/[0.08]"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar src={w?.avatar_url} fallback={w?.name || "?"} className="w-11 h-11" sizes="44px" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[15px] truncate">{w?.name || "Unnamed"}</p>
                        {isHired && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--brand-purple-soft)]">
                            <BadgeCheck size={11} /> Hired
                          </span>
                        )}
                      </div>
                      {w?.college && (
                        <p className="text-xs text-white/50 mt-0.5 flex items-center gap-1.5 truncate">
                          <GraduationCap size={11} className="shrink-0" /> {w.college}
                        </p>
                      )}
                    </div>
                    {app.negotiated_price && (
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--brand-purple-soft)]">
                        ₹{app.negotiated_price}
                      </span>
                    )}
                  </div>

                  {w?.id && (
                    <TrustSignals
                      userId={w.id}
                      jobsCompleted={w.jobs_completed}
                      kycVerified={w.kyc_verified}
                      className="mb-4"
                    />
                  )}

                  {app.pitch && (
                    <p className="text-[13px] text-white/70 leading-relaxed mb-4 whitespace-pre-line">
                      {app.pitch}
                    </p>
                  )}

                  {w?.skills && w.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {w.skills.slice(0, 8).map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-white/65"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {(w?.resume_url || (w?.portfolio_links && w.portfolio_links.length > 0) || w?.username) && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {w?.username && (
                        <Link
                          href={`/u/${w.username}`}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/70 hover:text-white bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 transition"
                        >
                          <ExternalLink size={11} /> Profile
                        </Link>
                      )}
                      {w?.resume_url && (
                        <a
                          href={w.resume_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/70 hover:text-white bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 transition"
                        >
                          <FileText size={11} /> Resume
                        </a>
                      )}
                      {w?.portfolio_links?.slice(0, 2).map((l, i) => (
                        <a
                          key={l}
                          href={l}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/70 hover:text-white bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 transition"
                        >
                          <ExternalLink size={11} /> Work {i + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-white/[0.06]">
                    <button
                      onClick={() => router.push(`/chat/${gigId}?chat=${gigId}_${app.worker_id}`)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-sm font-semibold min-h-[44px] transition"
                    >
                      <MessageSquare size={15} /> Message
                    </button>
                    {!alreadyFilled && !isHired && (
                      <button
                        onClick={() => hire(app.worker_id, w?.name || "them")}
                        disabled={hiring === app.worker_id}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--brand-purple)] hover:opacity-90 text-white text-sm font-semibold min-h-[44px] transition disabled:opacity-50"
                      >
                        {hiring === app.worker_id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <>Hire &amp; pay ₹{app.negotiated_price || gig?.price}</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
