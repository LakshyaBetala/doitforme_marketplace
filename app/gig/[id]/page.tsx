"use client";

import { toast } from "sonner";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { load } from '@cashfreepayments/cashfree-js';

import {
  Clock,
  MapPin,
  ShieldCheck,
  X,
  CheckCircle,
  Star,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RefreshCcw,
  Send,
  MessageSquare,
  User,
  Zap,
  ShoppingBag,
  Briefcase,
  ArrowUpRight,
  FileText,
  Download,
  Github,
  HelpCircle,
  Flag,
  Key,
  Eye,
  UploadCloud
} from "lucide-react";

// --- UTILITY ---
function timeAgo(dateString: string) {
  if (!dateString) return "";
  const safeDateString = dateString.endsWith("Z") || dateString.includes("+")
    ? dateString
    : `${dateString}Z`;
  const seconds = Math.floor((Date.now() - new Date(safeDateString).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface GigData {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string | null;
  is_physical: boolean;
  status: string;
  created_at: string;
  poster_id: string;
  assigned_worker_id?: string;
  delivery_link?: string;
  delivery_files?: string[];
  delivered_at?: string;
  images?: string[];
  dispute_reason?: string;
  deadline?: string;
  github_link?: string;
  escrow_status?: string;
  listing_type?: "HUSTLE" | "MARKET";
  market_type?: "SELL" | "RENT" | "REQUEST";
  security_deposit?: number;
  item_condition?: string;
  poster_email?: string;
  payment_status?: string;
}

interface UserProfile {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
    kyc_verified?: boolean;
  };
}

export default function GigDetailPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  // --- STATE ---
  const [gig, setGig] = useState<GigData | null>(null);
  const [posterDetails, setPosterDetails] = useState<any>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState("Establishing connection...");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isOwner, setIsOwner] = useState(false);
  const [isWorker, setIsWorker] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicantCount, setApplicantCount] = useState(0);

  const [deliveryLink, setDeliveryLink] = useState("");
  const [isBuying, setIsBuying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Report State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  // New Negotiation State
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerPitch, setOfferPitch] = useState("");
  const [rentDuration, setRentDuration] = useState(1);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [deductionAmount, setDeductionAmount] = useState(0);
  const [applications, setApplications] = useState<any[]>([]);

  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // Handshake State
  const [handshakeCode, setHandshakeCode] = useState<string | null>(null);
  const [inputCode, setInputCode] = useState(["", "", "", ""]);
  const [verifyingHandshake, setVerifyingHandshake] = useState(false);

  // V6 P2P Contact Reveal State
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactRevealed, setContactRevealed] = useState(false);

  // Cashfree SDK
  const [cashfree, setCashfree] = useState<any>(null);
  useEffect(() => {
    const mode = process.env.NODE_ENV === "production" ? "production" : "sandbox";
    load({ mode }).then((sdk: any) => setCashfree(sdk));
  }, []);

  // Delivery state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const [deliveryLinkInput, setDeliveryLinkInput] = useState("");
  const [isDelivering, setIsDelivering] = useState(false);
  const [deliveryDragOver, setDeliveryDragOver] = useState(false);

  // --- PAYMENT VERIFICATION ---
  const verifyPayment = useCallback(async (orderId: string, workerId: string, attempt = 1) => {
    setVerifyingPayment(true);
    setVerifyError(null);
    setVerifyMessage(attempt > 1 ? `Syncing with bank (Attempt ${attempt}/3)...` : "Verifying payment status...");

    try {
      if (attempt > 1) await new Promise(r => setTimeout(r, 2500));

      const res = await fetch("/api/payments/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, gigId: id, workerId })
      });

      const data = await res.json();

      if (data.success || data.message === "Transaction already processed") {
        setVerifyMessage("Success! Setting up your project room...");
        setTimeout(() => {
          window.location.href = `/gig/${id}`;
        }, 1500);
      } else {
        if (attempt < 3) {
          verifyPayment(orderId, workerId, attempt + 1);
        } else {
          setVerifyError(data.error || "Payment verification failed. If money was debited, it will reflect in 1-2 hours.");
          setVerifyingPayment(false);
        }
      }
    } catch (e) {
      console.error("Verification error:", e);
      if (attempt < 3) {
        verifyPayment(orderId, workerId, attempt + 1);
      } else {
        setVerifyError("Network error during verification. Please check your dashboard.");
        setVerifyingPayment(false);
      }
    }
  }, [id]);

  useEffect(() => {
    const paymentStatus = searchParams.get("payment");
    const orderId = searchParams.get("order_id");
    const workerId = searchParams.get("worker_id");

    if (paymentStatus === "verify" && orderId && workerId) {
      verifyPayment(orderId, workerId);
    }
  }, [searchParams, verifyPayment]);

  // --- DATA LOADING ---
  useEffect(() => {
    if (!id) return;
    const loadGigAndUser = async () => {
      try {
        setLoading(true);
        const { data: uData } = await supabase.auth.getUser();
        const currentUser = uData?.user;

        if (currentUser) {
          setUser({
            id: currentUser.id,
            email: currentUser.email,
            user_metadata: currentUser.user_metadata
          });
        }

        const { data: gigData, error: gigError } = await supabase
          .from("gigs")
          .select("*")
          .eq("id", id)
          .single();

        if (gigError || !gigData) throw new Error("Gig not found.");
        setGig(gigData);

        const posterId = gigData.poster_id;
        setIsOwner(currentUser?.id === posterId);
        setIsWorker(currentUser?.id === gigData.assigned_worker_id);

        if (posterId) {
          const { data: posterData } = await supabase
            .from("users")
            .select("email, kyc_verified, name, avatar_url, rating, rating_count, jobs_completed, phone, upi_id")
            .eq("id", posterId)
            .maybeSingle();
          setPosterDetails(posterData);
        }

        if (currentUser && currentUser.id !== posterId && !gigData.assigned_worker_id) {
          const { data: application } = await supabase
            .from("applications")
            .select("id")
            .eq("gig_id", id)
            .eq("worker_id", currentUser.id)
            .maybeSingle();
          if (application) setHasApplied(true);
        }

        if (currentUser?.id === posterId) {
          const { data: apps } = await supabase
            .from("applications")
            .select(`
              *,
              worker:users!worker_id(id, name, avatar_url, rating, rating_count, jobs_completed)
            `)
            .eq("gig_id", id);
          setApplications(apps || []);
          setApplicantCount(apps?.length || 0);
        }

        if (gigData.status === 'assigned' || gigData.escrow_status === 'HELD') {
          // Handshake code logic:
          // Poster (isOwner === true) DISPLAYS the code.
          // Worker (assigned_worker_id === user.id) INPUTS the code.
          // The RLS policy should allow both to see the escrow record.
          const { data: escrowData } = await supabase
            .from('escrow')
            .select('handshake_code')
            .eq('gig_id', id)
            .maybeSingle();

          if (escrowData?.handshake_code) {
            setHandshakeCode(escrowData.handshake_code);
          }
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadGigAndUser();

    const channel = supabase.channel(`gig_detail_${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gigs', filter: `id=eq.${id}` },
        (payload) => setGig((prev: any) => ({ ...prev, ...payload.new })))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, supabase]);

  useEffect(() => {
    if (gig?.status === 'assigned' && gig.assigned_worker_id === user?.id && gig.listing_type === 'MARKET' && gig.market_type !== 'RENT') {
      setContactRevealed(true);
    }
  }, [gig, user]);

  // --- HANDLERS ---
  const handleApplyNavigation = () => {
    if (!user) return toast.error("Please login to apply.");
    router.push(`/gig/${id}/apply`);
  };

  const handleBuy = async () => {
    if (!user) return toast.error("Please login to purchase.");

    // 1. Initial Application / Offer Step for ALL Market Gigs (including RENT)
    if (gig?.listing_type === 'MARKET' && status === 'open') {
      // Regardless of RENT, SELL, REQUEST, we want to make an offer first
      setShowOfferModal(true);
      return;
    }

    // 2. Gateway Payment Step (Only for RENT, after assignment)
    if (gig?.listing_type === 'MARKET' && gig?.market_type === 'RENT' && status === 'assigned') {
      const action = "Rent";
      // if (!confirm(`Are you sure you want to proceed to payment for this rental?`)) return;

      setIsBuying(true);
      try {
        const res = await fetch("/api/payments/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gigId: id })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to initiate payment");

        // START DEV MOCK BYPASS
        if (data.payment_session_id === "fake_session_123") {
          console.log("DEV MOCK: Bypassing Cashfree Checkout SDK for Rental & redirecting to verify");
          window.location.href = `/gig/${id}?payment=verify&order_id=${data.order_id}&worker_id=${user?.id}`;
          return;
        }
        // END DEV MOCK BYPASS

        // 4. Trigger Cashfree
        if (data.payment_session_id && cashfree) {
          cashfree.checkout({ paymentSessionId: data.payment_session_id });
        } else if (data.payment_link) {
          window.location.href = data.payment_link;
        } else {
          throw new Error("No payment session received");
        }
      } catch (err: any) {
        toast.error(err.message);
        setIsBuying(false);
      }
    }
  };

  const handleMakeOffer = async () => {
    const isRental = gig?.market_type === 'RENT';
    const basePrice = Number(gig?.price || 0);
    const finalOfferPrice = isRental ? basePrice * rentDuration : Number(offerPrice);

    if (!finalOfferPrice || finalOfferPrice <= 0) return toast.error("Please enter a valid price/duration.");

    setSubmitting(true);
    try {
      const defaultPitch = isRental
        ? `[Requested for ${rentDuration} Days] I'm interested in renting this item!`
        : "I'm interested in this item!";

      const customPitch = offerPitch
        ? (isRental ? `[Requested for ${rentDuration} Days] ${offerPitch}` : offerPitch)
        : defaultPitch;

      // FIX: Use dedicated Apply route
      const res = await fetch("/api/gig/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId: id,
          offerPitch: customPitch,
          offerPrice: finalOfferPrice // Send the negotiated total price
        })
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to submit offer.");
      }

      toast.success("Offer submitted! Waiting for poster approval.");
      setShowOfferModal(false);
      setHasApplied(true);
      // Refresh to show pending state
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptOffer = async (applicationId: string, workerId: string) => {
    if (gig?.listing_type === 'MARKET' && gig?.market_type === 'RENT') {
      // if (!confirm("Accept this offer? This will close the gig and reveal contact info.")) return;
      setIsAccepting(applicationId);
      try {
        const res = await fetch("/api/gig/accept-offer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId })
        });

        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error || "Failed to accept offer.");
        }

        const data = await res.json();
        toast.success("Offer Accepted! Opening chat...");

        // Redirect to chat with the worker
        const resolvedWorkerId = data.workerId || workerId;
        router.push(`/chat/${id}?chat=${id}_${resolvedWorkerId}`);

      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setIsAccepting(null);
      }
    } else {
      // Hustle or Sell gig - Poster pays Escrow to assign
      setIsAccepting(applicationId);
      await handleAssign(workerId);
      setIsAccepting(null);
    }
  };

  const handleRejectOffer = async (applicationId: string) => {
    // if (!confirm("Reject this offer?")) return;
    setIsRejecting(applicationId);
    try {
      const res = await fetch("/api/gig/reject-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId })
      });

      if (!res.ok) {
        throw new Error("Failed to reject offer.");
      }

      // Remove from list or update status
      setApplications(prev => prev.map(a => a.id === applicationId ? { ...a, status: 'rejected' } : a));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsRejecting(null);
    }
  };

  const handleDeliver = async () => {
    if (gig?.listing_type === "MARKET" && gig.market_type === "RENT") {
      setIsCompleting(true);
      try {
        const res = await fetch("/api/rental/return", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gigId: id }),
        });
        if (res.ok) window.location.reload();
        else throw new Error("Failed to mark as returned");
      } catch (e: any) { toast.error(e.message); }
      finally { setIsCompleting(false); }
      return;
    }

    // Physical Hustle: simple link submit (handshake handles the rest)
    if (gig?.is_physical && gig?.listing_type !== 'MARKET') {
      if (!deliveryLink.trim()) return toast.error("Please enter a delivery note or link.");
      setIsCompleting(true);
      try {
        const res = await fetch("/api/gig/deliver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gigId: id, workerId: user?.id, deliveryLink }),
        });
        if (res.ok) window.location.reload();
        else throw new Error("Submission failed");
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setIsCompleting(false);
      }
      return;
    }

    // Remote/online Hustle: open rich delivery modal
    setShowDeliveryModal(true);
  };

  const handleDeliverWork = async () => {
    if (deliveryFiles.length === 0 && !deliveryLinkInput.trim()) {
      return toast.error("Please upload at least one file or provide a link.");
    }
    setIsDelivering(true);
    try {
      const formData = new FormData();
      formData.append("gigId", id);
      formData.append("deliveryLink", deliveryLinkInput.trim());
      deliveryFiles.forEach(f => formData.append("files", f));

      const res = await fetch("/api/gig/deliver-files", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      toast.success("Work submitted! Poster has 12 hours to review.");
      setShowDeliveryModal(false);
      window.location.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsDelivering(false);
    }
  };

  const handleAssign = async (workerId: string) => {
    // if (!confirm("Are you sure you want to assign this gig to this worker?")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/gig/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id, workerId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign.");

      // 🚀 THE FIX: Open the Cashfree checkout modal if a session was created
      if (data.paymentSessionId && cashfree) {
        cashfree.checkout({ paymentSessionId: data.paymentSessionId });
        return; // Stop execution; Cashfree handles the redirect
      }

      // Fallback for zero-fee/bypass scenarios
      setGig((prev: any) => {
        if (!prev) return null;
        return { ...prev, status: 'assigned', assigned_worker_id: workerId };
      });
      setIsWorker(user?.id === workerId);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
      setSubmitting(false); // Only clear loading state on error
    }
  };

  const handleComplete = async () => {
    if (gig?.listing_type === "MARKET" && gig.market_type === "RENT") {
      setShowReturnModal(true);
      return;
    }
    setShowReviewModal(true);
  };

  const handleReport = async () => {
    if (!reportReason) return toast.error("Please select a reason.");
    setIsReporting(true);
    try {
      const res = await fetch("/api/gig/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: id, targetType: "gig", reason: reportReason, details: reportDetails })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit report");

      toast.success("Report submitted successfully for review.");
      setShowReportModal(false);
      setReportReason("");
      setReportDetails("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsReporting(false);
    }
  };

  const submitReview = async () => {
    if (!rating) return toast.error("Select a rating.");
    setIsCompleting(true);
    try {
      const res = await fetch("/api/gig/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id, rating, review: reviewText }),
      });
      if (res.ok) window.location.reload();
      else throw new Error("Completion failed");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsCompleting(false);
    }
  };

  const confirmReturn = async () => {
    setIsCompleting(true);
    try {
      const res = await fetch("/api/rental/confirm-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id, deductionAmount, rating, review: reviewText }),
      });
      if (res.ok) window.location.reload();
      else throw new Error("Confirmation failed");
    } catch (e: any) { toast.error(e.message); }
    finally { setIsCompleting(false); }
  }

  const handleCancel = async () => {
    // if (!confirm("Are you sure you want to cancel this gig?")) return;
    setIsCancelling(true);
    try {
      const res = await fetch("/api/escrow/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id, posterId: user?.id }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.requestOnly) {
          toast.success("Cancellation request submitted. Waiting for approval.");
          window.location.reload();
        } else {
          toast.success("Gig cancelled successfully.");
          window.location.href = "/dashboard";
        }
      } else {
        throw new Error(data.error || "Cancellation failed");
      }
    } catch (e: any) {
      toast.error(e.message || "Network error.");
    } finally {
      setIsCancelling(false);
    }
  };

  const onVerifyHandshake = async () => {
    const code = inputCode.join("");
    if (code.length !== 4) return toast.error("Please enter the full 4-digit code.");

    setVerifyingHandshake(true);
    try {
      const res = await fetch("/api/gig/verify-handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id, code })
      });

      const data = await res.json();

      if (res.ok) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([50, 30, 50, 30, 100]);
        }
        toast.success("Handshake Confirmed! Funds Released.");
        setShowReviewModal(true); // Open rating modal automatically
        // window.location.reload(); // Don't reload, let user rate
      } else {
        toast.error(data.error || "Verification Failed");
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setVerifyingHandshake(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) value = value[value.length - 1];
    if (!/^\d*$/.test(value)) return;

    const newCode = [...inputCode];
    newCode[index] = value;
    setInputCode(newCode);

    if (value && index < 3) {
      const nextInput = document.getElementById(`digit-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !inputCode[index] && index > 0) {
      const prevInput = document.getElementById(`digit-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleMessage = async () => {
    if (!user || !gig) return router.push("/login");
    router.push(`/chat/${id}?chat=${id}_${user.id}`);
  };

  // --- RENDER ---
  if (loading) return <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-purple" /></div>;

  if (verifyingPayment) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex flex-col items-center justify-center text-white p-6">
        <div className="w-full max-w-md bg-[#121217] border border-white/10 rounded-[32px] p-10 text-center space-y-8 shadow-2xl animate-in zoom-in-95">
          <Loader2 className="w-12 h-12 text-brand-purple animate-spin mx-auto" />
          <h2 className="text-2xl font-bold">{verifyMessage}</h2>
          {verifyError && (
            <div className="text-red-400 text-sm mt-4 p-4 bg-red-500/10 rounded-xl">{verifyError}</div>
          )}
        </div>
      </div>
    );
  }

  if (!gig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B11] text-white">
        <p>Gig not found.</p>
      </div>
    );
  }

  const isMarket = gig.listing_type === "MARKET";
  const marketAction = gig.market_type === "RENT" ? "Rent" : "Buy";
  const status = gig.status.toLowerCase();
  const isAssigned = status === 'assigned';
  const isDelivered = status === 'delivered';
  const isCompleted = status === 'completed';
  const isDisputed = status === 'disputed';

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white font-sans selection:bg-brand-purple">

      {/* REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-2xl">
            <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Flag size={20} /></div>
            <h2 className="text-xl font-bold text-center mb-2">Report this Listing</h2>
            <p className="text-center text-white/50 text-sm mb-6">Help keep our community safe.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {["Scam / Fraud", "Inappropriate", "Spam", "Other"].map(r => (
                  <button key={r} onClick={() => setReportReason(r)} className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${reportReason === r ? "bg-red-500/20 border-red-500/50 text-red-500" : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"}`}>{r}</button>
                ))}
              </div>

              <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Provide specific details (optional)..." className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 h-24 outline-none text-white resize-none focus:border-red-500/50 transition-all font-mono text-sm" />

              <button onClick={handleReport} disabled={isReporting} className="w-full py-4 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                {isReporting ? <Loader2 className="animate-spin w-5 h-5" /> : <Flag className="w-5 h-5" />} Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERY MODAL (Remote Hustle) */}
      {showDeliveryModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-lg w-full animate-in zoom-in-95 relative shadow-2xl max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowDeliveryModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-brand-purple/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-purple/20">
                <Send className="w-7 h-7 text-brand-purple" />
              </div>
              <h2 className="text-2xl font-bold text-white">Submit Your Work</h2>
              <p className="text-white/50 text-sm mt-1">Upload files or share a link to your completed work.</p>
            </div>

            <div className="space-y-5">
              {/* Link input */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/60">Delivery Link (GitHub, Figma, Drive, etc.)</label>
                <input
                  type="url"
                  value={deliveryLinkInput}
                  onChange={e => setDeliveryLinkInput(e.target.value)}
                  placeholder="https://github.com/... or https://figma.com/..."
                  className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-purple/50 transition-all font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-3 text-white/30 text-sm font-bold">
                <div className="flex-1 h-px bg-white/10" />OR<div className="flex-1 h-px bg-white/10" />
              </div>

              {/* File Dropzone */}
              <div
                onDragOver={e => { e.preventDefault(); setDeliveryDragOver(true); }}
                onDragLeave={() => setDeliveryDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDeliveryDragOver(false);
                  const dropped = Array.from(e.dataTransfer.files);
                  setDeliveryFiles(prev => [...prev, ...dropped].slice(0, 5));
                }}
                onClick={() => { const inp = document.getElementById('delivery-file-input') as HTMLInputElement; inp?.click(); }}
                className={`cursor-pointer border-2 border-dashed rounded-2xl p-8 text-center transition-all ${deliveryDragOver ? 'border-brand-purple bg-brand-purple/10' : 'border-white/10 hover:border-brand-purple/50 hover:bg-white/5'}`}
              >
                <input
                  id="delivery-file-input"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
                  className="hidden"
                  onChange={e => {
                    const picked = Array.from(e.target.files || []);
                    setDeliveryFiles(prev => [...prev, ...picked].slice(0, 5));
                  }}
                />
                <UploadCloud className="w-10 h-10 text-white/30 mx-auto mb-3" />
                <p className="font-bold text-white/70">Click or drag files here</p>
                <p className="text-xs text-white/40 mt-1">PDF, Word, PPTX, Images — up to 5 files, 10MB each</p>
              </div>

              {/* File list */}
              {deliveryFiles.length > 0 && (
                <div className="space-y-2">
                  {deliveryFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-[#0B0B11] border border-white/5 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="w-4 h-4 text-brand-purple shrink-0" />
                        <span className="text-sm text-white/80 truncate">{f.name}</span>
                        <span className="text-xs text-white/40 shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                      </div>
                      <button onClick={() => setDeliveryFiles(prev => prev.filter((_, j) => j !== i))} className="text-white/40 hover:text-red-400 transition-colors ml-3">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={handleDeliverWork}
                disabled={isDelivering || (deliveryFiles.length === 0 && !deliveryLinkInput.trim())}
                className="w-full py-4 bg-brand-purple hover:bg-[#7D5FFF] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(136,37,245,0.3)] disabled:opacity-50"
              >
                {isDelivering ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                {isDelivering ? "Submitting..." : "Submit Work"}
              </button>

              <p className="text-center text-xs text-white/40">The poster has 12 hours to review. After that, funds are auto-released to you.</p>
            </div>
          </div>
        </div>
      )}

      {/* BACKGROUND BLOBS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-brand-purple/10 blur-[150px] rounded-full opacity-40"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-blue/10 blur-[150px] rounded-full opacity-40"></div>
      </div>

      {/* OFFER / APPLY MODAL */}
      {showOfferModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-2xl">
            <button onClick={() => setShowOfferModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-bold text-center mb-2">{isMarket ? (gig.market_type === "RENT" ? "Rental Offer" : "Make an Offer") : "Apply for Gig"}</h2>
            <p className="text-center text-white/50 text-sm mb-6">
              {isMarket ? "Propose your price or accept the listing price." : "Tell the poster why you're a good fit."}
            </p>

            <div className="space-y-4">
              {gig.market_type === "RENT" ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/60">Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={rentDuration}
                    onChange={(e) => setRentDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-purple/50 transition-all font-mono"
                  />
                  <div className="p-4 bg-white/5 rounded-xl border border-white/10 mt-2 space-y-2">
                    <div className="flex justify-between text-sm text-white/60">
                      <span>Rental (₹{gig.price} × {rentDuration} days)</span>
                      <span>₹{gig.price * rentDuration}</span>
                    </div>
                    {(gig.security_deposit || 0) > 0 && (
                      <div className="flex justify-between text-sm text-white/60">
                        <span>Refundable Deposit</span>
                        <span>₹{gig.security_deposit}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-white pt-2 border-t border-white/10">
                      <span>Total Offer Value</span>
                      <span className="text-brand-purple">₹{(gig.price * rentDuration) + (gig.security_deposit || 0)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/60">Your Offer (₹)</label>
                  <input
                    type="number"
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder={gig.price.toString()}
                    className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-purple/50 transition-all font-mono"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/60">Message / Pitch</label>
                <textarea
                  value={offerPitch}
                  onChange={(e) => setOfferPitch(e.target.value)}
                  placeholder="I'm interested..."
                  className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 h-24 outline-none text-white resize-none focus:border-brand-purple/50 transition-all"
                />
              </div>

              <button
                onClick={handleMakeOffer}
                disabled={submitting || (gig.market_type !== "RENT" && !offerPrice) || (gig.market_type === "RENT" && rentDuration < 1)}
                className="w-full py-4 bg-brand-purple hover:bg-[#7D5FFF] text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(136,37,245,0.3)] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />} Send Offer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT REVEAL MODAL (P2P) */}
      {showContactModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-brand-pink/30 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-[0_0_50px_rgba(236,72,153,0.2)]">
            <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-brand-pink/10 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
                <CheckCircle className="w-8 h-8 text-brand-pink" />
              </div>

              <h2 className="text-2xl font-bold text-white">Contact Revealed!</h2>
              <p className="text-white/50 text-sm">
                Connect directly with the poster to finalize the deal.
                <br /><span className="text-brand-pink font-bold">Meet in a safe public place.</span>
              </p>

              <div className="bg-black/40 rounded-xl p-6 border border-white/5 space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">Name</label>
                  <p className="text-lg font-bold text-white">{posterDetails?.name || "Poster"}</p>
                </div>

                {posterDetails?.phone && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">Phone</label>
                    <p className="text-xl font-mono text-brand-pink tracking-wider select-all">{posterDetails.phone}</p>
                  </div>
                )}

                {posterDetails?.upi_id && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/60">UPI ID</label>
                    <p className="text-base font-mono text-white/80 select-all">{posterDetails.upi_id}</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => router.push(`/chat/${id}`)}
                  className="w-full py-4 bg-white/10 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
                >
                  Close & Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RETURN MODAL (Owner) */}
      {showReturnModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-2xl">
            <button onClick={() => setShowReturnModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-bold text-center mb-2">Confirm Return</h2>
            <p className="text-center text-white/50 text-sm mb-6">Verify the item condition and release deposit.</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/60">Deduction Amount (₹)</label>
                <input
                  type="number"
                  value={deductionAmount}
                  onChange={(e) => setDeductionAmount(Number(e.target.value))}
                  max={gig.security_deposit || 0}
                  className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white outline-none focus:border-brand-purple/50 transition-all font-mono"
                />
                <p className="text-xs text-white/60">Max Deduction: ₹{gig.security_deposit || 0}</p>
              </div>

              <div className="p-4 bg-white/10 rounded-xl flex justify-between items-center text-sm">
                <span>Refund to Renter:</span>
                <span className="font-bold text-green-400 font-mono">₹{(gig.security_deposit || 0) - deductionAmount}</span>
              </div>

              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Condition notes..."
                className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 h-24 outline-none text-white resize-none"
              />

              <button onClick={confirmReturn} disabled={isCompleting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                {isCompleting ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-5 h-5" />} Process Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW MODAL (Hustle/General) */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-2xl">
            <button onClick={() => setShowReviewModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-bold text-center mb-2">Rate Experience</h2>
            <div className="flex justify-center gap-3 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)}><Star className={`w-10 h-10 ${star <= rating ? "fill-yellow-500 text-yellow-500" : "text-white/10"}`} /></button>
              ))}
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Review the work..." className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 mb-6 h-32 outline-none text-white" />
            <button onClick={submitReview} disabled={isCompleting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              {isCompleting ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-5 h-5" />} {status === 'completed' ? 'Submit Rating' : 'Approve & Release Funds'}
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 md:py-12 pb-28 md:pb-12">

        {/* HEADER: Back & Title */}
        <div className="mb-12">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-6 group w-fit"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="space-y-4 flex-1">
              <div className="flex flex-wrap gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${isMarket
                  ? "border-brand-pink/20 bg-brand-pink/10 text-brand-pink shadow-[0_0_15px_rgba(236,72,153,0.2)]"
                  : "border-brand-purple/20 bg-brand-purple/10 text-brand-purple shadow-[0_0_15px_rgba(136,37,245,0.2)]"
                  }`}>
                  {isMarket ? (gig.market_type === "SELL" ? "For Sale" : gig.market_type === "REQUEST" ? "Requested" : "For Rent") : "Hustle Request"}
                </span>

                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${status === 'open' ? 'border-green-500/20 bg-green-500/10 text-green-400' :
                  status === 'assigned' ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400' :
                  status === 'completed' ? 'border-blue-500/20 bg-blue-500/10 text-blue-400' :
                    'border-white/20 bg-white/10 text-white/40'
                  }`}>
                  {status === 'assigned' ? (isMarket ? 'IN DEAL' : 'HIRED') : 
                   status === 'completed' ? 'COMPLETED' : 
                   status.toUpperCase()}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 pr-0 md:pr-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                  {gig.title}
                </h1>
                <button onClick={() => setShowReportModal(true)} className="px-4 py-2 shrink-0 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 flex items-center gap-2 transition-all font-bold text-xs group" title="Report Listing">
                  <Flag size={14} className="group-hover:fill-red-400/20" /> Report
                </button>
              </div>

              <div className="flex items-center gap-4 text-white/60 text-sm">
                <span>Posted {new Date(gig.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center overflow-hidden relative border border-white/5">
                    {posterDetails?.avatar_url ? (
                      <Image src={posterDetails.avatar_url} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <User className="w-2.5 h-2.5 text-white/40" />
                    )}
                  </div>
                  <span className="font-medium text-white">{posterDetails?.name || gig.poster_email?.split('@')[0]}</span>
                  {posterDetails?.kyc_verified && (posterDetails.jobs_completed || 0) > 10 ? (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 text-[10px] font-bold border border-yellow-500/50 flex items-center gap-1 shadow-[0_0_10px_rgba(234,179,8,0.2)]">
                      <Sparkles size={10} fill="currentColor" /> CAMPUS PRO
                    </span>
                  ) : posterDetails?.kyc_verified && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold border border-blue-500/30 flex items-center gap-1">
                      <ShieldCheck size={10} /> ID VERIFIED
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden md:block text-right">
              <div className="bg-white/10 border border-white/10 p-6 rounded-3xl backdrop-blur-md inline-block min-w-[200px]">
                <p className="text-white/60 text-xs uppercase tracking-widest font-bold mb-1">
                  {isMarket ? gig.market_type === "RENT" ? "Rental Fee" : "Price" : "Budget"}
                </p>
                <p className="text-4xl font-mono font-bold text-white tracking-tighter">
                  ₹{gig.price}
                </p>
                {!isMarket && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-white/60 group relative cursor-help w-fit">
                    <span>+ ₹{Math.floor(gig.price * 0.02)} Platform Fee</span>
                    <HelpCircle size={12} className="text-white/60" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[10px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                      Includes 2% Gateway Security & Escrow Protection. <br /> (7.5% Rate for Campus Pros).
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
                    </div>
                  </div>
                )}
                {isMarket && gig.market_type === "RENT" && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-xs text-white/60 uppercase">Deposit</p>
                    <p className="text-sm font-mono text-white/80">₹{gig.security_deposit || 0}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STATUS BANNERS */}
        {contactRevealed && (
          <div className="mb-8 bg-brand-pink/10 border border-brand-pink/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-pink/20 flex items-center justify-center text-brand-pink shrink-0">
                <User size={20} />
              </div>
              <div>
                <h4 className="font-bold text-brand-pink">Deal in Progress</h4>
                <p className="text-sm text-brand-pink/70">You have exchanged contact info. Finish the deal offline.</p>
              </div>
            </div>
            <button
              onClick={() => setShowContactModal(true)}
              className="px-6 py-2 bg-brand-pink text-white font-bold rounded-full text-sm hover:bg-brand-pink/90 transition-all shadow-lg shadow-brand-pink/20 whitespace-nowrap"
            >
              View Contact
            </button>
          </div>
        )}

        {isCompleted && isWorker && (
          <div className="mb-8 bg-green-500/10 border border-green-500/30 rounded-2xl p-5 flex items-center gap-4 text-green-400 animate-in slide-in-from-top-4">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <h4 className="font-bold">Payment Released! 🎉</h4>
              <p className="text-sm opacity-80">Escrow funds have been released. Your earnings will arrive in your UPI account within <strong>24 hours</strong>. Check your payouts dashboard.</p>
            </div>
          </div>
        )}

        {isDelivered && !isCompleted && !isDisputed && isWorker && (
          <div className="mb-8 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-5 flex items-center gap-4 text-yellow-400 animate-in slide-in-from-top-4">
            <Clock className="w-6 h-6 shrink-0" />
            <div>
              <h4 className="font-bold">Work Submitted — Awaiting Review</h4>
              <p className="text-sm opacity-80">The poster has <strong>12 hours</strong> to approve. If no action is taken, payment is auto-released to you.</p>
            </div>
          </div>
        )}

        {isDelivered && !isCompleted && !isDisputed && isOwner && (
          <div className="mb-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex flex-col gap-3 text-blue-400 animate-in slide-in-from-top-4">
            <div className="flex items-center gap-4">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-bold">Work Delivered — Review Required</h4>
                <p className="text-sm opacity-80">You have <strong>12 hours</strong> to review and approve. If no action is taken, payment is auto-released to the worker.</p>
              </div>
            </div>
            {/* Show submitted work */}
            {(gig.delivery_link || (gig.delivery_files && (gig.delivery_files as string[]).length > 0)) && (
              <div className="mt-1 pl-10 space-y-2">
                {gig.delivery_link && (
                  <a href={gig.delivery_link} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-brand-purple underline underline-offset-2 hover:text-white transition-colors">
                    <ArrowUpRight size={14} /> {gig.delivery_link}
                  </a>
                )}
                {(gig.delivery_files as string[] || []).map((path: string, i: number) => {
                  const url = supabase.storage.from("gig-images").getPublicUrl(path).data.publicUrl;
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors">
                      <FileText size={14} />
                      <span className="truncate">{path.split("/").pop()}</span>
                      <Download size={12} className="shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* HANDSHAKE SECTION — Physical Deals only */}
        {gig.escrow_status === 'HELD' && (status === 'assigned' || status === 'delivered') && gig.is_physical === true && (
          <div className="mb-12 bg-gradient-to-r from-[#1A1A24] to-[#121217] border border-yellow-500/30 rounded-[32px] p-8 md:p-10 relative overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.1)]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-left max-w-lg">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-4 border border-yellow-500/20">
                  <ShieldCheck size={12} /> Secure Handover Active
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {isMarket 
                    ? (isOwner ? "Enter code from the Buyer" : "Provide this code to the Seller")
                    : (isOwner ? "Provide this code to the Hustler" : "Enter code from the Poster")}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  {isMarket
                    ? (isOwner 
                        ? "Ask the Buyer for the 4-digit code once they have verified the item and are satisfied. Entering this code releases the payment to you."
                        : "Provide this code to the Seller only after you have physically verified the item and are ready to complete the transaction.")
                    : (isOwner 
                        ? `To ensure safety, only share this code when you physically meet the Hustler and verify the work. Once they enter it, funds are released to them.`
                        : `Ask the Poster for the 4-digit code when you meet and verify the task. Entering this code confirms completion and releases payment.`)}
                </p>

                {/* ESCROW 3-STEP VISUAL */}
                <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/50 bg-black/30 p-4 rounded-3xl border border-white/10 w-full md:w-auto mt-6 shadow-inner">
                  <div className="flex flex-col items-center gap-2 flex-1 relative">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30"><User size={18} /></div>
                    <span className="text-center text-blue-400 shrink-0">1. Meet Up</span>
                  </div>
                  <ChevronRight size={16} className="text-white/20 shrink-0" />
                  <div className="flex flex-col items-center gap-2 flex-1 relative">
                    <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30"><Eye size={18} /></div>
                    <span className="text-center text-purple-400 shrink-0">2. Inspect</span>
                  </div>
                  <ChevronRight size={16} className="text-white/20 shrink-0" />
                  <div className="flex flex-col items-center gap-2 flex-1 relative">
                    <div className="w-10 h-10 rounded-2xl bg-yellow-500/20 text-yellow-500 flex items-center justify-center border border-yellow-500/30"><Key size={18} /></div>
                    <span className="text-center text-yellow-500 shrink-0">3. Exchange</span>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 p-6 rounded-2xl border border-white/10 backdrop-blur-sm min-w-[280px]">
                {(isMarket ? !isOwner : isOwner) ? (
                  <div className="text-center">
                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4">Secret Code</p>
                    <div className="flex justify-center gap-3">
                      {handshakeCode ? (handshakeCode || "").split('').map((digit, i) => (
                        <div key={i} className="w-12 h-16 flex items-center justify-center bg-[#1A1A24] border border-yellow-500/50 rounded-xl text-3xl font-mono font-bold text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                          {digit}
                        </div>
                      )) : (
                        <div className="flex flex-col items-center gap-2">
                           <Loader2 className="animate-spin text-yellow-500" />
                           <span className="text-[10px] text-white/30">Generating Secure Code...</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-4 text-[10px] text-white/50">Don't share online.</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4">Enter Code</p>
                    <div className="flex justify-center gap-3 mb-6">
                      {(inputCode || ["", "", "", ""]).map((digit, i) => (
                        <input
                          key={i}
                          id={`digit-${i}`}
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleDigitChange(i, e.target.value)}
                          onKeyDown={(e) => handleDigitKeyDown(i, e)}
                          className="w-12 h-16 bg-[#0B0B11] border border-white/20 rounded-xl text-center text-3xl font-mono font-bold text-white focus:border-brand-purple focus:outline-none focus:shadow-[0_0_15px_rgba(136,37,245,0.4)] transition-all caret-transparent"
                        />
                      ))}
                    </div>
                    <button
                      onClick={onVerifyHandshake}
                      disabled={verifyingHandshake || (inputCode || []).some((d: string) => !d)}
                      className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
                    >
                      {verifyingHandshake ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      Verify & Release
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          {/* LEFT COLUMN: Details */}
          <div className="md:col-span-2 space-y-8">

            {/* Images */}
            {gig.images && gig.images.length > 0 && (
              <div className="relative rounded-[32px] overflow-hidden border border-white/10 bg-black/40 aspect-[16/9] md:aspect-[2/1] group shadow-2xl">
                <div className="flex overflow-x-auto snap-x snap-mandatory h-full w-full no-scrollbar">
                  {gig.images.map((path, i) => {
                    const url = supabase.storage.from("gig-images").getPublicUrl(path).data.publicUrl;
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(path);

                    if (!isImage) {
                      return (
                        <div key={i} className="min-w-full h-full relative snap-center flex items-center justify-center bg-[#1A1A24] cursor-pointer group/file" onClick={() => window.open(url, '_blank')}>
                          <div className="text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto group-hover/file:scale-110 transition-transform">
                              <FileText size={32} className="text-white/60" />
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm truncate max-w-[200px] mx-auto px-4">{path.split('/').pop()}</p>
                              <p className="text-brand-purple text-xs font-bold mt-2 flex items-center justify-center gap-1">
                                <Download size={12} /> Download File
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={i} className="min-w-full h-full relative snap-center cursor-pointer" onClick={() => setSelectedImageIndex(i)}>
                        <Image src={url} alt={`Image ${i + 1}`} fill className="object-cover" />
                      </div>
                    )
                  })}
                </div>
                {gig.images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {gig.images.map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-white/100 backdrop-blur-sm"></div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description Box */}
            <div className="bg-[#121217] border border-white/5 rounded-[32px] p-8 space-y-6">

              {/* GitHub Link Display */}
              {gig.github_link && (
                <div className="mb-6 pb-6 border-b border-white/5">
                  <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                    Reference Repo
                  </h3>
                  <a
                    href={gig.github_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl bg-[#1A1A24] border border-white/10 hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-all group"
                  >
                    <div className="p-2 bg-white/10 rounded-lg text-white group-hover:text-brand-purple transition-colors">
                      <Github size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-white truncate group-hover:text-brand-purple transition-colors">
                        {gig.github_link.replace(/^https?:\/\//, '')}
                      </p>
                      <p className="text-[10px] text-white/60">Open Repository</p>
                    </div>
                    <ArrowUpRight size={16} className="ml-auto text-white/60 group-hover:text-brand-purple" />
                  </a>
                </div>
              )}

              <div>
                <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-6 h-[1px] bg-white/20"></span> Description
                </h3>
                <p className="text-lg text-white/80 leading-relaxed font-light whitespace-pre-line">
                  {gig.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/10 text-white/60">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/60 uppercase font-bold">Location</p>
                    <p className="text-base font-medium">{gig.location || "Remote"}</p>
                  </div>
                </div>
                {isMarket ? (
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-white/10 text-white/60">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-white/60 uppercase font-bold">Condition</p>
                      <p className="text-base font-medium capitalize">
                        {gig.item_condition ? gig.item_condition.replace(/_/g, " ").toLowerCase() : "Not specified"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-white/10 text-white/60">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-white/60 uppercase font-bold">Deadline</p>
                        <p className="text-base font-medium">
                          {gig.deadline ? new Date(gig.deadline as string).toLocaleDateString() : "Flexible"}
                        </p>
                      </div>
                    </div>
                    {/* APPLICANT LIST (POSTER ONLY) */}
                    {user && gig.poster_id === user.id && (
                      <div className="space-y-4">
                        <h3 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4">
                          Applications ({applications.length})
                        </h3>

                        {applications.length === 0 ? (
                          <p className="text-white/50 text-sm">No applications yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {applications.map((app) => (
                              <div key={app.id} className="bg-[#1A1A24] border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-all">
                                <div className="flex items-center gap-4">
                                  {/* Avatar */}
                                  <div className="w-10 h-10 rounded-full bg-zinc-800 relative overflow-hidden border border-white/5">
                                    {app.worker?.avatar_url ? (
                                      <Image 
                                        src={app.worker.avatar_url} 
                                        alt={app.worker.name} 
                                        fill 
                                        className="object-cover" 
                                        unoptimized 
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-white/40">
                                        <User size={18} />
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <h4 className="font-bold text-white text-sm">{app.worker?.name || "User"}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                      <span className="flex items-center gap-0.5 text-yellow-500">
                                        <Star size={10} fill="currentColor" /> {(!app.worker?.rating || app.worker?.rating_count === 0) ? "NA" : Number(app.worker.rating).toFixed(1)}
                                      </span>
                                      <span>• {app.worker?.jobs_completed || 0} Jobs</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => router.push(`/chat/${gig.id}?chat=${gig.id}_${app.worker_id}`)}
                                    className="p-2 bg-white/10 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
                                    title="Message"
                                  >
                                    <MessageSquare size={16} />
                                  </button>
                                  {status === 'open' && (
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleAcceptOffer(app.id, app.worker_id)}
                                        disabled={isAccepting === app.id}
                                        className="px-4 py-2 bg-green-500 text-black text-xs font-bold rounded-xl hover:bg-green-400 transition-colors"
                                      >
                                        {isAccepting === app.id ? "..." : "Accept"}
                                      </button>
                                      <button
                                        onClick={() => handleRejectOffer(app.id)}
                                        disabled={isRejecting === app.id}
                                        className="px-4 py-2 bg-white/5 text-white/40 text-xs font-bold rounded-xl hover:bg-red-500/20 hover:text-red-400 border border-white/5 transition-colors"
                                      >
                                        {isRejecting === app.id ? "..." : "Reject"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Actions */}
          <div className="space-y-6">

            {/* Price Card (Mobile Only) */}
            <div className="md:hidden bg-[#121217] border border-white/10 p-6 rounded-3xl flex justify-between items-center">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-widest font-bold">
                  {isMarket ? gig.market_type === "RENT" ? "Rental Fee" : "Price" : "Budget"}
                </p>
                <p className="text-3xl font-mono font-bold text-white">₹{gig.price}</p>
              </div>
            </div>

            {/* Action Card (Desktop) */}
            <div className="bg-[#121217] border border-white/10 p-6 rounded-[32px] space-y-6 shadow-2xl sticky top-8">
              <h3 className="text-lg font-bold">Action Required</h3>

              {user ? (
                <>
                  {isOwner ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl bg-white/10 border border-white/5 text-center">
                        <p className="text-sm text-white/60">You are the owner of this post.</p>
                      </div>

                      {(status === "assigned" || status === "delivered") && (
                        <>
                          {(!isMarket || !gig.is_physical) && (
                            <button
                              onClick={handleComplete}
                              disabled={isCompleting}
                              className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-400 text-black font-bold text-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] mb-3 active:scale-[0.98]"
                            >
                              {isCompleting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                                isMarket
                                  ? (gig.market_type === "RENT" ? "Confirm Return" : "Complete Deal")
                                  : "Mark as Completed"
                              )}
                            </button>
                          )}

                          <button
                            onClick={handleCancel}
                            disabled={isCancelling}
                            className="w-full py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-sm transition-all"
                          >
                            {isCancelling ? "Processing..." : "Request Cancellation"}
                          </button>
                        </>
                      )}

                      {status === "open" && (
                        <button
                          onClick={handleCancel}
                          disabled={isCancelling}
                          className="w-full py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-lg transition-all active:scale-[0.98]"
                        >
                          {isCancelling ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Cancel Listing"}
                        </button>
                      )}

                      {status === "cancellation_requested" && (
                        <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                          <p className="text-yellow-500 font-bold mb-1">Cancellation Pending</p>
                          <p className="text-xs text-yellow-500/60">A request to cancel has been sent. Waiting for approval.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {status === "open" ? (
                        <button
                          onClick={isMarket ? handleBuy : handleApplyNavigation}
                          disabled={isBuying || hasApplied}
                          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg active:scale-[0.98] ${hasApplied
                            ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 cursor-not-allowed"
                            : "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                            }`}
                        >
                          {isBuying ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (
                            hasApplied ? "Offer Pending" : (isMarket ? (gig.market_type === 'RENT' ? "Rent Item" : "Make Offer") : "Apply Now")
                          )}
                        </button>
                      ) : (
                        <div className="p-4 rounded-2xl bg-white/10 border border-white/5 text-center">
                          <p className="text-sm text-white/60">
                            {status === "completed" ? "This listing is closed." : "This listing is currently assigned."}
                          </p>
                        </div>
                      )}

                      {/* WORKER ACTIONS (RENT) */}
                      {isWorker && status === "assigned" && gig.market_type === "RENT" && gig.payment_status !== "ESCROW_FUNDED" && (
                        <div className="space-y-3 animate-in fade-in zoom-in-95">
                          <div className="p-4 rounded-2xl bg-brand-purple/10 border border-brand-purple/20 text-center">
                            <p className="text-brand-purple font-bold mb-1">Rental Approved!</p>
                            <p className="text-xs text-brand-purple/60">Complete payment to unlock owner's contact info.</p>
                          </div>
                          <button
                            onClick={handleBuy}
                            disabled={isBuying}
                            className="w-full py-4 rounded-2xl bg-brand-purple hover:bg-[#7D5FFF] text-white font-bold text-lg transition-all shadow-[0_0_20px_rgba(136,37,245,0.3)] active:scale-95"
                          >
                            {isBuying ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Pay & Start Rental"}
                          </button>
                        </div>
                      )}

                      {/* WORKER ACTIONS (HUSTLE or POST-PAYMENT RENT) */}
                      {isWorker && status === "assigned" && (gig.market_type !== "RENT" || gig.payment_status === "ESCROW_FUNDED") && (
                        <div className="space-y-3 animate-in fade-in zoom-in-95">
                          <div className="p-4 rounded-2xl bg-brand-purple/10 border border-brand-purple/20 text-center">
                            <p className="text-brand-purple font-bold mb-1">Assigned to You!</p>
                            <p className="text-xs text-brand-purple/60">
                              {isMarket
                                ? "Complete the handshake to release funds."
                                : gig.is_physical
                                  ? "Meet the poster and complete the handshake to release funds."
                                  : "Complete the task and submit your work below."}
                            </p>
                          </div>
                         </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-white/60 text-sm">Log in to interact with this gig.</p>
                  <button onClick={() => router.push('/login')} className="w-full py-3 rounded-2xl bg-brand-purple hover:bg-[#7D5FFF] text-white font-bold transition-all shadow-lg active:scale-95">Login / Register</button>
                </div>
              )}
            </div>

            {/* SELLER/POSTER PROFILE (Unmasked) */}
            <div className="bg-[#121217] border border-white/10 p-6 rounded-[32px] space-y-4 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -z-10 group-hover:bg-white/10 transition-colors"></div>

              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-2">Posted By</h3>

              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${(posterDetails?.jobs_completed || 0) > 10
                  ? "p-[2px] bg-gradient-to-r from-amber-500 to-yellow-600 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                  : "border border-white/5 bg-zinc-800"
                  }`}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 relative flex items-center justify-center">
                    {posterDetails?.avatar_url ? (
                      <Image src={posterDetails.avatar_url} alt={posterDetails.name} width={56} height={56} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800">
                        <User className="w-6 h-6 text-white/40" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-white text-lg leading-tight flex items-center gap-2">
                    {posterDetails?.name || "Anonymous User"}
                    {(posterDetails?.jobs_completed || 0) > 10 && (
                      <div className="group relative">
                        <Sparkles size={14} className="text-yellow-500 text-fill-yellow-500 animate-pulse" fill="currentColor" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-yellow-500 text-black text-[10px] font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                          Campus Pro: 10+ Successful Deals
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500"></div>
                        </div>
                      </div>
                    )}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                    <span className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                      <Star size={10} fill="currentColor" />
                      <span className="font-bold">{(!posterDetails?.rating || posterDetails?.rating_count === 0) ? "NA" : Number(posterDetails.rating).toFixed(1)}</span>
                      {posterDetails?.rating_count > 0 && <span className="text-yellow-500/50">({posterDetails.rating_count})</span>}
                    </span>
                    <span>• {posterDetails?.jobs_completed || 0} Jobs Done</span>
                  </div>
                </div>
              </div>

              {user && user.id !== gig.poster_id && (
                <button
                  onClick={handleMessage}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/10 hover:bg-white/10 border border-white/5 hover:border-white/20 text-white font-medium transition-all active:scale-[0.98]"
                >
                  <MessageSquare size={16} />
                  Message Poster
                </button>
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Lightbox - Scrollable Multi-Image Gallery */}
      {selectedImageIndex !== null && gig.images && gig.images.length > 0 && (() => {
        const imageUrls = gig.images
          .filter((path: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(path))
          .map((path: string) => supabase.storage.from("gig-images").getPublicUrl(path).data.publicUrl);
        const currentIndex = Math.min(selectedImageIndex, imageUrls.length - 1);
        const goNext = () => setSelectedImageIndex(prev => prev !== null ? Math.min(prev + 1, imageUrls.length - 1) : 0);
        const goPrev = () => setSelectedImageIndex(prev => prev !== null ? Math.max(prev - 1, 0) : 0);

        return (
          <div
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => setSelectedImageIndex(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') goNext();
              else if (e.key === 'ArrowLeft') goPrev();
              else if (e.key === 'Escape') setSelectedImageIndex(null);
            }}
            tabIndex={0}
            onTouchStart={(e) => {
              const startX = e.touches[0].clientX;
              const el = e.currentTarget;
              el.dataset.touchStartX = String(startX);
            }}
            onTouchEnd={(e) => {
              const startX = Number(e.currentTarget.dataset.touchStartX || 0);
              const endX = e.changedTouches[0].clientX;
              const diff = startX - endX;
              if (Math.abs(diff) > 50) {
                if (diff > 0) goNext();
                else goPrev();
              }
            }}
          >
            <button className="absolute top-6 right-6 p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all z-20" onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(null); }}>
              <X className="w-8 h-8" />
            </button>

            {imageUrls.length > 1 && currentIndex > 0 && (
              <button className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all z-20" onClick={(e) => { e.stopPropagation(); goPrev(); }}>
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {imageUrls.length > 1 && currentIndex < imageUrls.length - 1 && (
              <button className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all z-20" onClick={(e) => { e.stopPropagation(); goNext(); }}>
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <div className="relative w-full max-w-6xl h-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <Image src={imageUrls[currentIndex]} alt={`Image ${currentIndex + 1} of ${imageUrls.length}`} fill className="object-contain" quality={100} />
            </div>

            {imageUrls.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                {imageUrls.map((_: string, i: number) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setSelectedImageIndex(i); }}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${i === currentIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}