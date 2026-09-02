"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { platformFeeFor, audienceForGig, PLATFORM_FEES } from "@/lib/fees";
import { Loader2, Briefcase, IndianRupee, ArrowRight, ShieldCheck, CheckCircle, Clock, Phone, MessageSquare, Zap, AlertTriangle, X, Star } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import StayReachable from "@/components/StayReachable";
import CanonicalStatusBadge, { statusToTone, humanizeStatus } from "@/components/ui/StatusBadge";

// In-review states read better with a custom label; everything else flows through the canonical mapper.
const STATUS_LABEL_OVERRIDES: Record<string, string> = {
  assigned: "In progress",
  AWAITING_FUNDS: "Awaiting escrow",
  SUBMITTED: "In review",
  delivered: "In review",
};

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL_OVERRIDES[status] || humanizeStatus(status);
  return <CanonicalStatusBadge tone={statusToTone(status)}>{label}</CanonicalStatusBadge>;
}


/**
 * One clear state for the worker, from their point of view.
 *
 * The card used to render `app.status === 'accepted' ? gig.status : app.status`,
 * which mixed two different state machines: an accepted worker on a gig that was
 * still filling saw "Open", and a worker whose gig had been taken by someone
 * else saw nothing at all. Neither told them what they actually needed to know —
 * am I hired, am I waiting, or is this over?
 */
function workerState(app: any, gig: any): { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger"; hint?: string } {
  const gigStatus = String(gig?.status || "").toLowerCase();
  const appStatus = String(app?.status || "").toLowerCase();

  if (["cancelled", "expired"].includes(gigStatus)) {
    return { label: "Closed", tone: "neutral", hint: "The poster took this down. You're not waiting on it." };
  }
  if (["closed", "rejected"].includes(appStatus)) {
    return { label: "Not selected", tone: "neutral", hint: "They went with someone else this time." };
  }
  // Taken by somebody else while this application was still pending.
  if (gig?.assigned_worker_id && gig.assigned_worker_id !== app.worker_id && appStatus !== "accepted") {
    return { label: "Filled", tone: "neutral", hint: "Someone else was hired for this." };
  }
  if (appStatus === "accepted") {
    if (gigStatus === "completed") return { label: "Paid", tone: "success" };
    if (["delivered", "submitted"].includes(gigStatus)) {
      return { label: "Awaiting approval", tone: "info", hint: "They have 24 hours to approve, then it releases automatically." };
    }
    if (["assigned"].includes(gigStatus)) return { label: "In progress", tone: "info" };
    return { label: "Hired", tone: "success", hint: "Waiting for the poster to pay into escrow." };
  }
  return { label: "Applied", tone: "warning", hint: "Waiting to hear back from the poster." };
}

