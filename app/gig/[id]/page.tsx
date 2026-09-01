"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Loader2, ArrowLeft, MapPin, Shield, ShieldCheck, Building2, MessageCircle, Clock, Users, Send, AlertTriangle, X, Check, ChevronLeft, ChevronRight, FileText, Download, Share2 } from "lucide-react";
import StatusBadge, { statusToTone, humanizeStatus } from "@/components/ui/StatusBadge";
import Skeleton from "@/components/ui/Skeleton";
import Image from "next/image";
import { toast } from "sonner";
import { friendlyError, friendlyHttpError } from "@/lib/errors";
import { isDocAttachment, isImageAttachment, attachmentLabel } from "@/lib/attachments";

export default function GigDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const gigId = params?.id as string;
  const supabase = supabaseBrowser();

  const [gig, setGig] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [poster, setPoster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appCount, setAppCount] = useState(0);
  const [acceptedCount, setAcceptedCount] = useState(0);

  // Apply Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [offerPitch, setOfferPitch] = useState("");

  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    async function loadGig() {
      if (!gigId) return;
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Fetch user's worker profile for profile gate
      if (user) {
        const { data: profileData } = await supabase
          .from('users')
          .select('skills, resume_url, portfolio_links, name, phone, upi_id, kyc_status, kyc_verified')
          .eq('id', user.id)
          .single();
        if (profileData) setUserProfile(profileData);
      }

      const { data: gigData } = await supabase
        .from('gigs')
        .select('*')
        .eq('id', gigId)
        .single();
        
      if (gigData) {
        setGig(gigData);
        const { data: posterData } = await supabase
          .from('users')
          .select('name, avatar_url, rating, college')
          .eq('id', gigData.poster_id)
          .single();
        setPoster(posterData);

        // Get application count
        const { count: totalApps } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('gig_id', gigId);
        setAppCount(totalApps || 0);

        // Get accepted count
        const { count: acceptedApps } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('gig_id', gigId)
          .eq('status', 'accepted');
        setAcceptedCount(acceptedApps || 0);
      }
      setLoading(false);
    }
    loadGig();
  }, [gigId, supabase]);

  const handleApply = async () => {
    if (!currentUser) return router.push(`/login?next=/gig/${gigId}`);

    // Profile gate: skills OR resume, plus a phone number.
    //
    // UPI deliberately NOT required here. Asking for bank details before someone
    // has earned a single rupee is the steepest possible ask at the least
    // motivated moment, and it gated every first application. It's collected at
    // payout time instead, where the user has money waiting and every reason to
    // provide it — see the payout flow and the ProfileCompletion nudge.
    const hasSkills = userProfile?.skills && userProfile.skills.length > 0;
    const hasResume = !!userProfile?.resume_url;
    const hasPhone = !!userProfile?.phone;

    if ((!hasSkills && !hasResume) || !hasPhone) {
      toast.error("Please complete your profile to continue.");
      router.push(`/profile/worker-setup?from=apply&gigId=${gigId}`);
      return;
    }

    // Company tasks are verified-only (enforced server-side too). Checking here
    // means the gate appears BEFORE someone writes a pitch, not after.
    if (isCompanyTask && !(userProfile?.kyc_verified || userProfile?.kyc_status === "approved")) {
      toast.error("Company tasks need a verified student ID — it takes about a minute.");
      router.push(`/verify-id?next=/gig/${gigId}`);
      return;
    }

    setIsApplying(true);

    try {
      const res = await fetch("/api/gig/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId,
          offerPitch,
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(friendlyHttpError(res.status, errorData?.error));
        return;
      }

      toast.success("Application submitted successfully!");
      router.push(`/chat/${gigId}`);
    } catch (err: any) {
      toast.error(friendlyError(err));
    } finally {
      setIsApplying(false);
    }
  };

  const handleMessagePoster = () => {
    if (!currentUser) return router.push(`/login?next=/gig/${gigId}`);
    router.push(`/chat/${gigId}`);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/gig/${gigId}`);
      toast.success("Gig link copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0B0B11] text-white">
      <div className="sticky top-0 z-30 bg-white/[0.02] backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-2xl mx-auto flex items-center justify-between p-4 px-6 md:px-0">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-6 md:px-0 py-8 space-y-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-3/4" />
        <div className="flex items-center gap-3 pt-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="bg-[#13131A] border border-white/[0.08] rounded-2xl p-6 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
  if (!gig) return <div className="h-screen bg-[#0B0B11] flex flex-col gap-4 justify-center items-center text-white"><p className="text-white/50">Gig not found.</p><button onClick={() => router.push('/dashboard')} className="text-[#C9A9FF] text-sm font-medium">← Back to dashboard</button></div>;

  const isCompanyTask = gig.listing_type === 'COMPANY_TASK';
  // Both flavours render the same brand purple accent; no off-brand indigo.
  const accentColor = '#8825F5';
  const isMyGig = currentUser?.id === gig.poster_id;
  const safeDate = gig.created_at?.endsWith("Z") || gig.created_at?.includes("+") ? gig.created_at : `${gig.created_at}Z`;
  const timeAgo = gig.created_at ? getTimeAgo(new Date(safeDate)) : '';

  return (
    <div className={`min-h-[100dvh] bg-[#0B0B11] text-white selection:bg-[#8825F5]/30 selection:text-white pb-36 font-sans relative`}>
      {/* Background Atmosphere */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#8825F5]/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-40 left-0 w-[400px] h-[400px] bg-[#8825F5]/10 rounded-full blur-[150px] pointer-events-none" />

      {/* TOP HEADER BAR */}
      <div className={`sticky top-0 z-30 bg-white/[0.02] backdrop-blur-2xl border-b border-white/5 transition`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between p-4 px-6 md:px-0">
          <button onClick={() => (window.history.length > 2 && document.referrer.includes(window.location.host)) ? router.back() : router.push('/dashboard')} className={`flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium`}>
            <ArrowLeft size={16} /> Return
          </button>
          <div className="flex items-center gap-3">
            <button onClick={handleShare} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
              <Share2 size={14} /> Share
            </button>
            <StatusBadge tone={gig.status === 'open' ? 'success' : statusToTone(gig.status)}>
              {humanizeStatus(gig.status)}
            </StatusBadge>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-10 animate-in fade-in duration-500">

        {/* IMAGES — Gallery with navigation */}
        <GigImageGallery gig={gig} supabase={supabase} isCompanyTask={isCompanyTask} />

        {/* TITLE + PRICE */}
        <div className="space-y-4 relative z-10 px-2 md:px-0 mb-10">
          <div className="space-y-2">
            {isCompanyTask && <span className="text-xs font-semibold text-[#C9A9FF] mb-2 inline-flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#8825F5] animate-pulse"></div> Company Task</span>}
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight leading-tight text-white">{gig.title}</h1>
          </div>
          
          <div className="flex items-center gap-6 mt-4 flex-wrap">
            <div className={`text-4xl md:text-5xl font-black tracking-tighter flex items-center gap-1 ${isCompanyTask ? 'text-white' : 'text-transparent bg-clip-text bg-gradient-to-br from-purple-400 to-[#C084FC]'}`}>
              <span className="text-2xl font-light opacity-50 mr-1">₹</span>{gig.price}
            </div>
            <div className="flex items-center gap-5 border-l border-white/10 pl-6 h-10">
               {gig.location && (
                 <span className="flex items-center gap-2 text-sm font-medium text-zinc-400"><MapPin size={16} /> {gig.location}</span>
               )}
               {timeAgo && (
                 <span className="flex items-center gap-2 text-sm font-medium text-zinc-400"><Clock size={16} /> {timeAgo}</span>
               )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-white/5">
            <span className={`px-4 py-1.5 text-xs font-semibold rounded-full border ${
              isCompanyTask ? 'bg-white/10 text-white border-white/20' : 'bg-[#8825F5]/10 text-[#C9A9FF] border-[#8825F5]/20'
            }`}>
              {gig.listing_type === 'COMPANY_TASK' ? 'Company Task' : gig.listing_type === 'HUSTLE' ? 'Hustle' : gig.listing_type}
            </span>
            {gig.category && (
              <span className={`px-4 py-1.5 text-xs font-medium rounded-full border border-white/10 text-zinc-400 bg-white/5`}>
                {gig.category}
              </span>
            )}
            {gig.max_workers > 1 && (
              <span className="px-4 py-1.5 text-xs font-medium rounded-full border border-[#8825F5]/20 text-[#C9A9FF] bg-[#8825F5]/5 flex items-center gap-2">
                <Users size={14} /> {acceptedCount} of {gig.max_workers} positions
              </span>
            )}
            {appCount > 0 && gig.max_workers <= 1 && (
              <span className="px-4 py-1.5 text-xs font-medium rounded-full border border-[#8825F5]/20 text-[#C9A9FF] bg-[#8825F5]/5 flex items-center gap-2">
                <Users size={14} /> {appCount} applied
              </span>
            )}
          </div>
        </div>

        {/* POSTER CARD */}
        {poster && (
          <div className={`p-8 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md flex items-center gap-6 shadow-lg shadow-black/20`}>
            <div className={`w-20 h-20 rounded-full border border-white/20 overflow-hidden bg-white/5 shrink-0 shadow-inner group-hover:border-[#8825F5]/50 transition`}>
              {poster.avatar_url ? (
                <Image src={poster.avatar_url} alt="Poster" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-zinc-600 uppercase">{poster.name?.[0]}</div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-bold text-xl text-white tracking-tight truncate">{poster.name}</p>
              <p className="text-[13px] font-medium text-zinc-400 bg-white/5 px-2 py-1 rounded-md inline-block mt-2 border border-white/5">
                {!isCompanyTask && <>{poster.college || 'EXTERNAL_ORG'} &bull; </>}
                {poster.rating ? `${poster.rating} RATIO` : 'NEW_UNIT'}
              </p>
            </div>
            {!isMyGig && (
              <button 
                onClick={handleMessagePoster}
                className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition hover:scale-105 active:scale-95 shadow-sm`}
              >
                <MessageCircle size={20} />
              </button>
            )}
          </div>
        )}

        {/* DESCRIPTION */}
        <div className={`p-8 md:p-10 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md relative overflow-hidden shadow-lg shadow-black/20 mt-8`}>
          <h2 className="text-sm font-semibold text-zinc-300 mb-6 flex items-center gap-3">
             <span className="w-4 h-px bg-zinc-500"></span> Task Details
          </h2>
          <p className="text-zinc-200 text-[15px] leading-[1.8] font-medium whitespace-pre-wrap">{gig.description}</p>

          {/* PDF/Document Attachments */}
          {gig.images && gig.images.filter(isDocAttachment).length > 0 && (
            <div className="mt-8 pt-6 border-t border-white/5 space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2"><FileText size={14} /> Attachments</h3>
              <div className="flex flex-wrap gap-3">
                {gig.images.filter(isDocAttachment).map((doc: string, i: number) => {
                  const docUrl = supabase.storage.from('gig-images').getPublicUrl(doc).data.publicUrl;
                  // Stored as `<uid>/<timestamp>_<name>` — strip the prefix for display.
                  const fileName = (doc.split('/').pop() || `Document ${i + 1}`).replace(/^\d+_/, '');
                  return (
                    <a key={i} href={docUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl hover:bg-white/[0.06] hover:border-[#8825F5]/30 transition group">
                      <div className="w-10 h-10 rounded-lg bg-[#8825F5]/10 flex items-center justify-center shrink-0"><FileText size={18} className="text-[#C9A9FF]" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{fileName}</p>
                        <p className="text-[10px] text-zinc-500 uppercase">{attachmentLabel(doc)} · Click to view</p>
                      </div>
                      <Download size={14} className="text-zinc-500 group-hover:text-[#C9A9FF] transition-colors shrink-0" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* DEADLINE */}
        {gig.deadline && (
          <div className={`p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md flex items-center gap-5 shadow-lg shadow-amber-500/5`}>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
               <Clock size={20} className={`text-amber-400`} />
            </div>
            <div>
              <p className={`text-xs font-semibold text-amber-500 mb-1`}>Deadline</p>
              <p className="text-sm text-zinc-300 font-medium">{new Date(gig.deadline).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        )}

      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      {!isMyGig && gig.status === 'open' && (
        <div className={`fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#0B0B11] via-[#0B0B11]/95 to-transparent z-40 safe-area-bottom backdrop-blur-sm pointer-events-none`}>
          <div className="max-w-2xl mx-auto flex gap-4 pointer-events-auto">
            <button 
              onClick={handleMessagePoster} 
              className={`flex-shrink-0 w-14 h-14 md:w-auto md:px-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white font-semibold text-sm transition active:scale-95 flex items-center justify-center gap-3 backdrop-blur-xl shadow-lg`}
            >
              <MessageCircle size={22} />
              <span className="hidden md:inline">Inquiry</span>
            </button>
            <button 
              onClick={() => setIsApplyModalOpen(true)} 
              className={`flex-1 py-4 bg-white text-black hover:bg-zinc-200 transition font-semibold text-[15px] rounded-full active:scale-95 flex items-center justify-center gap-3 shadow-[0_4px_14px_0_rgb(255,255,255,0.39)]`}
            >
              <Send size={18} /> Apply for Task
            </button>
          </div>
        </div>
      )}

      {/* APPLICATION MODAL */}
      {isApplyModalOpen && (
        <ApplicationModal 
          isOpen={isApplyModalOpen} 
          onClose={() => setIsApplyModalOpen(false)}
          gig={gig}
          currentUser={currentUser}
          handleApply={handleApply}
          isApplying={isApplying}
          offerPitch={offerPitch}
          setOfferPitch={setOfferPitch}
          isCompanyTask={isCompanyTask}
        />
      )}

    </div>
  );
}

function ApplicationModal({ isOpen, onClose, gig, currentUser, handleApply, isApplying, offerPitch, setOfferPitch, isCompanyTask }: any) {
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0B0B11]/90 backdrop-blur-md p-3 sm:p-4 flex items-end sm:items-center justify-center overscroll-none" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-[#0A0A0A] border border-white/10 p-5 md:p-10 rounded-3xl w-full max-w-xl relative animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300 shadow-2xl shadow-black/80 max-h-[90vh] overflow-y-auto no-scrollbar overscroll-contain`}>
        
        <button onClick={onClose} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full border border-white/5">
            <X size={20} />
        </button>
        
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Connect & Apply</h2>
        <p className="text-sm font-medium text-zinc-400 mb-10">How would you like to get paid?</p>

        <div className="space-y-10">
            
            {/* PAYMENT — ESCROW ONLY.
                This used to be a choice, with Direct Connect labelled "No
                Platform Fee" and escrow gated behind price >= 500. Since the
                median gig is Rs 499, most applicants could not pick escrow even
                if they wanted to — 223 of 267 applications went Direct, taking
                the money, the protection and the fee off-platform. Both the
                choice and the price gate are gone; the server forces ESCROW. */}
            <div className="space-y-4">
              <label className="text-xs font-semibold text-zinc-400 block mb-4">Payment</label>

              <div className="p-4 md:p-6 rounded-2xl border border-[#8825F5]/30 bg-[#8825F5]/[0.08]">
                <div className="flex items-center justify-between w-full gap-3">
                  <p className="font-bold text-base md:text-lg tracking-tight text-white flex items-center gap-2">
                    <ShieldCheck size={18} className="text-[#C9A9FF]" /> Protected Payment
                  </p>
                  <span className="px-3 py-1 text-[10px] font-semibold rounded-full border bg-[#8825F5]/20 text-[#C9A9FF] border-[#8825F5]/30 whitespace-nowrap">
                    Protected
                  </span>
                </div>
                <p className="text-xs md:text-[13px] font-medium text-zinc-400 leading-relaxed mt-3">
                  The poster funds the task before you start, and we hold it. Finish the work and
                  the money is released to you — they can&apos;t disappear with it.
                </p>
                {/* Reassurance at the exact moment of doubt. "Will I actually get
                    paid, and when?" is the question every applicant has here, and
                    leaving it unanswered is why people push to settle over UPI
                    instead. Concrete timing beats vague promises. */}
                <ul className="mt-4 space-y-2 text-[12px] text-zinc-400 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <Check size={13} className="text-[#C9A9FF] shrink-0 mt-0.5" />
                    Money is locked before you start — you never work unpaid.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={13} className="text-[#C9A9FF] shrink-0 mt-0.5" />
                    After you deliver, the poster has 24 hours to approve. If they don&apos;t,
                    it releases to you automatically.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={13} className="text-[#C9A9FF] shrink-0 mt-0.5" />
                    Payouts go to your UPI. Add it after you&apos;re hired — not now.
                  </li>
                </ul>
                <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
                  A small platform fee is deducted from your payout only when you actually get paid.
                </p>
              </div>
            </div>

            {/* Company tasks are real businesses with real budgets and a
                reputation to protect. Set expectations BEFORE the pitch, not in
                a terms blob after it — a student who reads this and backs out is
                a better outcome than one who ghosts a paying company. */}
            {isCompanyTask && (
              <div className="p-4 md:p-5 rounded-2xl border border-[#8825F5]/25 bg-[#8825F5]/[0.06] space-y-3">
                <p className="text-[13px] font-bold text-white flex items-center gap-2">
                  <Building2 size={15} className="text-[#C9A9FF]" />
                  Before you apply to a company task
                </p>
                <ul className="space-y-2 text-[12px] text-zinc-400 leading-relaxed">
                  {[
                    "Only apply if you can genuinely deliver this — companies rate you, and it sticks to your profile.",
                    "Reply within 24 hours once they message you. Going quiet loses the task and hurts your score.",
                    "Hit the deadline you agree to. Ask for more time before it passes, never after.",
                    "Keep everything on the platform. We hold the payment and release it when the work is approved.",
                  ].map((rule) => (
                    <li key={rule} className="flex items-start gap-2">
                      <Check size={13} className="text-[#C9A9FF] shrink-0 mt-0.5" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-4">
              <label className="text-xs font-semibold text-zinc-400 block">Application Pitch</label>
              <textarea 
                value={offerPitch}
                onChange={e => setOfferPitch(e.target.value)}
                placeholder="Explain why you're a good fit for this gig…"
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-sm font-medium text-white outline-none focus:border-[#8825F5]/50 focus:ring-1 focus:ring-[#8825F5]/50 resize-none transition placeholder:text-zinc-600 shadow-inner"
                rows={4}
              />
            </div>

            {/* TERMS & CONDITIONS CHECKBOX */}
            <div className="pt-4 border-t border-white/5 mt-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                 <div className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition ${termsAccepted ? 'bg-[#8825F5] border-[#8825F5]' : 'bg-black/50 border-white/20 group-hover:border-[#8825F5]/50'}`}>
                    {termsAccepted && <Check size={14} className="text-white" />}
                 </div>
                 <input 
                   type="checkbox" 
                   className="hidden" 
                   checked={termsAccepted} 
                   onChange={(e) => setTermsAccepted(e.target.checked)} 
                 />
                 <span className={`text-xs md:text-sm font-medium transition-colors ${termsAccepted ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                   I understand the requirements of this task, accept the deadlines, and commit to its complete viability. I am responsible for delivering the expected quality.
                 </span>
              </label>
            </div>

            <button 
              onClick={handleApply}
              disabled={isApplying || !termsAccepted}
              className={`w-full py-4 text-[15px] font-semibold rounded-full transition flex items-center justify-center gap-3 ${
                (isApplying || !termsAccepted) 
                ? 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5' 
                : 'bg-white text-black hover:bg-zinc-200 active:scale-95 shadow-[0_4px_14px_0_rgb(255,255,255,0.39)]'
              }`}
            >
              {isApplying ? <Loader2 className="animate-spin w-5 h-5" /> : "Submit Application"}
            </button>

        </div>
      </div>
    </div>
  );
}

// --- Image Gallery Component ---
function GigImageGallery({ gig, supabase, isCompanyTask }: { gig: any; supabase: any; isCompanyTask: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Gallery shows real images only; every other type renders as a download card.
  const imageFiles = (gig.images || []).filter(isImageAttachment);

  if (imageFiles.length === 0) {
    // Default fallback — branded gradient with category
    return (
      <div className="w-full aspect-video rounded-3xl border border-white/10 overflow-hidden relative shadow-2xl shadow-black/50 bg-gradient-to-br from-[#8825F5]/20 via-[#13131A] to-[#0B0B11] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#8825F5]/10 border border-[#8825F5]/20 flex items-center justify-center mx-auto">
            <FileText size={28} className="text-[#C9A9FF]" />
          </div>
          <p className="text-sm font-medium text-zinc-500">{gig.category || gig.listing_type}</p>
        </div>
      </div>
    );
  }

  const prev = () => setCurrentIndex(i => (i === 0 ? imageFiles.length - 1 : i - 1));
  const next = () => setCurrentIndex(i => (i === imageFiles.length - 1 ? 0 : i + 1));

  return (
    <div className="w-full aspect-video rounded-3xl border border-white/10 bg-white/5 overflow-hidden relative shadow-2xl shadow-black/50 group">
      <Image 
        src={supabase.storage.from('gig-images').getPublicUrl(imageFiles[currentIndex]).data.publicUrl}
        alt={`Task image ${currentIndex + 1}`}
        fill
        className="object-cover transition-transform duration-700 group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 672px"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B11]/80 via-transparent to-transparent"></div>
      
      {/* Navigation arrows */}
      {imageFiles.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
            <ChevronLeft size={20} />
          </button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
            <ChevronRight size={20} />
          </button>
          {/* Dots */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {imageFiles.map((_: any, i: number) => (
              <button key={i} onClick={() => setCurrentIndex(i)} className={`w-2 h-2 rounded-full transition ${i === currentIndex ? 'bg-white w-5' : 'bg-white/40 hover:bg-white/60'}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
