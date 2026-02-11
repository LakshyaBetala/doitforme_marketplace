"use client";

import { useEffect, useState, useCallback } from "react";
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
  Lock
} from "lucide-react";

// --- UTILITY: TIME AGO FORMATTER (UTC FIX) ---
function timeAgo(dateString: string) {
  if (!dateString) return "";
  // Force UTC interpretation
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
  is_physical: boolean; // Field for logic
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
  const [error, setError] = useState<string | null>(null);
  
  // Flags
  const [isOwner, setIsOwner] = useState(false);
  const [isWorker, setIsWorker] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicantCount, setApplicantCount] = useState(0);

  // Forms
  const [deliveryLink, setDeliveryLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // --- PAYMENT VERIFICATION ---
  const verifyPayment = useCallback(async (orderId: string, workerId: string) => {
      if (verifyingPayment) return;
      setVerifyingPayment(true);

      try {
          const res = await fetch("/api/payments/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId, gigId: id, workerId })
          });

          const data = await res.json();

          if (data.success || data.message === "Transaction already processed") {
              window.location.href = `/gig/${id}`; 
          } else {
              alert("Payment Verification Failed: " + (data.error || "Unknown error"));
              setVerifyingPayment(false);
          }
      } catch (e) {
          console.error("Verification error:", e);
          setVerifyingPayment(false);
      }
  }, [id, verifyingPayment]);

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

        // Roles
        const posterId = gigData.poster_id;
        const isUserOwner = currentUser && (currentUser.id === posterId);
        setIsOwner(!!isUserOwner);

        const isUserWorker = currentUser && (currentUser.id === gigData.assigned_worker_id);
        setIsWorker(!!isUserWorker);

        // Fetch Poster Details
        if (posterId) {
          const { data: posterData } = await supabase
            .from("users") 
            .select("email, kyc_verified, name, avatar_url")
            .eq("id", posterId)
            .maybeSingle();
          setPosterDetails(posterData);
        }

        // Application Check
        if (currentUser && !isUserOwner && !isUserWorker) {
          const { data: application } = await supabase
            .from("applications")
            .select("id")
            .eq("gig_id", id)
            .eq("worker_id", currentUser.id)
            .maybeSingle();
          if (application) setHasApplied(true);
        }

        // Applicant Count
        if (isUserOwner) {
          const { count } = await supabase
            .from("applications")
            .select("*", { count: 'exact', head: true })
            .eq("gig_id", id);
          setApplicantCount(count || 0);
        }

        // Images
        if (gigData.images && Array.isArray(gigData.images) && gigData.images.length > 0) {
          const urls = gigData.images.map((path: string) => {
              if (path.startsWith('http')) return path;
              return supabase.storage.from("gig-images").getPublicUrl(path).data?.publicUrl;
            }).filter(Boolean) as string[];
          setImageUrls(urls);
        }

      } catch (err: any) {
        console.error("Load Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadGigAndUser();

    // Realtime Updates
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
    // Only check for link if it is NOT a physical gig
    if (!gig?.is_physical && !deliveryLink.trim()) {
        return alert("Please enter a link to your work (Google Drive, GitHub, etc).");
    }
    
    if (!confirm("Are you sure you want to mark this work as done? The client will be notified.")) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/gig/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id, workerId: user?.id, deliveryLink }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert("Work submitted!");
        window.location.reload();
      } else {
        throw new Error(json.error || "Submission failed");
      }
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
      const json = await res.json();
      if (res.ok && json.success) {
        alert("Gig completed! Funds released.");
        window.location.reload();
      } else {
        throw new Error(json.error || "Completion failed");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefund = async () => {
    if (!confirm("Cancel gig? This cannot be undone.")) return;
    
    setSubmitting(true);
    try {
      const res = await fetch("/api/escrow/refund", { // Corrected endpoint
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          gigId: id, 
          posterId: user?.id // Added required posterId for the backend
        }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Gig cancelled.");
        router.push("/dashboard");
      } else {
        alert(json.error || "Cancellation failed");
      }
    } catch (e) {
      alert("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = async () => {
    const reason = prompt("Explain rejection reason (min 50 chars).");
    if (!reason || reason.length < 50) return alert("Reason too short.");
    setSubmitting(true);
    try {
        const res = await fetch("/api/gig/dispute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gigId: id, reason }),
        });
        const json = await res.json();
        if (json.success) {
            alert("Dispute raised.");
            window.location.reload();
        } else {
            alert(json.error || "Failed");
        }
    } catch (e) {
        alert("Network Error");
    } finally {
        setSubmitting(false);
    }
  };

  const getPosterName = () => isOwner ? "You" : posterDetails?.name || "Unknown";
  const getPosterInitial = () => getPosterName().charAt(0).toUpperCase();

  // --- RENDER ---
  if (verifyingPayment) return <div className="min-h-screen bg-[#0B0B11] flex flex-col items-center justify-center text-white"><Loader2 className="w-12 h-12 animate-spin text-green-500 mb-4"/><h2 className="text-xl font-bold">Verifying Payment...</h2></div>;
  if (loading) return <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-brand-purple" /></div>;
  if (error || !gig) return <div className="min-h-screen bg-[#0B0B11] flex flex-col items-center justify-center text-white"><AlertCircle className="w-8 h-8 text-red-500 mb-4"/><h1 className="text-xl">Gig Unavailable</h1><button onClick={() => router.push("/feed")} className="mt-4 px-6 py-2 bg-white text-black rounded-full font-bold">Return to Feed</button></div>;

  const status = gig.status.toLowerCase();
  const isAssigned = status === 'assigned';
  const isDelivered = status === 'delivered'; 
  const isCompleted = status === 'completed';
  const isDisputed = status === 'disputed';
  
  // --- CHAT BUTTON LOGIC ---
  const showChat = (isWorker || isOwner) && (isAssigned || isDelivered || isCompleted || isDisputed);

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-4 md:p-8 flex justify-center pb-24 relative selection:bg-brand-purple selection:text-white">
      
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
            <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Review..." className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 mb-6 h-32 outline-none" />
            <button onClick={handleComplete} disabled={submitting} className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="animate-spin"/> : <CheckCircle className="w-5 h-5"/>} Approve & Release Funds
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="w-full max-w-6xl relative z-10 space-y-6">
        {/* Nav */}
        <div className="flex justify-between items-center mb-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white group">
            <div className="p-2 rounded-full bg-white/5 border border-white/5"><ArrowLeft className="w-5 h-5" /></div>
            <span className="text-sm font-medium">Back to Dashboard</span>
          </Link>
        </div>

        {/* Notifications */}
        {isDelivered && !isCompleted && !isDisputed && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex items-center gap-4 text-blue-400">
            <CheckCircle2 className="w-6 h-6" />
            <div><h4 className="font-bold">Work Delivered!</h4><p className="text-sm opacity-80">Review work below.</p></div>
          </div>
        )}
        
        {isCompleted && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-4 text-green-400">
             <ShieldCheck className="w-6 h-6" />
             <div><h4 className="font-bold">Gig Completed</h4><p className="text-sm opacity-80">Transaction finalized.</p></div>
          </div>
        )}

        {isDisputed && (
           <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-4 text-red-400">
             <AlertTriangle className="w-6 h-6" />
             <div><h4 className="font-bold">Dispute Raised</h4><p className="text-sm opacity-80">Funds frozen: "{gig.dispute_reason}"</p></div>
           </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT: Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Header Card */}
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#121217] p-6 md:p-10 shadow-2xl">
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase border bg-white/5 border-white/10">{status}</span>
                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-medium"><Clock className="w-3.5 h-3.5" /> Posted {timeAgo(gig.created_at)}</span>
                  {gig.deadline && <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium"><Calendar className="w-3.5 h-3.5" /> Deadline: {formatDate(gig.deadline)}</span>}
                </div>
                <h1 className="text-3xl md:text-5xl font-black leading-tight">{gig.title}</h1>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center shrink-0"><IndianRupee className="w-6 h-6" /></div>
                    <div><p className="text-[10px] text-white/40 uppercase font-bold">Budget</p><p className="text-2xl font-bold">₹{gig.price.toLocaleString()}</p></div>
                  </div>
                  <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-brand-pink/10 text-brand-pink flex items-center justify-center shrink-0"><MapPin className="w-6 h-6" /></div>
                    <div><p className="text-[10px] text-white/40 uppercase font-bold">Location</p><p className="text-xl font-bold">{gig.location || "Remote"}</p></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-[#121217] p-8 shadow-lg">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><div className="w-1.5 h-6 bg-brand-blue rounded-full"></div>Description</h3>
              <p className="text-white/80 leading-relaxed whitespace-pre-line text-lg font-light">{gig.description}</p>
            </div>

            {/* Submission Area */}
            {(isDelivered || isCompleted || isDisputed) && (isOwner || isWorker) && gig.delivery_link && (
              <div className="rounded-[32px] border border-brand-purple/30 bg-[#121217] p-8">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-3"><div className="p-2 bg-brand-purple/20 rounded-lg text-brand-purple"><FileText className="w-5 h-5"/></div>Project Submission</h3>
                <div className="bg-[#0B0B11] p-6 rounded-2xl border border-white/10 mb-4">
                  <p className="text-white/40 text-xs font-bold uppercase mb-2">Deliverable Link / Status</p>
                  <a href={gig.delivery_link.startsWith("http") ? gig.delivery_link : "#"} target={gig.delivery_link.startsWith("http") ? "_blank" : "_self"} rel="noreferrer" className="text-brand-purple text-lg font-mono hover:text-white flex items-center gap-2">
                    {gig.delivery_link} 
                    {gig.delivery_link.startsWith("http") && <ExternalLink className="w-4 h-4 opacity-50"/>}
                  </a>
                </div>
              </div>
            )}
            
            {/* Images */}
            {imageUrls.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold flex items-center gap-3 px-2"><div className="w-1.5 h-6 bg-brand-purple rounded-full"></div>Attachments ({imageUrls.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} onClick={() => setSelectedImage(url)} className="group relative aspect-video rounded-2xl overflow-hidden border border-white/10 cursor-pointer bg-black/40 hover:border-white/30">
                      <Image src={url} alt="Att" fill className="object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="w-8 h-8 text-white" /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Actions */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-[#1A1A24] p-6 shadow-xl sticky top-4 z-20">
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-4 border-b border-white/5 pb-2">Posted By</p>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#1A1A24] border border-white/10 flex items-center justify-center font-bold text-white uppercase overflow-hidden relative">
                   {posterDetails?.avatar_url ? <Image src={posterDetails.avatar_url} alt="User" fill className="object-cover" /> : <span className="text-xl">{getPosterInitial()}</span>}
                </div>
                <div><p className="font-bold text-lg">{getPosterName()}</p>{posterDetails?.kyc_verified && <div className="text-green-400 text-xs mt-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3"/> Verified</div>}</div>
              </div>

              <div className="mt-8 space-y-3">
                
                {/* 1. Submit Work (Worker Only) */}
                {isWorker && isAssigned && !gig.delivery_link && (
                  <div className="space-y-3">
                    {!gig.is_physical ? (
                       <div className="p-4 rounded-xl bg-[#0B0B11] border border-white/10">
                          <label className="text-xs text-white/50 block mb-2 font-bold uppercase">Submission URL</label>
                          <input type="text" placeholder="https://..." value={deliveryLink} onChange={(e) => setDeliveryLink(e.target.value)} className="w-full bg-[#121217] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-brand-purple outline-none" />
                          <p className="text-[10px] text-white/40 mt-2">
                             Please submit a Google Drive link or GitHub repository.
                          </p>
                       </div>
                    ) : (
                       <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                          <p>Once you have completed the task in person, click below to notify the poster.</p>
                       </div>
                    )}
                    
                    <button onClick={handleDeliver} disabled={submitting} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-100 flex justify-center gap-2">
                        {submitting ? <Loader2 className="animate-spin"/> : <Send className="w-5 h-5"/>} 
                        {gig.is_physical ? "Mark as Completed" : "Submit Work"}
                    </button>
                  </div>
                )}

                {/* 2. Review (Poster Only) */}
                {isOwner && (isDelivered || gig.delivery_link) && !isCompleted && !isDisputed && (
                  <div className="p-5 rounded-2xl bg-[#0B0B11] border border-white/10 text-center space-y-4">
                    <div><h3 className="font-bold text-lg">Work Delivered</h3><p className="text-xs text-white/50">Review above.</p></div>
                    <div className="flex gap-3">
                        <button onClick={handleDispute} disabled={submitting} className="flex-1 py-3 bg-red-500/10 text-red-400 font-bold rounded-xl hover:bg-red-500/20 border border-red-500/20 text-sm">Raise Dispute</button>
                        <button onClick={() => setShowReviewModal(true)} disabled={submitting} className="flex-[2] py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5"/> Approve</button>
                    </div>
                  </div>
                )}

                {/* 3. Manage (Owner) */}
                {isOwner && status === 'open' && (
                  <div className="bg-[#121217] border border-white/10 rounded-2xl p-5 text-center space-y-4">
                    <div><span className="text-4xl font-black">{applicantCount}</span><p className="text-xs font-bold uppercase text-white/40">Applicants</p></div>
                    <Link href={`/gig/${id}/applicants`} className="block w-full py-3 bg-brand-purple text-white font-bold rounded-xl hover:bg-brand-purple/90 flex items-center justify-center gap-2"><Briefcase className="w-4 h-4"/> View Applicants</Link>
                  </div>
                )}

                {/* 4. Apply / Rejected Status (Visitor/Applicant) */}
                {!isOwner && !isWorker && (
                    status === 'open' ? (
                        hasApplied ? (
                            <button disabled className="w-full py-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-500 font-bold flex items-center justify-center gap-2 opacity-80"><CheckCircle2 className="w-5 h-5" /> Application Sent</button>
                        ) : (
                            <button onClick={handleApplyNavigation} className="w-full py-4 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2"><Send className="w-5 h-5"/> Apply Now</button>
                        )
                    ) : (
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-center">
                            <div className="inline-flex p-3 rounded-full bg-white/5 mb-3"><AlertCircle className="w-6 h-6 text-white/40" /></div>
                            <h3 className="font-bold text-lg text-white">Gig Closed</h3>
                            <p className="text-xs text-white/50 mt-1">
                                {hasApplied ? "Another applicant was selected." : "This gig is no longer accepting applications."}
                            </p>
                        </div>
                    )
                )}

                {/* 5. Chat Button (Shared) */}
                {showChat && (
                  <Link href={`/chat/${id}`} className="block w-full py-3 bg-[#1A1A24] border border-white/10 text-white/70 font-bold rounded-xl text-center hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2">
                    <MessageSquare className="w-5 h-5 text-brand-purple" /> Open Project Chat
                  </Link>
                )}

                {/* 6. Cancel (Owner) - ONLY visible if gig is open and not finalized in escrow */}
                {isOwner && status === "open" && gig.escrow_status !== "RELEASED" && (
                   <div className="pt-4 border-t border-white/5">
                      <button 
                        onClick={handleRefund} 
                        disabled={submitting}
                        className="w-full py-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/60 hover:bg-red-500/10 hover:text-red-400 font-bold text-sm flex items-center justify-center gap-2"
                      >
                        <AlertTriangle className="w-4 h-4" /> Cancel Gig
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
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <button className="absolute top-6 right-6 p-3 bg-white/10 rounded-full text-white"><X className="w-8 h-8" /></button>
          <div className="relative w-full max-w-6xl h-full max-h-[85vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()} >
            <Image src={selectedImage} alt="Full view" fill className="object-contain" quality={100} />
          </div>
        </div>
      )}

    </div>
  );
}