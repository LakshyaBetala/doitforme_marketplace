"use client";

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
  HelpCircle
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
  const [submitting, setSubmitting] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [deductionAmount, setDeductionAmount] = useState(0);
  const [applications, setApplications] = useState<any[]>([]);

  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

          if (gigData.status === 'assigned' || gigData.escrow_status === 'HELD') {
            const { data: escrowData } = await supabase
              .from('escrow')
              .select('handshake_code')
              .eq('gig_id', id)
              .maybeSingle();

            if (escrowData?.handshake_code) {
              setHandshakeCode(escrowData.handshake_code);
            }
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
    if (!user) return alert("Please login to apply.");
    router.push(`/gig/${id}/apply`);
  };

  const handleBuy = async () => {
    if (!user) return alert("Please login to purchase.");

    // V6 P2P FLOW (No Gateway)
    if (gig?.listing_type === 'MARKET' && gig.market_type !== 'RENT') {
      const action = gig.market_type === 'REQUEST' ? "Fulfill Request" : "Buy";
      if (!confirm(`Connect with the poster to ${action}? This involves no online payment.`)) return;

      setIsBuying(true);
      try {
        await handleInstantBuy();
      } catch (e: any) {
        alert(e.message);
      } finally {
        setIsBuying(false);
      }
      return;
    }

    // RENTAL / ESCROW FLOW
    const action = gig?.market_type === 'RENT' ? "Rent" : "Buy";
    if (!confirm(`Are you sure you want to ${action} this item? You will be redirected to payment.`)) return;

    setIsBuying(true);
    try {
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initiate payment");

      if (data.payment_link) {
        window.location.href = data.payment_link;
      } else {
        throw new Error("No payment link received");
      }
    } catch (err: any) {
      alert(err.message);
      setIsBuying(false);
    }
  };

  const handleInstantBuy = async () => {
    // FIX: Use dedicated P2P route
    const res = await fetch("/api/gig/buy-p2p", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gigId: id, workerId: user?.id })
    });

    if (!res.ok) {
      const json = await res.json();
      throw new Error(json.error || "Failed to connect.");
    }

    setContactRevealed(true);
    setShowContactModal(true);
    setGig((prev: any) => ({ ...prev, status: 'assigned', assigned_worker_id: user?.id }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeliver = async () => {
    if (gig?.listing_type === "MARKET" && gig.market_type === "RENT") {
      if (!confirm("Confirm you have returned the item? This will notify the owner.")) return;
      setIsCompleting(true);
      try {
        const res = await fetch("/api/rental/return", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gigId: id }),
        });
        if (res.ok) window.location.reload();
        else throw new Error("Failed to mark as returned");
      } catch (e: any) { alert(e.message); }
      finally { setIsCompleting(false); }
      return;
    }

    if (!gig?.is_physical && !deliveryLink.trim()) return alert("Please enter a submission link.");
    if (!confirm("Notify the poster that the work is finished?")) return;
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
      alert(e.message);
    } finally {
      setIsCompleting(false);
    }
  };

  const handleAssign = async (workerId: string) => {
    if (!confirm("Are you sure you want to assign this gig to this worker?")) return;
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
      alert(err.message);
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

  const submitReview = async () => {
    if (!rating) return alert("Select a rating.");
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
      alert(e.message);
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
    } catch (e: any) { alert(e.message); }
    finally { setIsCompleting(false); }
  }

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel this gig?")) return;
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
          alert("Cancellation request submitted. Waiting for approval.");
          window.location.reload();
        } else {
          alert("Gig cancelled successfully.");
          window.location.href = "/dashboard";
        }
      } else {
        throw new Error(data.error || "Cancellation failed");
      }
    } catch (e: any) {
      alert(e.message || "Network error.");
    } finally {
      setIsCancelling(false);
    }
  };

  const onVerifyHandshake = async () => {
    const code = inputCode.join("");
    if (code.length !== 4) return alert("Please enter the full 4-digit code.");

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
        alert("Handshake Confirmed! Funds Released.");
        window.location.reload();
      } else {
        alert(data.error || "Verification Failed");
      }
    } catch (e) {
      alert("Network error");
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

      {/* BACKGROUND BLOBS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-brand-purple/10 blur-[150px] rounded-full opacity-40"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-blue/10 blur-[150px] rounded-full opacity-40"></div>
      </div>

      {/* CONTACT REVEAL MODAL (P2P) */}
      {showContactModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-brand-pink/30 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-[0_0_50px_rgba(236,72,153,0.2)]">
            <button onClick={() => setShowContactModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>

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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Name</label>
                  <p className="text-lg font-bold text-white">{posterDetails?.name || "Poster"}</p>
                </div>

                {posterDetails?.phone && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Phone</label>
                    <p className="text-xl font-mono text-brand-pink tracking-wider select-all">{posterDetails.phone}</p>
                  </div>
                )}

                {posterDetails?.upi_id && (
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">UPI ID</label>
                    <p className="text-base font-mono text-white/80 select-all">{posterDetails.upi_id}</p>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowContactModal(false)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
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
            <button onClick={() => setShowReturnModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
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
                <p className="text-xs text-white/40">Max Deduction: ₹{gig.security_deposit || 0}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-xl flex justify-between items-center text-sm">
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
            <button onClick={() => setShowReviewModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            <h2 className="text-2xl font-bold text-center mb-2">Rate Experience</h2>
            <div className="flex justify-center gap-3 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)}><Star className={`w-10 h-10 ${star <= rating ? "fill-yellow-500 text-yellow-500" : "text-white/10"}`} /></button>
              ))}
            </div>
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Review the work..." className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 mb-6 h-32 outline-none text-white" />
            <button onClick={submitReview} disabled={isCompleting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              {isCompleting ? <Loader2 className="animate-spin" /> : <CheckCircle className="w-5 h-5" />} Approve & Release Funds
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
                    'border-white/20 bg-white/10 text-white/60'
                  }`}>
                  {status === 'assigned' ? (isMarket ? 'Sold/Rented' : 'Assigned') : status}
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                {gig.title}
              </h1>

              <div className="flex items-center gap-4 text-white/60 text-sm">
                <span>Posted {new Date(gig.created_at).toLocaleDateString()}</span>
                <span>•</span>
                <div className="flex items-center gap-2">
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
              <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md inline-block min-w-[200px]">
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-1">
                  {isMarket ? gig.market_type === "RENT" ? "Rental Fee" : "Price" : "Budget"}
                </p>
                <p className="text-4xl font-mono font-bold text-white tracking-tighter">
                  ₹{gig.price}
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs text-white/40 group relative cursor-help w-fit">
                  <span>+ ₹{Math.floor(gig.price * 0.02)} Platform Fee</span>
                  <HelpCircle size={12} className="text-white/20" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black/90 border border-white/10 rounded-lg text-[10px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center">
                    Includes 2% Gateway Security & Escrow Protection. <br /> (7.5% Rate for Campus Pros).
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
                  </div>
                </div>
                {isMarket && gig.market_type === "RENT" && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-xs text-white/40 uppercase">Deposit</p>
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

        {isDelivered && !isCompleted && !isDisputed && (
          <div className="mb-8 bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex items-center gap-4 text-blue-400 animate-in slide-in-from-top-4">
            <CheckCircle2 className="w-6 h-6" />
            <div>
              <h4 className="font-bold">{isMarket && gig.market_type === 'RENT' ? "Item Returned" : "Task Delivered!"}</h4>
              <p className="text-sm opacity-80">
                {isMarket && gig.market_type === 'RENT' ? "Renter has marked the item as returned. Please check condition." : "Review the work and release the payment if satisfied."}
              </p>
            </div>
          </div>
        )}

        {/* HANDSHAKE SECTION */}
        {gig.escrow_status === 'HELD' && (status === 'assigned' || status === 'delivered') && (
          <div className="mb-12 bg-gradient-to-r from-[#1A1A24] to-[#121217] border border-yellow-500/30 rounded-[32px] p-8 md:p-10 relative overflow-hidden shadow-[0_0_40px_rgba(234,179,8,0.1)]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="text-center md:text-left max-w-lg">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-4 border border-yellow-500/20">
                  <ShieldCheck size={12} /> Secure Handover Active
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {isOwner ? "Provide this code to the worker" : "Enter code from the seller"}
                </h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {isOwner
                    ? "To ensure safety, only share this code when you physically meet the worker and verify the service/item. Once they enter it, funds are released to them."
                    : "Ask the seller for the 4-digit code when you meet. Entering this code confirms you have received the item/service and releases the payment."}
                </p>
              </div>

              <div className="bg-black/40 p-6 rounded-2xl border border-white/10 backdrop-blur-sm min-w-[280px]">
                {isOwner ? (
                  <div className="text-center">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">Your Secret Code</p>
                    <div className="flex justify-center gap-3">
                      {handshakeCode?.split('').map((digit, i) => (
                        <div key={i} className="w-12 h-16 flex items-center justify-center bg-[#1A1A24] border border-yellow-500/50 rounded-xl text-3xl font-mono font-bold text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                          {digit}
                        </div>
                      )) || <Loader2 className="animate-spin text-yellow-500" />}
                    </div>
                    <p className="mt-4 text-[10px] text-white/30">Don't share online.</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">Enter Handshake Code</p>
                    <div className="flex justify-center gap-3 mb-6">
                      {inputCode.map((digit, i) => (
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
                      disabled={verifyingHandshake || inputCode.some(d => !d)}
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
                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto group-hover/file:scale-110 transition-transform">
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
                      <div key={i} className="min-w-full h-full relative snap-center" onClick={() => setSelectedImage(url)}>
                        <Image src={url} alt={`Image ${i + 1}`} fill className="object-cover" />
                      </div>
                    )
                  })}
                </div>
                {gig.images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {gig.images.map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-white/50 backdrop-blur-sm"></div>
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
                  <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                    Reference Repo
                  </h3>
                  <a
                    href={gig.github_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 rounded-xl bg-[#1A1A24] border border-white/10 hover:border-brand-purple/50 hover:bg-brand-purple/5 transition-all group"
                  >
                    <div className="p-2 bg-white/5 rounded-lg text-white group-hover:text-brand-purple transition-colors">
                      <Github size={20} />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-white truncate group-hover:text-brand-purple transition-colors">
                        {gig.github_link.replace(/^https?:\/\//, '')}
                      </p>
                      <p className="text-[10px] text-white/40">Open Repository</p>
                    </div>
                    <ArrowUpRight size={16} className="ml-auto text-white/20 group-hover:text-brand-purple" />
                  </a>
                </div>
              )}

              <div>
                <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                  <span className="w-6 h-[1px] bg-white/20"></span> Description
                </h3>
                <p className="text-lg text-white/80 leading-relaxed font-light whitespace-pre-line">
                  {gig.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-white/5">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-white/5 text-white/60">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/40 uppercase font-bold">Location</p>
                    <p className="text-base font-medium">{gig.location || "Remote"}</p>
                  </div>
                </div>
                {isMarket ? (
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-white/5 text-white/60">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-white/40 uppercase font-bold">Condition</p>
                      <p className="text-base font-medium capitalize">
                        {gig.item_condition ? gig.item_condition.replace(/_/g, " ").toLowerCase() : "Not specified"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-white/5 text-white/60">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-white/40 uppercase font-bold">Deadline</p>
                        <p className="text-base font-medium">
                          {gig.deadline ? new Date(gig.deadline as string).toLocaleDateString() : "Flexible"}
                        </p>
                      </div>
                    </div>
                    {/* APPLICANT LIST (POSTER ONLY) */}
                    {user && gig.poster_id === user.id && (
                      <div className="space-y-4">
                        <h3 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-4">
                          Applications ({applications.length})
                        </h3>

                        {applications.length === 0 ? (
                          <p className="text-white/30 text-sm">No applications yet.</p>
                        ) : (
                          <div className="space-y-3">
                            {applications.map((app) => (
                              <div key={app.id} className="bg-[#1A1A24] border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-white/10 transition-all">
                                <div className="flex items-center gap-4">
                                  {/* Avatar */}
                                  <div className="w-10 h-10 rounded-full bg-zinc-800 relative overflow-hidden">
                                    {app.worker?.avatar_url ? (
                                      <Image src={app.worker.avatar_url} alt={app.worker.name} fill className="object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-white/40 font-bold text-xs">{app.worker?.name?.[0]}</div>
                                    )}
                                  </div>

                                  <div>
                                    <h4 className="font-bold text-white text-sm">{app.worker?.name || "Unknown"}</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                                      <span className="flex items-center gap-0.5 text-yellow-500">
                                        <Star size={10} fill="currentColor" /> {app.worker?.rating || "New"}
                                      </span>
                                      <span>• {app.worker?.jobs_completed || 0} Jobs</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => router.push(`/messages?chat=${gig.id}_${app.worker_id}`)}
                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
                                    title="Message"
                                  >
                                    <MessageSquare size={16} />
                                  </button>
                                  {status === 'open' && (
                                    <button
                                      onClick={() => handleAssign(app.worker_id)}
                                      className="px-4 py-2 bg-brand-purple text-white text-xs font-bold rounded-xl hover:bg-brand-purple/90 transition-colors"
                                    >
                                      Assign
                                    </button>
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
                <p className="text-white/40 text-xs uppercase tracking-widest font-bold">
                  {isMarket ? gig.market_type === "RENT" ? "Rental Fee" : "Price" : "Budget"}
                </p>
                <p className="text-3xl font-mono font-bold text-white">₹{gig.price}</p>
              </div>
            </div>

            {/* Action Card */}
            <div className="bg-[#121217] border border-white/10 p-6 rounded-[32px] space-y-6 shadow-2xl sticky top-8">
              <h3 className="text-lg font-bold">Action Required</h3>

              {user ? (
                <>
                  {isOwner ? (
                    <div className="space-y-3">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                        <p className="text-sm text-white/60">You are the owner of this post.</p>
                      </div>

                      {(status === "assigned" || status === "delivered") && (
                        <>
                          <button
                            onClick={handleComplete}
                            disabled={isCompleting}
                            className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-400 text-black font-bold text-lg transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] mb-3"
                          >
                            {isCompleting ? "Processing..." : (
                              isMarket
                                ? (gig.market_type === "RENT" ? "Confirm Return" : "Confirm Delivery")
                                : "Mark as Completed"
                            )}
                          </button>

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
                          className="w-full py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 font-bold text-lg transition-all"
                        >
                          {isCancelling ? "Cancelling..." : "Cancel Gig"}
                        </button>
                      )}

                      {status === "cancellation_requested" && (
                        <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                          <p className="text-yellow-500 font-bold mb-1">Cancellation Pending</p>
                          <p className="text-xs text-yellow-500/60">A request to cancel and refund has been sent. Waiting for approval.</p>
                        </div>
                      )}

                      {status !== "cancellation_requested" && (
                        <button className="w-full py-3 rounded-2xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors font-medium mt-3">
                          Edit Gig
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {status === "open" ? (
                        <button
                          onClick={isMarket ? handleBuy : handleApplyNavigation}
                          disabled={isBuying || hasApplied}
                          className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg active:scale-[0.98] ${hasApplied
                            ? "bg-white/10 text-white/50 cursor-not-allowed"
                            : "bg-white text-black hover:bg-white/90 shadow-white/10"
                            }`}
                        >
                          {isBuying ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (
                            hasApplied ? "Applied" : (isMarket ? `${marketAction} Now` : "Apply for Gig")
                          )}
                        </button>
                      ) : (
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                          <p className="text-sm text-white/60">
                            {status === "completed" ? "This gig is completed." : "This gig is currently assigned."}
                          </p>
                        </div>
                      )}

                      {isWorker && status === "assigned" && (
                        <div className="space-y-3">
                          <div className="p-4 rounded-2xl bg-brand-purple/10 border border-brand-purple/20 text-center">
                            <p className="text-brand-purple font-bold mb-1">Assigned to You!</p>
                            <p className="text-xs text-brand-purple/60">Complete the task to get paid.</p>
                          </div>
                          <button
                            onClick={handleDeliver}
                            disabled={isCompleting}
                            className="w-full py-4 rounded-2xl bg-white text-black font-bold text-lg transition-all shadow-lg hover:bg-gray-200"
                          >
                            {isCompleting ? "Processing..." : (
                              isMarket && gig.market_type === 'RENT' ? "Mark Returned" : "Submit Work"
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-white/60 text-sm">Log in to interact with this gig.</p>
                  <button onClick={() => router.push('/login')} className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors">Login</button>
                </div>
              )}
            </div>

            {/* SELLER/POSTER PROFILE (Unmasked) */}
            <div className="bg-[#121217] border border-white/10 p-6 rounded-[32px] space-y-4 shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -z-10 group-hover:bg-white/10 transition-colors"></div>

              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Posted By</h3>

              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 ${(posterDetails?.jobs_completed || 0) > 10
                  ? "p-[2px] bg-gradient-to-r from-amber-500 to-yellow-600 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                  : "border border-white/5 bg-zinc-800"
                  }`}>
                  <div className="w-full h-full rounded-full overflow-hidden bg-zinc-900 relative flex items-center justify-center">
                    {posterDetails?.avatar_url ? (
                      <Image src={posterDetails.avatar_url} alt={posterDetails.name} width={56} height={56} className="object-cover w-full h-full" />
                    ) : (
                      <span className="text-white/40 font-bold text-lg">{posterDetails?.name?.[0] || "?"}</span>
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
                      <span className="font-bold">{posterDetails?.rating_count > 0 ? posterDetails.rating : "New"}</span>
                      {posterDetails?.rating_count > 0 && <span className="text-yellow-500/50">({posterDetails.rating_count})</span>}
                    </span>
                    <span>• {posterDetails?.jobs_completed || 0} Jobs Done</span>
                  </div>
                </div>
              </div>

              {user && user.id !== gig.poster_id && (
                <button
                  onClick={handleMessage}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-white font-medium transition-all active:scale-[0.98]"
                >
                  <MessageSquare size={16} />
                  Message Poster
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0B0B11]/80 backdrop-blur-xl border-t border-white/10 z-50 md:hidden pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-full duration-500">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
              {isMarket ? (gig.market_type === "RENT" ? "Rental Fee" : "Price") : "Budget"}
            </p>
            <p className="text-xl font-mono font-bold text-white">₹{gig.price}</p>
          </div>

          <div className="flex-1">
            {isOwner ? (
              status === 'open' ? (
                <button onClick={handleCancel} disabled={isCancelling} className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-sm">
                  {isCancelling ? "..." : "Cancel"}
                </button>
              ) : (status === 'assigned' || status === 'delivered') ? (
                <button onClick={handleComplete} disabled={isCompleting} className="w-full py-3 rounded-xl bg-green-500 text-black font-bold text-sm shadow-lg shadow-green-500/20">
                  {isCompleting ? "..." : "Complete"}
                </button>
              ) : (
                <button disabled className="w-full py-3 rounded-xl bg-white/5 text-white/40 font-bold text-sm">
                  {status}
                </button>
              )
            ) : (
              isWorker && status === 'assigned' ? (
                <button onClick={handleDeliver} disabled={isCompleting} className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm shadow-lg">
                  {isCompleting ? "..." : (isMarket && gig.market_type === 'RENT' ? "Returned" : "Submit")}
                </button>
              ) : status === 'open' ? (
                <button
                  onClick={isMarket ? handleBuy : handleApplyNavigation}
                  disabled={isBuying || hasApplied}
                  className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg ${hasApplied ? "bg-white/10 text-white/50" : "bg-white text-black"}`}
                >
                  {isBuying ? "..." : (hasApplied ? "Applied" : (isMarket ? (gig.market_type === 'RENT' ? "Rent Now" : "Buy Now") : "Apply Now"))}
                </button>
              ) : (
                <button disabled className="w-full py-3 rounded-xl bg-white/5 text-white/40 font-bold text-sm">
                  {status === 'completed' ? "Completed" : "Assigned"}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all"><X className="w-8 h-8" /></button>
          <div className="relative w-full max-w-6xl h-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()} >
            <Image src={selectedImage} alt="Fullscreen Attachment" fill className="object-contain" quality={100} />
          </div>
        </div>
      )}

    </div>
  );
}