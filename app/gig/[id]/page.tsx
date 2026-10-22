"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { ArrowLeft, ArrowRight, MapPin, ShieldCheck, Building2, MessageCircle, Clock, Users, Send, AlertTriangle, X, Check, ChevronLeft, ChevronRight, FileText, Download, Share2 } from "lucide-react";
import StatusBadge, { statusToTone, humanizeStatus } from "@/components/ui/StatusBadge";
import Skeleton from "@/components/ui/Skeleton";
import Image from "next/image";
import Link from "next/link";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { toast } from "sonner";
import { friendlyError, friendlyHttpError } from "@/lib/errors";
import { isDocAttachment, isImageAttachment, attachmentLabel } from "@/lib/attachments";
import { platformFeeFor, audienceForGig, PLATFORM_FEES } from "@/lib/fees";
import { blurOnWheel } from "@/lib/inputs";
import { isServiceAdvert, browserActionLabel, listingTypeLabel } from "@/lib/gigRoles";

import { openChatDock } from "@/lib/chatDock";
// Same display face the workspace headings use; falls back to the marketing
// face when a company account sees this page outside the shell.
const DISPLAY = { fontFamily: "var(--font-display), 'Space Grotesk', sans-serif" };

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
  // What the applicant wants to be paid (or, on an advert, the budget the
  // customer is offering). The API, the applicant list and /api/gig/hire have
  // all read applications.negotiated_price the whole time — there was simply no
  // field anywhere in the product that set it, so every hire happened at the
  // asking price and the two offer modals in /chat and /messages are dead code
  // that nothing opens.
  const [offerPrice, setOfferPrice] = useState("");

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

    // The skills-or-resume gate exists so a poster has something to judge an
    // applicant on. Someone HIRING is not being judged — asking a customer for
    // a CV before they may spend money is friction with nothing behind it. They
    // still need a phone number, because the provider has to reach them.
    if (isAdvert) {
      if (!hasPhone) {
        toast.error("Add a phone number so they can reach you.");
        router.push(`/onboarding?next=/gig/${gigId}`);
        return;
      }
    } else if ((!hasSkills && !hasResume) || !hasPhone) {
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
      // A service listing is a shopfront advert, so there is nothing to apply
      // to — the reader is a customer who wants to hire this person. Requesting
      // creates a NEW engagement where the customer is the poster and pays, and
      // the provider is the assigned worker and is paid, which is the only money
      // direction the rest of the lifecycle supports. See lib/gigRoles.ts.
      if (isAdvert) {
        const res = await fetch("/api/gig/request-service", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: gigId,
            brief: offerPitch,
            offerPrice: offerPrice ? Number(offerPrice) : undefined,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(friendlyHttpError(res.status, data?.error));
          return;
        }

        toast.success("Request sent — agree the details in chat, then pay to start.");
        openChat(data.gigId);
        return;
      }

      const res = await fetch("/api/gig/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId,
          offerPitch,
          offerPrice: offerPrice ? Number(offerPrice) : undefined,
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(friendlyHttpError(res.status, errorData?.error));
        return;
      }

      toast.success("Application submitted successfully!");
      openChat(gigId);
    } catch (err: any) {
      toast.error(friendlyError(err));
    } finally {
      setIsApplying(false);
    }
  };

  // Opens the conversation in the chat panel beside the page; only navigates
  // away if the panel is not on this screen.
  const openChat = (chatGigId: string) => {
    if (!openChatDock({ gigId: chatGigId, otherUserId: gig?.poster_id })) router.push(`/chat/${chatGigId}`);
  };

  const handleMessagePoster = () => {
    if (!currentUser) return router.push(`/login?next=/gig/${gigId}`);
    openChat(gigId);
  };

  const handleReport = async () => {
    if (!currentUser) return router.push(`/login?next=/gig/${gigId}`);

    const reason = window.prompt(
      "What is wrong with this listing?\n\nFor example: asks to pay outside the platform, misleading, offensive, or a scam."
    );
    if (reason === null) return;
    if (reason.trim().length < 5) {
      toast.error("Tell us briefly what is wrong so we can act on it.");
      return;
    }

    const toastId = toast.loading("Sending report...");
    try {
      const res = await fetch("/api/gig/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId: gigId,
          targetType: "gig",
          reason: reason.trim(),
          details: "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Could not send the report.", { id: toastId });
        return;
      }
      toast.success("Reported. Our team will review this listing.", { id: toastId, duration: 7000 });
    } catch (err: any) {
      toast.error(friendlyError(err), { id: toastId });
    }
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
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
        <Skeleton className="h-4 w-40 rounded-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
  if (!gig) return (
    <EmptyState
      icon={FileText}
      title="Gig not found"
      description="It may have been taken down, or the link is wrong."
      actionLabel="Back to dashboard"
      actionHref="/dashboard"
    />
  );

  const isCompanyTask = gig.listing_type === 'COMPANY_TASK';
  // A shopfront advert: the reader is a customer, not an applicant.
  const isAdvert = isServiceAdvert(gig);
  // A private engagement created by hiring someone from their advert. Nobody can
  // apply to it — it already has the person it was meant for.
  const isDirectRequest = Boolean(gig.source_service_id);
  const isMyGig = currentUser?.id === gig.poster_id;
  const safeDate = gig.created_at?.endsWith("Z") || gig.created_at?.includes("+") ? gig.created_at : `${gig.created_at}Z`;
  const timeAgo = gig.created_at ? getTimeAgo(new Date(safeDate)) : '';

  // The one place the page's action buttons are defined. Rendered twice — in the
  // price card on desktop and in a bar above the phone nav — so the two can
  // never drift apart.
  //
  // A gig created by hiring someone from their advert is addressed to one
  // person, who is already attached to it. /api/gig/apply refuses it with a
  // 403, so offering an Apply button here would be a button whose only
  // outcome is an error toast. The person it was sent to gets the reason
  // and a way to reply instead.
  const actions =
    !isMyGig && gig.status === 'open' ? (
      isDirectRequest ? (
        <div className="rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4">
          <p className="text-[14px] font-bold text-[var(--fg)]">This was sent to you directly</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--fg-muted)]">
            Reply to agree the details. They pay into escrow before you start.
          </p>
          <Button className="mt-3" fullWidth leftIcon={<MessageCircle size={16} />} onClick={handleMessagePoster}>
            Reply
          </Button>
        </div>
      ) : (
        <div className="flex gap-2.5">
          <Button
            variant="secondary"
            size="lg"
            onClick={handleMessagePoster}
            aria-label="Message the poster"
            leftIcon={<MessageCircle size={19} />}
            className="shrink-0 !px-4 sm:!px-6"
          >
            <span className="hidden sm:inline lg:hidden">Inquiry</span>
          </Button>
          {/* The verb has to match the direction of the listing. On a
              SERVICE the poster is the one being paid, so the reader is a
              customer about to hire — telling them to "apply for a task"
              described the opposite transaction, and 787 people followed it
              into a flow that never completed once. */}
          <Button
            size="lg"
            fullWidth
            onClick={() => setIsApplyModalOpen(true)}
            leftIcon={<Send size={18} />}
          >
            {browserActionLabel(gig)}
          </Button>
        </div>
      )
    ) : null;

  const takeHome = Number(gig.price) - platformFeeFor(Number(gig.price), audienceForGig(gig));

  return (
    <div className="pb-2">
      {/* TOP ROW */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          onClick={() => (window.history.length > 2 && document.referrer.includes(window.location.host)) ? router.back() : router.push('/dashboard')}
          className="inline-flex h-10 items-center gap-2 rounded-[10px] pr-3 text-[14px] font-bold text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleShare} leftIcon={<Share2 size={14} />}>
            Share
          </Button>
          {/* /api/gig/report existed with rate limiting and moderation behind
              it, but nothing anywhere in the product called it — there was no
              way for a student to flag a scam listing. */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReport}
            title="Report this listing"
            aria-label="Report this listing"
            className="w-10 px-0"
          >
            <AlertTriangle size={15} />
          </Button>
          <StatusBadge tone={gig.status === 'open' ? 'success' : statusToTone(gig.status)}>
            {humanizeStatus(gig.status)}
          </StatusBadge>
        </div>
      </div>

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* GALLERY + TITLE */}
        <div className="min-w-0 space-y-6">
          <GigImageGallery gig={gig} supabase={supabase} />

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {isCompanyTask ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-bold text-[var(--accent-ink)]">
                  <Building2 size={12} /> Company task
                </span>
              ) : (
                <span className="rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-bold text-[var(--accent-ink)]">
                  {/* Never the raw column — a service listing was rendering a badge
                      that literally read "SERVICE" in caps. */}
                  {listingTypeLabel(gig)}
                </span>
              )}
              {gig.category && (
                <span className="rounded-full border border-[var(--line)] bg-[var(--chip)] px-3 py-1 text-[12px] font-semibold text-[var(--fg-muted)]">
                  {gig.category}
                </span>
              )}
              {gig.max_workers > 1 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--chip)] px-3 py-1 text-[12px] font-semibold text-[var(--fg-muted)]">
                  <Users size={12} /> {acceptedCount} of {gig.max_workers} positions
                </span>
              )}
              {appCount > 0 && gig.max_workers <= 1 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--chip)] px-3 py-1 text-[12px] font-semibold text-[var(--fg-muted)]">
                  <Users size={12} /> {appCount} applied
                </span>
              )}
            </div>
            <h1
              className="text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[var(--fg)] sm:text-[40px]"
              style={DISPLAY}
            >
              {gig.title}
            </h1>
            <p className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] font-medium text-[var(--fg-muted)]">
              {gig.location && (
                <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {gig.location}</span>
              )}
              {timeAgo && (
                <span className="inline-flex items-center gap-1.5"><Clock size={15} /> Posted {timeAgo}</span>
              )}
            </p>
          </div>
        </div>

        {/* PRICE + POSTER */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-[96px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
            <p className="text-[13px] font-bold text-[var(--fg-faint)]">{isAdvert ? "Starting price" : "Budget"}</p>
            <p
              className="mt-1 flex items-baseline gap-1 text-[44px] font-extrabold leading-none tracking-[-0.03em] text-[var(--fg)]"
              style={DISPLAY}
            >
              <span className="text-[26px] font-bold text-[var(--fg-faint)]">₹</span>
              {gig.price != null ? Number(gig.price).toLocaleString("en-IN") : "—"}
            </p>
            {/* What the worker actually banks. The listed price is not the
                take-home, and finding that out only at payout is how you get
                an angry student and a dispute. */}
            {Number(gig.price) > 0 && (
              isAdvert ? (
                // An advert: the reader is a customer. Quote what they pay,
                // not a payout they will never receive — this block used to be
                // hidden entirely for SERVICE, so a service listing showed a
                // bare number with nothing explaining it at all.
                <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                  Starting price — you agree the final amount together. Held in escrow and released
                  only once you approve the work.
                </p>
              ) : (
                <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                  You receive <span className="font-bold text-[var(--fg)]">₹{takeHome.toLocaleString("en-IN")}</span>
                  {" "}after the {Math.round(PLATFORM_FEES[audienceForGig(gig)] * 100)}% platform fee
                </p>
              )
            )}

            {gig.deadline && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--warn-line)] bg-[var(--warn-soft)] p-3">
                <Clock size={18} className="mt-0.5 shrink-0 text-[var(--warn)]" />
                <div>
                  <p className="text-[12px] font-bold text-[var(--warn)]">Deadline</p>
                  <p className="text-[13px] font-medium text-[var(--fg)]">{new Date(gig.deadline).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            )}

            {actions && <div className="mt-5 hidden lg:block">{actions}</div>}
            {isMyGig && (
              <div className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--chip)] p-3.5">
                <p className="text-[13px] font-bold text-[var(--fg)]">This is your task</p>
                <Link
                  href={`/gig/${gigId}/applicants`}
                  className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-bold text-[var(--accent-ink)] hover:underline"
                >
                  See who applied <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </section>

          {/* POSTER CARD */}
          {poster && (
            <section className="flex items-center gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[var(--line)] bg-[var(--chip)]">
                {poster.avatar_url ? (
                  <Image src={poster.avatar_url} alt="Poster" width={48} height={48} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-bold uppercase text-[var(--fg-faint)]">{poster.name?.[0]}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-[var(--fg)]">{poster.name}</p>
                <p className="truncate text-[13px] text-[var(--fg-muted)]">
                  {!isCompanyTask && <>{poster.college || 'Independent'} &bull; </>}
                  {poster.rating ? `★ ${poster.rating}` : 'New'}
                </p>
              </div>
              {!isMyGig && (
                <button
                  onClick={handleMessagePoster}
                  aria-label="Message the poster"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--chip)] text-[var(--fg)] transition-colors hover:bg-[var(--chip-strong)]"
                >
                  <MessageCircle size={18} />
                </button>
              )}
            </section>
          )}
        </aside>

        {/* DESCRIPTION */}
        <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 md:p-7 lg:col-start-1">
          <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--fg)]" style={DISPLAY}>
            Task details
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-[16px] leading-[1.75] text-[var(--fg)]">{gig.description}</p>

          {/* PDF/Document Attachments */}
          {gig.images && gig.images.filter(isDocAttachment).length > 0 && (
            <div className="mt-7 space-y-3 border-t border-[var(--line)] pt-5">
              <h3 className="flex items-center gap-2 text-[13px] font-bold text-[var(--fg-muted)]"><FileText size={14} /> Attachments</h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {gig.images.filter(isDocAttachment).map((doc: string, i: number) => {
                  const docUrl = supabase.storage.from('gig-images').getPublicUrl(doc).data.publicUrl;
                  // Stored as `<uid>/<timestamp>_<name>` — strip the prefix for display.
                  const fileName = (doc.split('/').pop() || `Document ${i + 1}`).replace(/^\d+_/, '');
                  return (
                    <a key={i} href={docUrl} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3.5 py-3 transition-colors hover:border-[var(--accent-line)] hover:bg-[var(--accent-soft)]">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)]"><FileText size={18} className="text-[var(--accent-ink)]" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-[var(--fg)]">{fileName}</p>
                        <p className="text-[11px] text-[var(--fg-muted)]">{attachmentLabel(doc)} · Click to view</p>
                      </div>
                      <Download size={14} className="shrink-0 text-[var(--fg-faint)] transition-colors group-hover:text-[var(--accent-ink)]" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* PHONE ACTION BAR — sits above the 60px bottom nav, not under it. */}
      {actions && (
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[0_10px_30px_rgba(45,25,55,0.14)] backdrop-blur lg:hidden">
          {actions}
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
          offerPrice={offerPrice}
          setOfferPrice={setOfferPrice}
          isCompanyTask={isCompanyTask}
        />
      )}

    </div>
  );
}

function ApplicationModal({ isOpen, onClose, gig, currentUser, handleApply, isApplying, offerPitch, setOfferPitch, offerPrice, setOfferPrice, isCompanyTask }: any) {
  // On an advert the person in this modal is buying, not applying. Every label
  // below has to say so, or the screen contradicts the button that opened it.
  const isAdvert = isServiceAdvert(gig || {});
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const field =
    "w-full rounded-xl border border-[var(--line-strong)] bg-[var(--surface)] text-[15px] font-medium text-[var(--fg)] outline-none transition placeholder:text-[var(--fg-faint)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-line)]";

  return (
    <div className="modal-overlay fixed inset-0 z-[100] flex items-end justify-center overscroll-none bg-[#2d1937]/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-title"
        className="no-scrollbar relative max-h-[92dvh] w-full max-w-xl animate-in slide-in-from-bottom-8 overflow-y-auto overscroll-contain rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl duration-300 sm:zoom-in-95 sm:rounded-3xl sm:p-8"
      >

        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--chip)] text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]">
            <X size={18} />
        </button>

        <h2 id="apply-title" className="pr-12 text-[26px] font-extrabold tracking-[-0.02em] text-[var(--fg)]" style={DISPLAY}>{isAdvert ? "Request this service" : "Connect & Apply"}</h2>
        <p className="mb-7 mt-1.5 text-[14px] text-[var(--fg-muted)]">{isAdvert ? "Tell them what you need. You pay once you have agreed the details." : "How would you like to get paid?"}</p>

        <div className="space-y-7">

            {/* PAYMENT — ESCROW ONLY.
                This used to be a choice, with Direct Connect labelled "No
                Platform Fee" and escrow gated behind price >= 500. Since the
                median gig is Rs 499, most applicants could not pick escrow even
                if they wanted to — 223 of 267 applications went Direct, taking
                the money, the protection and the fee off-platform. Both the
                choice and the price gate are gone; the server forces ESCROW. */}
            <div className="space-y-3">
              <label className="block text-[13px] font-bold text-[var(--fg-muted)]">Payment</label>

              <div className="rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] p-4 md:p-5">
                <div className="flex w-full items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-[16px] font-bold tracking-tight text-[var(--fg)]">
                    <ShieldCheck size={18} className="text-[var(--accent-ink)]" /> Protected Payment
                  </p>
                  <span className="whitespace-nowrap rounded-full border border-[var(--accent-line)] bg-[var(--surface)] px-3 py-1 text-[11px] font-bold text-[var(--accent-ink)]">
                    Protected
                  </span>
                </div>
                {/* Reassurance at the exact moment of doubt — but the doubt is
                    not the same on both sides. An applicant is asking "will I
                    actually get paid?"; a customer is asking "what happens to my
                    money?". Showing the worker's answers to a buyer promised them
                    a payout into their own UPI, which is the opposite of the
                    transaction they are actually in. */}
                {isAdvert ? (
                  <>
                    <p className="mt-3 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                      Nothing is charged now. Once you have agreed the details you pay into escrow —
                      we hold it, and release it to them only when you approve the work.
                    </p>
                    <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                      <li className="flex items-start gap-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-[var(--accent-ink)]" />
                        Sending a request costs nothing and commits you to nothing.
                      </li>
                      <li className="flex items-start gap-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-[var(--accent-ink)]" />
                        Your money is held by us, not sent to them — they cannot take it and vanish.
                      </li>
                      <li className="flex items-start gap-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-[var(--accent-ink)]" />
                        If the work is not what you agreed, ask for changes or raise a dispute and we review it.
                      </li>
                    </ul>
                    <p className="mt-3 text-[12px] leading-relaxed text-[var(--fg-faint)]">
                      Keep it on the platform — paying by UPI directly voids this protection.
                    </p>
                  </>
                ) : (
                  <>
                  <p className="mt-3 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                    The poster funds the task before you start, and we hold it. Finish the work and
                    the money is released to you — they can&apos;t disappear with it.
                  </p>
                  {/* Reassurance at the exact moment of doubt. "Will I actually get
                      paid, and when?" is the question every applicant has here, and
                      leaving it unanswered is why people push to settle over UPI
                      instead. Concrete timing beats vague promises. */}
                  <ul className="mt-4 space-y-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                    <li className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-[var(--accent-ink)]" />
                      Money is locked before you start — you never work unpaid.
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-[var(--accent-ink)]" />
                      After you deliver, the poster has 24 hours to approve. If they don&apos;t,
                      it releases to you automatically.
                    </li>
                    <li className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-[var(--accent-ink)]" />
                      Payouts go to your UPI. Add it after you&apos;re hired — not now.
                    </li>
                  </ul>
                  <p className="mt-3 text-[12px] leading-relaxed text-[var(--fg-faint)]">
                    A small platform fee is deducted from your payout only when you actually get paid.
                  </p>
                  </>
                )}
              </div>
            </div>

            {/* Company tasks are real businesses with real budgets and a
                reputation to protect. Set expectations BEFORE the pitch, not in
                a terms blob after it — a student who reads this and backs out is
                a better outcome than one who ghosts a paying company. */}
            {isCompanyTask && (
              <div className="space-y-3 rounded-2xl border border-[var(--line-strong)] bg-[var(--chip)] p-4 md:p-5">
                <p className="flex items-center gap-2 text-[14px] font-bold text-[var(--fg)]">
                  <Building2 size={15} className="text-[var(--accent-ink)]" />
                  Before you apply to a company task
                </p>
                <ul className="space-y-2 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                  {[
                    "Only apply if you can genuinely deliver this — companies rate you, and it sticks to your profile.",
                    "Reply within 24 hours once they message you. Going quiet loses the task and hurts your score.",
                    "Hit the deadline you agree to. Ask for more time before it passes, never after.",
                    "Keep everything on the platform. We hold the payment and release it when the work is approved.",
                  ].map((rule) => (
                    <li key={rule} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-[var(--accent-ink)]" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Naming a price. On a task the applicant is quoting for the job;
                on an advert the customer is saying what the job is worth to
                them. Either way it lands in applications.negotiated_price, which
                the applicant list displays and /api/gig/hire charges — a chain
                that was already complete except for this input. */}
            <div className="space-y-3">
              <label htmlFor="apply-price" className="block text-[13px] font-bold text-[var(--fg-muted)]">
                {isAdvert ? "Your budget" : "Your price"}
                <span className="ml-1.5 font-medium text-[var(--fg-faint)]">optional</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-medium text-[var(--fg-faint)]">₹</span>
                <input
                  id="apply-price"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={offerPrice}
                  onChange={(e: any) => setOfferPrice(e.target.value)}
                  onWheel={blurOnWheel}
                  placeholder={String(gig?.price ?? "")}
                  className={`${field} h-12 pl-9 pr-4`}
                />
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--fg-faint)]">
                {isAdvert
                  ? `They ask from ₹${gig?.price ?? 0}. Offer more if the job is bigger — you agree the final amount together.`
                  : `Leave blank to accept the listed ₹${gig?.price ?? 0}. The poster sees your number and can hire you at it.`}
              </p>
            </div>

            <div className="space-y-3">
              <label htmlFor="apply-pitch" className="block text-[13px] font-bold text-[var(--fg-muted)]">{isAdvert ? "What do you need?" : "Application Pitch"}</label>
              <textarea
                id="apply-pitch"
                value={offerPitch}
                onChange={e => setOfferPitch(e.target.value)}
                placeholder={isAdvert ? "Describe the work, any deadline, and anything they should know…" : "Explain why you're a good fit for this gig…"}
                className={`${field} resize-none p-4 leading-relaxed`}
                rows={4}
              />
            </div>

            {/* TERMS & CONDITIONS CHECKBOX */}
            <div className="mt-4 border-t border-[var(--line)] pt-5">
              <label className="group flex cursor-pointer items-start gap-3">
                 <input
                   type="checkbox"
                   className="peer sr-only"
                   checked={termsAccepted}
                   onChange={(e) => setTermsAccepted(e.target.checked)}
                 />
                 <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent-line)] ${termsAccepted ? 'border-[var(--accent)] bg-[var(--accent)]' : 'border-[var(--line-strong)] bg-[var(--surface)] group-hover:border-[var(--accent)]'}`}>
                    {termsAccepted && <Check size={14} className="text-[var(--on-accent)]" />}
                 </div>
                 <span className={`text-[13px] font-medium leading-relaxed transition-colors ${termsAccepted ? 'text-[var(--fg)]' : 'text-[var(--fg-muted)]'}`}>
                   I understand the requirements of this task, accept the deadlines, and commit to its complete viability. I am responsible for delivering the expected quality.
                 </span>
              </label>
            </div>

            {/* Restate the take-home at the moment of commitment. */}
            {Number(gig?.price) > 0 && (
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--chip)] p-4">
                <span className="text-[13px] text-[var(--fg-muted)]">If you are hired, you receive</span>
                <span className="text-[18px] font-extrabold text-[var(--fg)]">
                  ₹{Number(gig.price) - platformFeeFor(Number(gig.price), audienceForGig(gig))}
                  <span className="ml-1.5 text-[12px] font-medium text-[var(--fg-faint)]">
                    after {Math.round(PLATFORM_FEES[audienceForGig(gig)] * 100)}% fee
                  </span>
                </span>
              </div>
            )}

            <Button
              onClick={handleApply}
              disabled={!termsAccepted}
              loading={isApplying}
              size="lg"
              fullWidth
            >
              {isAdvert ? "Send request" : "Submit Application"}
            </Button>

        </div>
      </div>
    </div>
  );
}

// --- Image Gallery Component ---
function GigImageGallery({ gig, supabase }: { gig: any; supabase: any }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Gallery shows real images only; every other type renders as a download card.
  const imageFiles = (gig.images || []).filter(isImageAttachment);

  if (imageFiles.length === 0) {
    // Default fallback — branded tint with category
    return (
      <div className="relative flex h-28 w-full items-center gap-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-gradient-to-br from-[var(--accent-soft)] via-[var(--surface)] to-[var(--chip)] px-6 sm:h-32">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--accent-line)] bg-[var(--surface)]">
          <FileText size={26} className="text-[var(--accent-ink)]" />
        </div>
        <p className="text-[14px] font-bold text-[var(--fg-muted)]">{gig.category || listingTypeLabel(gig)}</p>
      </div>
    );
  }

  const prev = () => setCurrentIndex(i => (i === 0 ? imageFiles.length - 1 : i - 1));
  const next = () => setCurrentIndex(i => (i === imageFiles.length - 1 ? 0 : i + 1));

  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--chip)]">
      <Image
        src={supabase.storage.from('gig-images').getPublicUrl(imageFiles[currentIndex]).data.publicUrl}
        alt={`Task image ${currentIndex + 1}`}
        fill
        className="object-cover"
        sizes="(max-width: 1024px) 100vw, 760px"
      />

      {/* Navigation arrows — always visible: on a phone there is no hover to
          reveal them, so hiding them behind it removed the gallery entirely. */}
      {imageFiles.length > 1 && (
        <>
          <button onClick={prev} aria-label="Previous image" className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65">
            <ChevronLeft size={20} />
          </button>
          <button onClick={next} aria-label="Next image" className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65">
            <ChevronRight size={20} />
          </button>
          {/* Dots */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/35 px-2.5 py-1.5 backdrop-blur-md">
            {imageFiles.map((_: any, i: number) => (
              <button key={i} onClick={() => setCurrentIndex(i)} aria-label={`Image ${i + 1}`} className={`h-2 rounded-full transition-all ${i === currentIndex ? 'w-5 bg-white' : 'w-2 bg-white/50 hover:bg-white/75'}`} />
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