function CountdownTimer({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); return; }
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${hours}h ${mins}m remaining`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="flex items-center gap-1.5 text-xs text-[var(--brand-purple-soft)]">
      <Clock size={12} /> {timeLeft}
    </div>
  );
}

export default function ActivityHubPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [activeTab, setActiveTab] = useState<"HIRING" | "WORKING">("HIRING");
  const [hiringGigs, setHiringGigs] = useState<any[]>([]);
  const [workingGigs, setWorkingGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [telegramLinked, setTelegramLinked] = useState(true);
  const [hasLiveWork, setHasLiveWork] = useState(false);

  // Submit-work modal (delivery note + optional link)
  const [submitGigId, setSubmitGigId] = useState<string | null>(null);
  const [submitNote, setSubmitNote] = useState("");
  // Gigs whose poster this worker has already rated, so the button disappears
  // after use without needing a refetch.
  const [ratedPosters, setRatedPosters] = useState<string[]>([]);
  const [submitLink, setSubmitLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadActivity() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      // Load Hiring (Gigs I posted)
      const { data: myPosts } = await supabase
        .from('gigs')
        // applications(count) is what makes "3 applicants" possible. Without it
        // a poster saw their own gig with no indication anyone had applied, and
        // no route to review or hire — the single biggest hole on this page.
        .select('*, worker:users!assigned_worker_id(name, phone), applications(count)')
        .eq('poster_id', user.id)
        .order('created_at', { ascending: false });

      // Load Working (Applications I submitted)
      const { data: myApps } = await supabase
        .from('applications')
        .select('*, gig:gigs(*, poster:users!poster_id(name, phone))')
        .eq('worker_id', user.id)
        .order('created_at', { ascending: false });

      setHiringGigs(myPosts || []);
      setWorkingGigs(myApps || []);

      // Only ask someone to stay reachable once they actually have a live deal —
      // asking at signup is why this sat at 7 connections out of 1,069.
      const live = (myPosts || []).some((g: any) =>
          ['HELD', 'ESCROW_FUNDED', 'PAYOUT_PENDING'].includes(g.payment_status))
        || (myApps || []).some((a: any) => a.status === 'accepted');
      setHasLiveWork(live);

      if (live) {
        const { data: me } = await supabase
          .from('users').select('telegram_chat_id').eq('id', user.id).maybeSingle();
        setTelegramLinked(Boolean(me?.telegram_chat_id));
      }

      setLoading(false);
    }
    loadActivity();
  }, [router, supabase]);

  /**
   * Fund escrow for real.
   *
   * This previously said "Initiating payment…" and then simply wrote
   * escrow_status = 'FUNDED' straight from the browser — no gateway call, no
   * money, no transaction row. A poster could mark any gig fully funded for
   * free, and the worker would deliver against an escrow that held nothing.
   *
   * It now goes through /api/payments/create-order (which re-reads the price
   * server-side and records the recipient) and opens the real Razorpay
   * checkout. Settlement happens in the webhook, never in the browser.
   */
  const handleFundEscrow = async (gigId: string) => {
    const t = toast.loading("Opening checkout…");
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId }),
      });
      const data = await res.json();
      if (!res.ok || (!data.payment_session_id && data.provider !== "RAZORPAY")) {
        toast.error(data.error || "Could not start checkout.", { id: t });
        return;
      }
      toast.dismiss(t);

      if (data.provider === "RAZORPAY") {
        await openRazorpayCheckout(data, { onSuccess: () => router.refresh() });
        return;
      }

      toast.error("Could not start checkout.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payment could not be started.", { id: t });
    }
  };

  /**
   * Take down a listing. Allowed only until someone is hired — the server
   * enforces that too, and refuses with a reason rather than failing silently.
   */
  const handleDeleteGig = async (gigId: string, title: string) => {
    if (!confirm(`Take down "${title}"? Anyone who applied will be told it closed.`)) return;
    const t = toast.loading("Taking it down…");
    try {
      const res = await fetch("/api/gig/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't take it down.", { id: t });
        return;
      }
      toast.success(
        data.notified > 0 ? `Taken down. ${data.notified} applicant${data.notified === 1 ? "" : "s"} told.` : "Taken down.",
        { id: t }
      );
      setHiringGigs((prev) => prev.filter((g) => g.id !== gigId));
    } catch {
      toast.error("Something went wrong.", { id: t });
    }
  };

  // Escrow submit opens the delivery-note modal. Direct (legacy off-platform)
  // just marks done with no escrow timer.
  const handleSubmitWork = async (gigId: string, applicationId: string, isDirect: boolean = false) => {
      if (!isDirect) {
          setSubmitGigId(gigId);
          setSubmitNote("");
          setSubmitLink("");
          return;
      }
      toast.loading("Marking as done...");
      const { error } = await supabase.from('gigs')
         .update({ status: 'delivered' })
         .eq('id', gigId);
      if (error) toast.error("Failed to submit work");
      else {
          toast.success("Work marked as done!");
          setWorkingGigs(prev => prev.map(app =>
              app.gig?.id === gigId ? { ...app, gig: { ...app.gig, status: 'delivered' } } : app
          ));
      }
  };

  // Server-validated submission: requires a note describing the work, posts it
  // to the poster's chat, sets status to 'delivered' and starts the 24h timer.
  const submitWork = async () => {
      if (!submitGigId) return;
      if (!submitNote.trim()) return toast.error("Describe what you delivered and how.");
      setIsSubmitting(true);
      try {
          const send = (upi?: string) => fetch("/api/gig/deliver", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  gigId: submitGigId,
                  note: submitNote,
                  deliveryLink: submitLink.trim() || undefined,
                  upiId: upi,
              })
          });

          let res = await send();
          let data = await res.json().catch(() => ({}));

          // UPI is not required to apply, so this is the first moment we need it.
          // Ask here rather than letting the poster hit "worker has no UPI" when
          // they try to release the money.
          if (res.status === 409 && data?.code === "UPI_REQUIRED") {
              const upi = window.prompt(
                  "Where should we pay you?\n\nEnter your UPI ID (like yourname@okicici). You only need to do this once."
              );
              if (upi === null) { setIsSubmitting(false); return; }
              res = await send(upi.trim());
              data = await res.json().catch(() => ({}));
          }

          if (!res.ok) {
              toast.error(data?.error || "Failed to submit work");
          } else {
              const releaseDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
              toast.success("Work submitted. The poster has 24 hours to review.");
              setWorkingGigs(prev => prev.map(app =>
                  app.gig?.id === submitGigId ? { ...app, gig: { ...app.gig, status: 'delivered', auto_release_at: releaseDate, delivery_link: submitLink.trim() || app.gig?.delivery_link } } : app
              ));
              setSubmitGigId(null);
          }
      } catch (e) {
          toast.error("Network error. Please try again.");
      } finally {
          setIsSubmitting(false);
      }
  };

  // Approving is a money move, so it goes through /api/escrow/release →
  // manual_release_escrow.
  //
  // This used to be a raw client-side
  //   supabase.from('gigs').update({ status:'completed', escrow_status:'RELEASED' })
  // which flipped two columns and nothing else: the escrow row stayed HELD, no
  // ledger rows were written, and no payout_queue row was created. The poster
  // saw "funds released" while the worker was owed money that nothing in the
  // system recorded — invisible to the admin Payouts desk and to /payouts.
  //
  // The toast was also never dismissed (toast.loading returns an id that has to
  // be passed back), so the "Releasing funds..." spinner hung around forever.
  const handleApproveWork = async (gigId: string, isDirect: boolean = false) => {
      const confirmed = window.confirm(
        isDirect
          ? "Close this task? It will be marked complete."
          : "Approve the work and release the payment?\n\nThe money leaves escrow and cannot be pulled back. If something is wrong, request changes or raise a dispute instead."
      );
      if (!confirmed) return;

      const toastId = toast.loading(isDirect ? "Closing task..." : "Releasing funds...");

      try {
        if (isDirect) {
          const { error } = await supabase.from('gigs').update({ status: 'completed' }).eq('id', gigId);
          if (error) throw new Error(error.message);
          toast.success("Task closed.", { id: toastId });
          setHiringGigs(prev => prev.map(g => g.id === gigId ? { ...g, status: 'completed' } : g));
          return;
        }

        const res = await fetch("/api/escrow/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gigId }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // WORKER_UPI_MISSING is the common one and is actionable by the
          // student, so show the server's wording rather than a generic failure.
          toast.error(data?.error || "Could not release the payment.", { id: toastId, duration: 9000 });
          return;
        }

        toast.success(
          "Approved. The payment is on its way to the student and settles within 24–48 hours.",
          { id: toastId, duration: 9000 }
        );
        setHiringGigs(prev => prev.map(g => g.id === gigId
          ? { ...g, status: 'completed', escrow_status: 'RELEASED', payment_status: 'PAYOUT_PENDING' }
          : g));
      } catch (err: any) {
        toast.error(err?.message || "Could not release the payment.", { id: toastId });
      }
  };

  // Worker → poster rating. Kept out of users.rating on purpose: a person is
  // both a poster and a hustler here, and merging the two scores describes
  // neither. The role is derived per rating on the profile page.
  const ratePoster = async (gigId: string, posterName?: string) => {
      const scoreRaw = window.prompt(
        `How was ${posterName || "this poster"} to work with? Rate 1-5.\n\nClear brief, replied to messages, approved on time — that sort of thing. It shows on their profile.`,
        "5"
      );
      if (scoreRaw === null) return;
      const score = Number(String(scoreRaw).trim());
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        return toast.error("Enter a whole number from 1 to 5.");
      }
      const review = window.prompt("Add a short review (optional). This is public on their profile.") || "";

      const toastId = toast.loading("Saving your rating...");
      try {
        const res = await fetch("/api/gig/rate-poster", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gigId, rating: score, review: review.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error || "Could not save your rating.", { id: toastId });
          // Already rated is not worth offering the button again.
          if (res.status === 409) setRatedPosters((p) => [...p, gigId]);
          return;
        }
        toast.success("Thanks — that helps the next student.", { id: toastId });
        setRatedPosters((p) => [...p, gigId]);
      } catch (err: any) {
        toast.error(err?.message || "Could not save your rating.", { id: toastId });
      }
  };

  // The third exit from a delivered gig. Freezes escrow for admin review rather
  // than moving money either way.
  const handleRaiseDispute = async (gigId: string) => {
      const reason = window.prompt(
        "What went wrong?\n\nThis goes to our team and to the student. The payment stays held until we resolve it — we reply within 48 hours."
      );
      if (reason === null) return;
      if (reason.trim().length < 10) {
        toast.error("Please describe the problem in a sentence or two.");
        return;
      }

      const toastId = toast.loading("Opening dispute...");
      try {
        const res = await fetch("/api/gig/dispute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gigId, reason: reason.trim() }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          toast.error(data?.error || "Could not open the dispute.", { id: toastId });
          return;
        }

        toast.success(
          "Dispute opened. The payment stays held while we review — we reply within 48 hours.",
          { id: toastId, duration: 9000 }
        );
        setHiringGigs(prev => prev.map(g => g.id === gigId
          ? { ...g, status: 'disputed', escrow_status: 'DISPUTED' }
          : g));
      } catch (err: any) {
        toast.error(err?.message || "Could not open the dispute.", { id: toastId });
      }
  };

  if (loading) return <div className="min-h-screen bg-[#0B0B11] flex justify-center items-center"><Loader2 className="animate-spin text-[#C9A9FF] w-8 h-8" /></div>;

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-white p-4 md:p-8 cursor-default selection:bg-[#8825F5] selection:text-white pb-32 overflow-hidden">
      {/* Subtle purple ambient glow */}
      <div className="pointer-events-none absolute -top-32 -left-20 w-[500px] h-[500px] rounded-full bg-[#8825F5]/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-[400px] h-[400px] rounded-full bg-[#0097FF]/[0.06] blur-[140px]" />

      <div className="relative max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Activity</h1>
            <p className="text-xs text-white/50 mt-1">Track every gig you've posted or applied for.</p>
          </div>
          <button onClick={() => router.push('/dashboard')} className="text-xs text-white/60 hover:text-white transition-colors bg-white/[0.04] border border-white/[0.08] px-3 py-2 rounded-xl">← Dashboard</button>
        </div>

        {/* TABS */}
        <div className="flex bg-white/5 p-1.5 rounded-2xl relative border border-white/5">
           <button onClick={() => setActiveTab("HIRING")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-colors ${activeTab === 'HIRING' ? 'text-white' : 'text-white/60 hover:text-white'}`}>
             {activeTab === 'HIRING' && <motion.div layoutId="activeTab" className="absolute inset-0 bg-[#8825F5] rounded-xl shadow-lg shadow-[#C9A9FF]/20 -z-10" />}
             <Briefcase size={14} className="z-10" /> <span className="z-10">Outsourcing ({hiringGigs.length})</span>
           </button>
           <button onClick={() => setActiveTab("WORKING")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-colors ${activeTab === 'WORKING' ? 'text-white' : 'text-white/60 hover:text-white'}`}>
             {activeTab === 'WORKING' && <motion.div layoutId="activeTab" className="absolute inset-0 bg-[#8825F5] rounded-xl shadow-lg shadow-[#C9A9FF]/20 -z-10" />}
             <Zap size={14} className="z-10" /> <span className="z-10">Hustling ({workingGigs.length})</span>
           </button>
        </div>

        {/* Shown only once there's live, funded work — the one moment the ask is
            obviously in the user's own interest rather than a settings chore. */}
        {hasLiveWork && (
          <StayReachable telegramLinked={telegramLinked} className="mb-4" />
        )}

        {/* LIST */}
        <div className="space-y-4">
           {activeTab === "HIRING" && hiringGigs.length === 0 && (
             <div className="rounded-3xl border border-white/[0.08] bg-[var(--card)] p-10 text-center">
               <div className="mx-auto w-14 h-14 rounded-2xl bg-[#8825F5]/15 border border-[#8825F5]/30 flex items-center justify-center mb-4">
                 <Briefcase size={22} className="text-[#C9A9FF]" />
               </div>
               <h3 className="text-base font-semibold text-white mb-1">Nothing posted yet</h3>
               <p className="text-sm text-white/50 mb-5 max-w-xs mx-auto">Post a task in under 60 seconds and start getting offers from verified hustlers.</p>
               <button onClick={() => router.push('/post')} className="px-5 py-2.5 rounded-full bg-[#8825F5] hover:bg-[#7a1de0] text-white text-xs font-semibold tracking-wide transition-colors">Post a hustle</button>
             </div>
           )}
           {activeTab === "WORKING" && workingGigs.length === 0 && (
             <div className="rounded-3xl border border-white/[0.08] bg-[var(--card)] p-10 text-center">
               <div className="mx-auto w-14 h-14 rounded-2xl bg-[#8825F5]/15 border border-[#8825F5]/30 flex items-center justify-center mb-4">
                 <Zap size={22} className="text-[#C9A9FF]" />
               </div>
               <h3 className="text-base font-semibold text-white mb-1">No active hustles</h3>
               <p className="text-sm text-white/50 mb-5 max-w-xs mx-auto">Browse the live feed and apply to work that matches your skills.</p>
               <button onClick={() => router.push('/dashboard')} className="px-5 py-2.5 rounded-full bg-[#8825F5] hover:bg-[#7a1de0] text-white text-xs font-semibold tracking-wide transition-colors">Browse feed</button>
             </div>
           )}

           {activeTab === "HIRING" && hiringGigs.map(gig => (
             <div key={gig.id} className="bg-[#1A1A24] border border-white/5 rounded-2xl p-5 hover:border-[#C9A9FF]/30 transition group">
                <div className="flex justify-between items-start mb-3">
                   <div className="flex-1 min-w-0">
                     <h3 className="font-bold text-white text-lg truncate">{gig.title}</h3>
                     <p className="text-[#C9A9FF] font-semibold flex items-center gap-1"><IndianRupee size={12} /> {gig.price}</p>
                   </div>
                   <StatusBadge status={gig.status} />
                </div>

                {/* Worker contact info for active gigs */}
                {/* Contact details unlock only once escrow actually HOLDS money.
                    This previously included AWAITING_FUNDS, so a poster could
                    accept someone, take their phone number, and never pay —
                    which is the exact off-platform leak escrow exists to stop. */}
                {gig.worker && ['HELD', 'ESCROW_FUNDED', 'PAYOUT_PENDING'].includes(gig.payment_status) && (
                  <div className="p-3 bg-[#C9A9FF]/5 rounded-xl text-sm mb-3 border border-[#C9A9FF]/10 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-white/50 text-xs">Hustler:</span> <span className="font-bold text-white">{gig.worker.name}</span>
                    </div>
                    {gig.worker.phone && (
                      <a href={`tel:${gig.worker.phone}`} className="flex items-center gap-1 text-xs text-[#C9A9FF] font-bold bg-[#C9A9FF]/10 px-2.5 py-1 rounded-lg border border-[#C9A9FF]/20 hover:bg-[#C9A9FF]/20 transition-colors">
                        <Phone size={10} /> {gig.worker.phone}
                      </a>
                    )}
                  </div>
                )}

                {/* Auto-release countdown */}
                {(gig.status === 'SUBMITTED' || gig.status === 'delivered') && gig.auto_release_at && (
                  <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-white/60 font-medium">Auto-release timer:</span>
                    <CountdownTimer targetDate={gig.auto_release_at} />
                  </div>
                )}

                {/* Applicants. A poster previously saw their own gig with no sign
                    anyone had applied and no way to review or hire — the reason
                    145 applications sat unanswered. The count is the prompt; the
                    button is the route to acting on it. */}
                {(() => {
                  const applicantCount = Array.isArray(gig.applications)
                    ? (gig.applications[0]?.count ?? 0)
                    : 0;
                  if (gig.assigned_worker_id) return null;
                  return (
                    <button
                      onClick={() => router.push(`/gig/${gig.id}/applicants`)}
                      className={`w-full mb-3 p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition ${
                        applicantCount > 0
                          ? "bg-[var(--brand-purple)]/[0.08] border-[var(--brand-purple)]/25 hover:bg-[var(--brand-purple)]/[0.14]"
                          : "bg-white/[0.02] border-white/[0.08] cursor-default"
                      }`}
                      disabled={applicantCount === 0}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-white">
                          {applicantCount === 0
                            ? "No applicants yet"
                            : `${applicantCount} ${applicantCount === 1 ? "person has" : "people have"} applied`}
                        </span>
                        <span className="block text-xs text-white/55 mt-0.5">
                          {applicantCount === 0
                            ? "We'll notify you the moment someone applies."
                            : "Review them, pick one, and pay to start the work."}
                        </span>
                      </span>
                      {applicantCount > 0 && (
                        <span className="shrink-0 text-xs font-semibold text-[var(--brand-purple-soft)] flex items-center gap-1">
                          Review <ArrowRight size={13} />
                        </span>
                      )}
                    </button>
                  );
                })()}

                {/* What was actually delivered. Approving releases real money,
                    so the evidence belongs next to the button, not one page away. */}
                {(gig.status === 'SUBMITTED' || gig.status === 'delivered') && (gig.delivery_link || (Array.isArray(gig.delivery_files) && gig.delivery_files.length > 0)) && (
                  <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Delivered work</p>
                    {gig.delivery_link && (
                      <a href={gig.delivery_link} target="_blank" rel="noopener noreferrer" className="block text-xs text-[var(--brand-purple-soft)] hover:underline break-all">
                        {gig.delivery_link}
                      </a>
                    )}
                    {Array.isArray(gig.delivery_files) && gig.delivery_files.map((f: string, i: number) => (
                      <a key={i} href={f} target="_blank" rel="noopener noreferrer" className="block text-xs text-[var(--brand-purple-soft)] hover:underline break-all">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-2 mt-3 border-t border-white/5 pt-3">
                   <button onClick={() => router.push(`/gig/${gig.id}`)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition text-center flex items-center justify-center gap-2 border border-white/5">
                     <Briefcase size={14} /> View gig
                   </button>
                   <button onClick={() => router.push(`/chat/${gig.id}`)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition text-center flex items-center justify-center gap-2 border border-white/5">
                     <MessageSquare size={14} /> Chat
                   </button>

                   {!gig.assigned_worker_id && gig.status === 'open' && (
                     <button
                       onClick={() => handleDeleteGig(gig.id, gig.title)}
                       className="py-2.5 px-4 rounded-xl bg-white/[0.03] hover:bg-red-500/10 text-white/60 hover:text-red-400 font-bold text-sm transition border border-white/5 flex items-center justify-center gap-2"
                     >
                       <X size={14} /> Take down
                     </button>
                   )}

                   {gig.status === 'AWAITING_FUNDS' && gig.payment_gateway !== 'DIRECT' && (
                     <button onClick={() => handleFundEscrow(gig.id)} className="flex-1 py-2.5 rounded-xl bg-[#8825F5] hover:bg-[#7a1de0] text-white font-bold text-sm transition shadow-lg shadow-[#C9A9FF]/20 flex items-center gap-2 justify-center">
                       <ShieldCheck size={14} /> Pay &amp; start work
                     </button>
                   )}

                   {(gig.status === 'SUBMITTED' || gig.status === 'delivered' || (gig.status === 'assigned' && gig.payment_gateway === 'DIRECT')) && (
                     <button onClick={() => handleApproveWork(gig.id, gig.payment_gateway === 'DIRECT')} className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition shadow-lg shadow-green-500/20 flex items-center gap-2 justify-center">
                       <CheckCircle size={14} /> {gig.payment_gateway === 'DIRECT' ? 'Close Task' : 'Approve & Release'}
                     </button>
                   )}

                   {/* Escrow was frozen on dispute but there was no way to raise
                       one from here — approve was the only exit from a delivered gig. */}
                   {(gig.status === 'SUBMITTED' || gig.status === 'delivered') && gig.payment_gateway !== 'DIRECT' && (
                     <button
                       onClick={() => handleRaiseDispute(gig.id)}
                       className="py-2.5 px-4 rounded-xl bg-white/[0.03] hover:bg-red-500/10 text-white/60 hover:text-red-400 font-bold text-sm transition border border-white/5 flex items-center justify-center gap-2"
                     >
                       <AlertTriangle size={14} /> Raise dispute
                     </button>
                   )}
                </div>
             </div>
           ))}

           {activeTab === "WORKING" && workingGigs.map(app => {
             const gig = app.gig;
             if(!gig) return null;
             const ws = workerState(app, gig);

             return (
               <div key={app.id} className="bg-[#1A1A24] border border-white/5 rounded-2xl p-5 hover:border-[#C9A9FF]/30 transition group">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                     <div className="flex-1 min-w-0">
                       <h3 className="font-bold text-white text-lg truncate">{gig.title}</h3>
                       <p className="text-white font-semibold flex items-center gap-1"><IndianRupee size={12} /> {app.negotiated_price || gig.price}</p>
                       {ws.hint && <p className="text-xs text-white/50 mt-1.5 leading-relaxed">{ws.hint}</p>}
                     </div>
                     <div className="shrink-0 max-w-[50%] flex justify-end">
                        <CanonicalStatusBadge tone={ws.tone}>{ws.label}</CanonicalStatusBadge>
                     </div>
                  </div>



                   {/* Poster contact info for active gigs */}
                  {/* Same rule for the worker: the poster's number appears only
                      after the money is in escrow, so neither side can trade
                      contact details before the platform is committed. */}
                  {app.status === 'accepted' && gig.poster && ['HELD', 'ESCROW_FUNDED', 'PAYOUT_PENDING'].includes(gig.payment_status) && (
                    <div className="p-3 bg-white/5 rounded-xl text-sm mb-3 border border-white/5 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-white/50 text-xs">Client:</span> <span className="font-bold text-white">{gig.poster.name}</span>
                      </div>
                      {gig.poster.phone && (
                        <a href={`tel:${gig.poster.phone}`} className="flex items-center gap-1 text-xs text-[#C9A9FF] font-bold bg-[#C9A9FF]/10 px-2.5 py-1 rounded-lg border border-[#C9A9FF]/20 hover:bg-[#C9A9FF]/20 transition-colors">
                          <Phone size={10} /> {gig.poster.phone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Auto-release countdown for submitted work */}
                  {(gig.status === 'SUBMITTED' || gig.status === 'delivered') && gig.auto_release_at && (
                    <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-between">
                      <span className="text-xs text-white/60 font-medium">Auto-release:</span>
                      <CountdownTimer targetDate={gig.auto_release_at} />
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-2 mt-3 border-t border-white/5 pt-3">
                     <button onClick={() => router.push(`/gig/${gig.id}`)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition text-center flex items-center justify-center gap-2 border border-white/5">
                       <Briefcase size={14} /> View gig
                     </button>
                     <button onClick={() => router.push(`/chat/${gig.id}`)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition text-center flex items-center justify-center gap-2 border border-white/5">
                       <MessageSquare size={14} /> Chat
                     </button>

                     {app.status === 'accepted' && gig.status === 'AWAITING_FUNDS' && gig.payment_gateway !== 'DIRECT' && (
                        <div className="flex-1 py-2.5 rounded-xl bg-yellow-500/10 text-yellow-500 font-bold text-sm text-center border border-yellow-500/20 flex items-center justify-center gap-2">
                          <Clock size={14} /> Waiting for Escrow
                        </div>
                     )}

                     {app.status === 'accepted' && (gig.status === 'assigned') && (
                       <button onClick={() => handleSubmitWork(gig.id, app.id, gig.payment_gateway === 'DIRECT')} className="flex-1 py-2.5 rounded-xl bg-[#8825F5] hover:bg-[#7a1de0] text-white font-bold text-sm transition shadow-lg shadow-[#C9A9FF]/20 flex items-center gap-2 justify-center">
                         <ArrowRight size={14} /> {gig.payment_gateway === 'DIRECT' ? 'Mark as Done' : 'Submit Work'}
                       </button>
                     )}

                     {/* The other half of the reputation. Posters rated workers
                         from day one; workers had no way to say anything back,
                         so a poster who pays late or never replies carried no
                         signal at all. */}
                     {gig.status === 'completed' && !ratedPosters.includes(gig.id) && (
                       <button
                         onClick={() => ratePoster(gig.id, gig.poster?.name)}
                         className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition border border-white/5 flex items-center justify-center gap-2"
                       >
                         <Star size={14} /> Rate the poster
                       </button>
                     )}
                  </div>
               </div>
             )
           })}

        </div>

      </div>

      {/* SUBMIT WORK MODAL — delivery note (required) + optional link */}
      {submitGigId && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-6 max-w-md w-full relative">
            <button onClick={() => setSubmitGigId(null)} className="absolute top-4 right-4 text-white/60 hover:text-white">
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold mb-1">Submit your work</h3>
            <p className="text-white/50 text-xs mb-4">Describe exactly what you delivered and how. If files were shared off-platform, say where. The poster has 24 hours to approve or request changes; funds stay safely in escrow until they approve.</p>
            <textarea
              value={submitNote}
              onChange={(e) => setSubmitNote(e.target.value)}
              placeholder="What did you deliver? e.g. Final deck with 12 slides, sources cited, shared via the link below."
              className="w-full bg-black/20 text-white text-sm p-4 rounded-xl border border-white/10 focus:border-[var(--brand-purple)]/50 outline-none resize-none h-28 mb-3"
            />
            <input
              type="url"
              value={submitLink}
              onChange={(e) => setSubmitLink(e.target.value)}
              placeholder="Delivery link (optional): Drive, Figma, GitHub…"
              className="w-full bg-black/20 text-white text-sm p-3 rounded-xl border border-white/10 focus:border-[var(--brand-purple)]/50 outline-none mb-4"
            />
            {/* What lands in their account, stated before they hand the work
                over — not discovered at payout. */}
            {(() => {
              const g = workingGigs.find((a) => a.gig?.id === submitGigId)?.gig;
              const price = Number(g?.price) || 0;
              if (!g || price <= 0) return null;
              const fee = platformFeeFor(price, audienceForGig(g));
              return (
                <div className="mb-4 rounded-xl bg-white/[0.03] border border-white/[0.08] p-3.5 flex items-center justify-between gap-3">
                  <span className="text-xs text-white/50">You will be paid</span>
                  <span className="text-base font-bold text-white">
                    ₹{price - fee}
                    <span className="text-[11px] font-normal text-white/40 ml-1.5">
                      after {Math.round(PLATFORM_FEES[audienceForGig(g)] * 100)}% fee
                    </span>
                  </span>
                </div>
              );
            })()}

            <button
              onClick={submitWork}
              disabled={isSubmitting || !submitNote.trim()}
              className="w-full py-3 bg-[var(--brand-purple)] hover:brightness-110 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Submit for review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
