"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { 
  Clock, 
  MapPin, 
  IndianRupee, 
  ArrowLeft, 
  ShieldCheck, 
  Send, 
  X, 
  Maximize2, 
  AlertTriangle, 
  Briefcase, 
  CheckCircle, 
  FileText, 
  Star, 
  ExternalLink, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Calendar,
  Lock,
  RefreshCcw
} from "lucide-react";

// --- UTILITY: TIME AGO FORMATTER (UTC FIX) ---
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

function formatDate(dateString: string | null) {
    if (!dateString) return "No Deadline";
    return new Date(dateString).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
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
  escrow_status?: string;
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
  const [submitting, setSubmitting] = useState(false);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // --- FULL-PROOF PAYMENT VERIFICATION WITH RETRIES ---
  const verifyPayment = useCallback(async (orderId: string, workerId: string, attempt = 1) => {
      setVerifyingPayment(true);
      setVerifyError(null);
      setVerifyMessage(attempt > 1 ? `Syncing with bank (Attempt ${attempt}/3)...` : "Verifying payment status...");

      try {
          // Add a strategic delay for subsequent attempts to let gateway status propagate
          if (attempt > 1) await new Promise(r => setTimeout(r, 2500));

          const res = await fetch("/api/payments/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId, gigId: id, workerId })
          });

          const data = await res.json();

          if (data.success || data.message === "Transaction already processed") {
              setVerifyMessage("Success! Setting up your project room...");
              // Wait 1.5s so user sees success before the hard redirect cleans the URL
              setTimeout(() => {
                window.location.href = `/gig/${id}`; 
              }, 1500);
          } else {
              // Handle logic based on attempt count
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
            .select("email, kyc_verified, name, avatar_url")
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
          const { count } = await supabase
            .from("applications")
            .select("*", { count: 'exact', head: true })
            .eq("gig_id", id);
          setApplicantCount(count || 0);
        }

        if (gigData.images && Array.isArray(gigData.images) && gigData.images.length > 0) {
          const urls = gigData.images.map((path: string) => {
              if (path.startsWith('http')) return path;
              return supabase.storage.from("gig-images").getPublicUrl(path).data?.publicUrl;
            }).filter(Boolean) as string[];
          setImageUrls(urls);
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

  // --- HANDLERS ---
  const handleApplyNavigation = () => {
    if (!user) return alert("Please login to apply.");
    router.push(`/gig/${id}/apply`);
  };

  const handleDeliver = async () => {
    if (!gig?.is_physical && !deliveryLink.trim()) return alert("Please enter a submission link.");
    if (!confirm("Notify the poster that the work is finished?")) return;
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!rating) return alert("Select a rating.");
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  const handleRefund = async () => {
    if (!confirm("Cancel gig and refund budget?")) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/escrow/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id, posterId: user?.id }),
      });
      if (res.ok) router.push("/dashboard");
      else alert("Refund failed");
    } catch (e) {
      alert("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = async () => {
    const reason = prompt("Describe the issue (min 50 chars):");
    if (!reason || reason.length < 50) return alert("Reason too short.");
    setSubmitting(true);
    try {
        const res = await fetch("/api/gig/dispute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gigId: id, reason }),
        });
        if (res.ok) window.location.reload();
    } catch (e) {
        alert("Error raising dispute.");
    } finally {
        setSubmitting(false);
    }
  };

  const getPosterName = () => isOwner ? "You" : posterDetails?.name || "User";
  const getPosterInitial = () => getPosterName().charAt(0).toUpperCase();

  // --- RENDER ---
  
  // VERIFICATION SCREEN (Now part of the main UI flow)
  if (verifyingPayment) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex flex-col items-center justify-center text-white p-6">
        <div className="w-full max-w-md bg-[#121217] border border-white/10 rounded-[32px] p-10 text-center space-y-8 shadow-2xl animate-in zoom-in-95">
          <div className="relative mx-auto w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-brand-purple/20 border-t-brand-purple animate-spin" />
            <div className="absolute inset-4 rounded-full bg-brand-purple/10 flex items-center justify-center">
               <ShieldCheck className="w-8 h-8 text-brand-purple" />
            </div>
          </div>
          
          <div className="space-y-3">
            <h2 className="text-2xl font-black">{verifyError ? "Verification Issue" : "Secure Payment"}</h2>
            <p className={`text-sm ${verifyError ? "text-red-400" : "text-white/60"}`}>
              {verifyError || verifyMessage}
            </p>
          </div>

          {verifyError && (
            <button 
              onClick={() => verifyPayment(searchParams.get("order_id")!, searchParams.get("worker_id")!)}
              className="w-full py-4 bg-white text-black font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <RefreshCcw className="w-5 h-5" /> Try Again
            </button>
          )}

          <div className="pt-4 border-t border-white/5">
             <p className="text-[10px] uppercase tracking-widest text-white/20 font-bold">Secure Escrow System</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-purple" /></div>;
  if (error || !gig) return <div className="min-h-screen bg-[#0B0B11] flex flex-col items-center justify-center text-white p-6 text-center"><AlertCircle className="w-12 h-12 text-red-500 mb-4"/><h1 className="text-2xl font-bold mb-2">Gig Unavailable</h1><p className="text-white/50 mb-6">This gig might have been deleted or closed.</p><button onClick={() => router.push("/feed")} className="px-8 py-3 bg-white text-black rounded-full font-bold">Return to Feed</button></div>;

  const status = gig.status.toLowerCase();
  const isAssigned = status === 'assigned';
  const isDelivered = status === 'delivered'; 
  const isCompleted = status === 'completed';
  const isDisputed = status === 'disputed';
  const showChat = (isWorker || isOwner) && (isAssigned || isDelivered || isCompleted || isDisputed);

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-4 md:p-8 flex justify-center pb-24 relative selection:bg-brand-purple">
      
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-purple/10 blur-[150px] rounded-full opacity-50"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-blue/10 blur-[150px] rounded-full opacity-50"></div>
      </div>

      {/* Review Modal */}
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
            <button onClick={handleComplete} disabled={submitting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
              {submitting ? <Loader2 className="animate-spin"/> : <CheckCircle className="w-5 h-5"/>} Approve & Release Funds
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="w-full max-w-6xl relative z-10 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white group">
            <div className="p-2 rounded-full bg-white/5 border border-white/5"><ArrowLeft className="w-5 h-5" /></div>
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
        </div>

        {/* Status Banners */}
        {isDelivered && !isCompleted && !isDisputed && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex items-center gap-4 text-blue-400 animate-in slide-in-from-top-4">
            <CheckCircle2 className="w-6 h-6" />
            <div><h4 className="font-bold">Task Delivered!</h4><p className="text-sm opacity-80">Review the work and release the payment if satisfied.</p></div>
          </div>
        )}
        {isCompleted && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 flex items-center gap-4 text-green-400">
             <ShieldCheck className="w-6 h-6" />
             <div><h4 className="font-bold">Payment Released</h4><p className="text-sm opacity-80">This project is officially closed and funds have been sent.</p></div>
          </div>
        )}
        {isDisputed && (
           <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-center gap-4 text-red-400">
             <AlertTriangle className="w-6 h-6" />
             <div><h4 className="font-bold">Under Dispute</h4><p className="text-sm opacity-80">Reason: "{gig.dispute_reason}"</p></div>
           </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Project Body */}
          <div className="lg:col-span-2 space-y-6">
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#121217] p-6 md:p-10 shadow-2xl">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase border bg-brand-purple/10 border-brand-purple/20 text-brand-purple tracking-widest">{status}</span>
                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-medium"><Clock className="w-3.5 h-3.5" /> Posted {timeAgo(gig.created_at)}</span>
                  {gig.deadline && <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium"><Calendar className="w-3.5 h-3.5" /> Deadline: {formatDate(gig.deadline)}</span>}
                </div>
                <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight">{gig.title}</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-5 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center shrink-0"><IndianRupee className="w-6 h-6" /></div>
                    <div><p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Fixed Budget</p><p className="text-2xl font-bold">₹{gig.price.toLocaleString()}</p></div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-5 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-brand-pink/10 text-brand-pink flex items-center justify-center shrink-0"><MapPin className="w-6 h-6" /></div>
                    <div><p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Location</p><p className="text-xl font-bold truncate max-w-[150px]">{gig.location || "Remote"}</p></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[#121217] p-8 md:p-10 shadow-lg">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><div className="w-1.5 h-6 bg-brand-blue rounded-full"></div>Detailed Requirements</h3>
              <p className="text-white/80 leading-relaxed whitespace-pre-line text-lg font-light">{gig.description}</p>
            </div>

            {/* Submission Link Viewer */}
            {(isDelivered || isCompleted || isDisputed) && gig.delivery_link && (
              <div className="rounded-[32px] border border-brand-purple/30 bg-[#121217] p-8 md:p-10">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><div className="p-2 bg-brand-purple/20 rounded-lg text-brand-purple"><FileText className="w-5 h-5"/></div>Final Deliverable</h3>
                <div className="bg-[#0B0B11] p-6 rounded-2xl border border-white/10">
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-3">Submission Link</p>
                  <a href={gig.delivery_link.startsWith("http") ? gig.delivery_link : "#"} target="_blank" rel="noreferrer" className="text-brand-purple text-lg font-mono hover:text-white flex items-center gap-3 break-all">
                    <ExternalLink className="w-5 h-5 shrink-0 opacity-50"/> {gig.delivery_link} 
                  </a>
                </div>
              </div>
            )}
            
            {/* Gallery */}
            {imageUrls.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-3 px-2"><div className="w-1.5 h-6 bg-brand-purple rounded-full"></div>Reference Images</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} onClick={() => setSelectedImage(url)} className="group relative aspect-video rounded-3xl overflow-hidden border border-white/10 cursor-pointer bg-black/40 hover:border-white/30 transition-all">
                      <Image src={url} alt="Attached" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="w-10 h-10 text-white" /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Sidebar Actions */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-[32px] border border-white/10 bg-[#1A1A24] p-8 shadow-xl sticky top-8 z-20">
              <div className="flex items-center gap-4 pb-6 border-b border-white/5 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-white uppercase overflow-hidden relative text-2xl">
                   {posterDetails?.avatar_url ? <Image src={posterDetails.avatar_url} alt="User" fill className="object-cover" /> : getPosterInitial()}
                </div>
                <div>
                  <p className="text-xs text-white/30 font-black uppercase tracking-widest mb-1">Posted By</p>
                  <p className="font-bold text-lg">{getPosterName()}</p>
                  {posterDetails?.kyc_verified && <div className="text-green-400 text-[10px] mt-1 flex items-center gap-1 uppercase font-black"><ShieldCheck className="w-3 h-3"/> ID Verified</div>}
                </div>
              </div>

              <div className="space-y-4">
                
                {/* 1. Worker Delivery Flow */}
                {isWorker && isAssigned && !gig.delivery_link && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    {!gig.is_physical ? (
                       <div className="p-5 rounded-2xl bg-[#0B0B11] border border-white/10">
                          <label className="text-[10px] text-white/30 block mb-3 font-black uppercase tracking-widest">Submission URL</label>
                          <input type="text" placeholder="https://google.drive/..." value={deliveryLink} onChange={(e) => setDeliveryLink(e.target.value)} className="w-full bg-[#121217] border border-white/10 rounded-xl p-4 text-sm text-white focus:border-brand-purple outline-none" />
                       </div>
                    ) : (
                       <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                          <p className="leading-relaxed">Once the task is done in person, mark it as completed to notify the client.</p>
                       </div>
                    )}
                    <button onClick={handleDeliver} disabled={submitting} className="w-full py-4 bg-white text-black font-black rounded-2xl hover:bg-gray-100 flex justify-center items-center gap-2 active:scale-95 transition-all">
                        {submitting ? <Loader2 className="animate-spin w-5 h-5"/> : <Send className="w-5 h-5"/>} 
                        {gig.is_physical ? "Confirm Completion" : "Submit & Finish"}
                    </button>
                  </div>
                )}

                {/* 2. Poster Review Flow */}
                {isOwner && (isDelivered || gig.delivery_link) && !isCompleted && !isDisputed && (
                  <div className="p-6 rounded-3xl bg-brand-purple/10 border border-brand-purple/20 text-center space-y-6">
                    <div><h3 className="font-black text-xl mb-1">Review Work</h3><p className="text-xs text-white/50">Does it meet your requirements?</p></div>
                    <div className="flex flex-col gap-3">
                        <button onClick={() => setShowReviewModal(true)} disabled={submitting} className="w-full py-4 bg-green-500 text-black font-black rounded-2xl hover:bg-green-400 flex items-center justify-center gap-2 active:scale-95 transition-all"><CheckCircle className="w-5 h-5"/> Approve & Pay</button>
                        <button onClick={handleDispute} disabled={submitting} className="w-full py-3 text-red-400 font-bold rounded-xl hover:bg-red-500/10 text-xs">Raise Dispute</button>
                    </div>
                  </div>
                )}

                {/* 3. Manage Applicants (Open Status) */}
                {isOwner && status === 'open' && (
                  <div className="bg-[#121217] border border-white/10 rounded-3xl p-6 text-center space-y-6">
                    <div><span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/40">{applicantCount}</span><p className="text-[10px] font-black uppercase text-white/30 tracking-[0.2em] mt-2">Interested Students</p></div>
                    <Link href={`/gig/${id}/applicants`} className="block w-full py-4 bg-brand-purple text-white font-black rounded-2xl hover:bg-brand-purple/90 flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-brand-purple/20"><Briefcase className="w-5 h-5"/> Manage Applicants</Link>
                  </div>
                )}

                {/* 4. Visitor/Applicant Flow */}
                {!isOwner && !isWorker && (
                    status === 'open' ? (
                        hasApplied ? (
                            <div className="w-full py-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 font-black flex items-center justify-center gap-2 text-sm uppercase tracking-widest"><CheckCircle2 className="w-5 h-5" /> Applied</div>
                        ) : (
                            <button onClick={handleApplyNavigation} className="w-full py-4 bg-white text-black font-black rounded-2xl hover:scale-105 transition-transform flex items-center justify-center gap-2 active:scale-95"><Send className="w-5 h-5"/> Apply Now</button>
                        )
                    ) : (
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/5 text-center">
                            <Lock className="w-10 h-10 text-white/10 mx-auto mb-4" />
                            <h3 className="font-bold text-white/60">Gig Closed</h3>
                            <p className="text-xs text-white/30 mt-2">Worker already assigned.</p>
                        </div>
                    )
                )}

                {/* 5. Shared Chat Button */}
                {showChat && (
                  <Link href={`/chat/${id}`} className="block w-full py-4 bg-[#121217] border border-white/10 text-white/60 font-black rounded-2xl text-center hover:text-white transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg">
                    <MessageSquare className="w-5 h-5 text-brand-purple" /> Project Chat
                  </Link>
                )}

                {/* 6. Cancel Gig (Owner Only) */}
                {isOwner && status === "open" && gig.escrow_status !== "RELEASED" && (
                   <div className="pt-6 border-t border-white/5">
                      <button 
                        onClick={handleRefund} 
                        disabled={submitting}
                        className="w-full py-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-500/40 hover:bg-red-500/10 hover:text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <AlertTriangle className="w-4 h-4" /> Cancel Request
                      </button>
                   </div>
                )}
              </div>
            </div>
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