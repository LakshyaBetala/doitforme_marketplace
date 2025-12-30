"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { 
  Clock, 
  MapPin, 
  IndianRupee, 
  User, 
  ArrowLeft, 
  ShieldCheck, 
  Send, 
  X, 
  Maximize2, 
  AlertTriangle, 
  Briefcase, 
  Users,
  CheckCircle, 
  FileText, 
  Star, 
  ExternalLink, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

// --- UTILITY: TIME AGO FORMATTER ---
function timeAgo(dateString: string) {
  if (!dateString) return "";
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// --- TYPES FOR SAFETY ---
interface GigData {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string | null;
  status: 'open' | 'ASSIGNED' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  poster_id: string;
  assigned_worker_id?: string;
  delivery_link?: string;
  delivered_at?: string;
  images?: string[];
  user_id?: string; // Legacy support if schema varies
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
  const id = params?.id as string;

  // --- STATE MANAGEMENT ---
  const [gig, setGig] = useState<GigData | null>(null);
  const [posterDetails, setPosterDetails] = useState<any>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  
  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // User Relationship Flags
  const [isOwner, setIsOwner] = useState(false);
  const [isWorker, setIsWorker] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicantCount, setApplicantCount] = useState(0);

  // Interaction States
  const [deliveryLink, setDeliveryLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Review Modal State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState("");

  // Lightbox State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // --- DATA LOADING EFFECT ---
  useEffect(() => {
    if (!id) return;

    const loadGigAndUser = async () => {
      try {
        setLoading(true);

        // 1. Get Current Authenticated User
        const { data: uData } = await supabase.auth.getUser();
        const currentUser = uData?.user;

        if (currentUser) {
          setUser({
            id: currentUser.id,
            email: currentUser.email,
            user_metadata: currentUser.user_metadata
          });
        }

        // 2. Fetch Gig Data
        const { data: gigData, error: gigError } = await supabase
          .from("gigs")
          .select("*")
          .eq("id", id)
          .single();

        if (gigError || !gigData) {
          throw new Error("Gig not found or access denied.");
        }

        setGig(gigData);

        // 3. Determine Roles
        const posterId = gigData.poster_id || gigData.user_id;
        const isUserOwner = currentUser && (currentUser.id === posterId);
        setIsOwner(!!isUserOwner);

        const isUserWorker = currentUser && (currentUser.id === gigData.assigned_worker_id);
        setIsWorker(!!isUserWorker);

        // 4. Fetch Additional Data based on Role
        if (posterId) {
          const { data: posterData } = await supabase
            .from("users") 
            .select("email, kyc_verified, name, avatar_url")
            .eq("id", posterId)
            .maybeSingle();
          
          setPosterDetails(posterData);
        }

        // 5. Check if User Has Applied (Strict Check)
        if (currentUser && !isUserOwner && !isUserWorker && gigData.status === 'open') {
          const { data: application } = await supabase
            .from("applications")
            .select("id")
            .eq("gig_id", id)
            .eq("worker_id", currentUser.id)
            .maybeSingle();
          
          if (application) {
            setHasApplied(true);
          }
        }

        // 6. Get Applicant Count (Only for Owner)
        if (isUserOwner) {
          const { count } = await supabase
            .from("applications")
            .select("*", { count: 'exact', head: true })
            .eq("gig_id", id);
          setApplicantCount(count || 0);
        }

        // 7. Resolve Image URLs
        if (gigData.images && Array.isArray(gigData.images)) {
          const urls = gigData.images
            .map((path: string) => {
              if (path.startsWith('http')) return path;
              return supabase.storage.from("gig-images").getPublicUrl(path).data?.publicUrl;
            })
            .filter(Boolean) as string[];
          setImageUrls(urls);
        }

      } catch (err: any) {
        console.error("Error loading gig details:", err);
        setError(err.message || "Failed to load gig.");
      } finally {
        setLoading(false);
      }
    };

    loadGigAndUser();
  }, [id, supabase]);


  // --- HANDLERS ---

  // 1. Apply Logic
  const handleApplyNavigation = () => {
    if (!user) {
      alert("You must be logged in to apply.");
      return;
    }
    router.push(`/gig/${id}/apply`);
  };

  // 2. Worker: Submit Delivery
  const handleDeliver = async () => {
    if (!deliveryLink.trim()) {
      alert("Please enter a valid link to your work (Google Drive, GitHub, etc).");
      return;
    }
    
    if (!confirm("Are you sure you want to submit this work? The client will be notified.")) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/gig/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id, deliveryLink }),
      });

      const json = await res.json();
      
      if (res.ok && json.success) {
        window.location.reload();
      } else {
        throw new Error(json.error || "Failed to submit work");
      }
    } catch (e: any) {
      alert(e.message || "Error submitting work. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Poster: Complete & Review
  const handleComplete = async () => {
    if (!rating) {
      alert("Please select a star rating.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/gig/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          gigId: id, 
          rating, 
          review: reviewText 
        }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        alert("Gig completed successfully! Funds released.");
        window.location.reload();
      } else {
        throw new Error(json.error || "Failed to complete gig");
      }
    } catch (e: any) {
      alert(e.message || "Error completing gig.");
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Poster: Cancel Gig
  const handleRefund = async () => {
    const confirmed = confirm("Are you sure? This will cancel the gig and refund your wallet. This action cannot be undone.");
    if (!confirmed) return;

    try {
      const res = await fetch("/api/gig/refund", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gigId: id }),
      });
      
      const json = await res.json();
      
      if (json.success) {
        alert("Gig cancelled and funds refunded.");
        router.push("/dashboard");
      } else {
        alert(json.error || "Refund failed");
      }
    } catch (e) {
      alert("Network error. Please check your connection.");
    }
  };

  // --- RENDER HELPERS ---
  const getPosterName = () => {
    if (isOwner) return "You";
    return posterDetails?.name || posterDetails?.email?.split('@')[0] || "Unknown User";
  };

  const getPosterInitial = () => {
    const name = getPosterName();
    return name.charAt(0).toUpperCase();
  };

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-brand-purple" />
          <p className="text-white/50 text-sm">Loading Gig Details...</p>
        </div>
      </div>
    );
  }
  
  // --- ERROR STATE ---
  if (error || !gig) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex flex-col items-center justify-center text-white p-4 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Gig Unavailable</h1>
        <p className="text-white/50 max-w-md mb-8">{error || "This gig may have been deleted or does not exist."}</p>
        <button 
          onClick={() => router.push("/feed")} 
          className="px-6 py-3 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
        >
          Return to Feed
        </button>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-4 md:p-8 flex justify-center pb-24 relative selection:bg-brand-purple selection:text-white">
      
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-purple/10 blur-[150px] rounded-full opacity-50"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-blue/10 blur-[150px] rounded-full opacity-50"></div>
      </div>

      {/* --- REVIEW MODAL (POSTER ONLY) --- */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 duration-200 relative shadow-2xl">
            <button 
              onClick={() => setShowReviewModal(false)}
              className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-2xl font-bold text-white mb-2 text-center">Rate Experience</h2>
            <p className="text-white/50 text-sm mb-8 text-center">
              Releasing funds confirms you are satisfied with the work. This cannot be undone.
            </p>
            
            <div className="flex justify-center gap-3 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  onClick={() => setRating(star)} 
                  className="focus:outline-none transition-transform hover:scale-110 active:scale-95 group"
                >
                  <Star 
                    className={`w-10 h-10 transition-colors ${
                      star <= rating 
                        ? "fill-yellow-500 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" 
                        : "text-white/10 group-hover:text-white/30"
                    }`} 
                  />
                </button>
              ))}
            </div>

            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Review (Optional)</label>
            <textarea 
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you like about the work?"
              className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 text-white mb-6 h-32 focus:border-brand-purple outline-none resize-none placeholder:text-white/20"
            />

            <button 
              onClick={handleComplete}
              disabled={submitting}
              className="w-full py-4 bg-brand-purple text-white font-bold rounded-xl hover:bg-brand-purple/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="animate-spin"/> : <CheckCircle className="w-5 h-5"/>}
              Approve & Release Funds
            </button>
          </div>
        </div>
      )}

      {/* --- CONTENT CONTAINER --- */}
      <div className="w-full max-w-6xl relative z-10 space-y-6">
        
        {/* Navigation Bar */}
        <div className="flex justify-between items-center mb-4">
          {/* UPDATED BACK BUTTON TO /gig/my-gigs */}
          <Link 
            href="/gig/my-gigs"
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors group"
          >
            <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors border border-white/5">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Back to My Gigs</span>
          </Link>
        </div>

        {/* --- STATUS NOTIFICATIONS --- */}
        {gig.status === 'DELIVERED' && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 md:p-6 flex items-start md:items-center gap-4 text-blue-400 animate-in fade-in slide-in-from-top-4">
            <div className="p-2 bg-blue-500/20 rounded-full shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-lg">Work Delivered!</h4>
              <p className="text-sm opacity-80 mt-1">
                {isOwner 
                  ? "The worker has submitted their work. Please review it below and approve to release funds." 
                  : "You have submitted your work. Waiting for client approval."}
              </p>
            </div>
          </div>
        )}
        
        {gig.status === 'COMPLETED' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 md:p-6 flex items-center gap-4 text-green-400">
             <div className="p-2 bg-green-500/20 rounded-full shrink-0">
               <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
               <h4 className="font-bold text-lg">Gig Completed</h4>
               <p className="text-sm opacity-80">This transaction has been finalized and paid out.</p>
             </div>
          </div>
        )}

        {gig.status === 'CANCELLED' && (
           <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 md:p-6 flex items-center gap-4 text-red-400">
             <div className="p-2 bg-red-500/20 rounded-full shrink-0">
               <AlertTriangle className="w-6 h-6" />
             </div>
             <div>
               <h4 className="font-bold text-lg">Gig Cancelled</h4>
               <p className="text-sm opacity-80">This gig was cancelled by the poster.</p>
             </div>
           </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* --- LEFT COLUMN: DETAILS --- */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Header Card */}
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#121217] p-6 md:p-10 shadow-2xl">
              {/* Card Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>

              <div className="flex flex-col gap-6">
                
                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${
                    gig.status === 'open' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
                    gig.status === 'ASSIGNED' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                    gig.status === 'DELIVERED' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                    gig.status === 'COMPLETED' ? 'bg-teal-500/10 border-teal-500/20 text-teal-400' :
                    'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    {gig.status.replace(/_/g, " ")}
                  </span>
                  <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-medium">
                    <Clock className="w-3.5 h-3.5" /> {timeAgo(gig.created_at)}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-3xl md:text-5xl font-black leading-tight text-white tracking-tight">
                  {gig.title}
                </h1>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-green-500/10 text-green-400 flex items-center justify-center shrink-0">
                      <IndianRupee className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-0.5">Budget</p>
                      <p className="text-2xl font-bold text-white leading-none">₹{gig.price.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/5">
                    <div className="w-12 h-12 rounded-full bg-brand-pink/10 text-brand-pink flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-0.5">Location</p>
                      <p className="text-xl font-bold text-white leading-none truncate max-w-[150px]">
                        {gig.location || "Remote"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Description Card */}
            <div className="rounded-[32px] border border-white/10 bg-[#121217] p-8 shadow-lg">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                <div className="w-1.5 h-6 bg-brand-blue rounded-full"></div>
                Description
              </h3>
              <div className="prose prose-invert max-w-none">
                <p className="text-white/80 leading-relaxed whitespace-pre-line text-lg font-light">
                  {gig.description}
                </p>
              </div>
            </div>

            {/* --- SUBMISSION DISPLAY (Public/Restricted View) --- */}
            {(gig.status === 'DELIVERED' || gig.status === 'COMPLETED') && (isOwner || isWorker) && (
              <div className="rounded-[32px] border border-brand-purple/30 bg-[#121217] p-8 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-purple to-brand-blue"></div>
                <div className="absolute inset-0 bg-brand-purple/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <div className="p-2 bg-brand-purple/20 rounded-lg text-brand-purple">
                    <FileText className="w-5 h-5"/>
                  </div>
                  Project Submission
                </h3>

                <div className="bg-[#0B0B11] p-6 rounded-2xl border border-white/10 break-all relative group/link">
                  <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">Deliverable Link</p>
                  <a 
                    href={gig.delivery_link} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-brand-purple text-lg font-mono hover:text-white transition-colors flex items-center gap-2"
                  >
                    {gig.delivery_link} <ExternalLink className="w-4 h-4 opacity-50"/>
                  </a>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-white/40 font-mono">
                  <Clock className="w-3 h-3" />
                  Submitted {gig.delivered_at ? timeAgo(gig.delivered_at) : 'recently'}
                </div>
              </div>
            )}

            {/* 3. Image Gallery */}
            {imageUrls.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-3 px-2">
                  <div className="w-1.5 h-6 bg-brand-purple rounded-full"></div>
                  Attachments ({imageUrls.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imageUrls.map((url, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => setSelectedImage(url)}
                      className="group relative aspect-video rounded-2xl overflow-hidden border border-white/10 cursor-pointer bg-black/40 hover:border-white/30 transition-colors"
                    >
                      <Image 
                        src={url} 
                        alt={`Attachment ${idx + 1}`} 
                        fill 
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-2">
                            <Maximize2 className="w-8 h-8 text-white" />
                            <span className="text-xs font-bold text-white tracking-widest uppercase">View Fullscreen</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* --- RIGHT COLUMN: SIDEBAR & ACTIONS --- */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* 1. Profile Card */}
            <div className="rounded-[28px] border border-white/10 bg-[#1A1A24] p-6 shadow-xl sticky top-4 z-20">
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-4 border-b border-white/5 pb-2">Posted By</p>
              
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-brand-purple to-brand-blue p-[2px] shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                  <div className="w-full h-full rounded-full bg-[#1A1A24] flex items-center justify-center font-bold text-white uppercase overflow-hidden relative">
                    {posterDetails?.avatar_url ? (
                       <Image src={posterDetails.avatar_url} alt="User" fill className="object-cover" />
                    ) : (
                       <span className="text-xl">{getPosterInitial()}</span>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-white font-bold text-lg truncate leading-tight">
                    {getPosterName()}
                  </p>
                  {posterDetails?.kyc_verified ? (
                    <div className="flex items-center gap-1.5 text-green-400 text-xs mt-1 font-medium bg-green-500/10 w-fit px-2 py-0.5 rounded-full border border-green-500/20">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </div>
                  ) : (
                    <div className="text-white/30 text-xs mt-1">Member</div>
                  )}
                </div>
              </div>

              {/* 2. DYNAMIC ACTION BUTTONS */}
              <div className="mt-8 space-y-3">
                
                {/* --- A. WORKER VIEW: Submit --- */}
                {isWorker && gig.status === 'ASSIGNED' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                    <div className="p-4 rounded-xl bg-[#0B0B11] border border-white/10">
                        <label className="text-xs text-white/50 block mb-2 font-bold uppercase">Submission URL</label>
                        <input 
                            type="text" 
                            placeholder="https://drive.google.com/..." 
                            value={deliveryLink}
                            onChange={(e) => setDeliveryLink(e.target.value)}
                            className="w-full bg-[#121217] border border-white/10 rounded-lg p-3 text-sm text-white focus:border-brand-purple focus:ring-1 focus:ring-brand-purple outline-none transition-all placeholder:text-white/20"
                        />
                    </div>
                    <button 
                        onClick={handleDeliver} 
                        disabled={submitting} 
                        className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-100 active:scale-95 transition-all flex justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    >
                        {submitting ? <Loader2 className="animate-spin"/> : <Send className="w-5 h-5"/>} 
                        Submit Work
                    </button>
                  </div>
                )}

                {/* --- B. POSTER VIEW: Review --- */}
                {isOwner && gig.status === 'DELIVERED' && (
                  <div className="p-4 rounded-2xl bg-[#0B0B11] border border-green-500/30 text-center animate-in fade-in">
                    <h3 className="font-bold text-white mb-2">Action Required</h3>
                    <p className="text-xs text-white/50 mb-4">Worker has submitted the task. Please verify.</p>
                    <button 
                        onClick={() => setShowReviewModal(true)} 
                        className="w-full py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                    >
                        <CheckCircle className="w-5 h-5"/> Review & Complete
                    </button>
                  </div>
                )}

                {/* --- C. OWNER VIEW: Manage (Open) --- */}
                {isOwner && gig.status === 'open' && (
                  <div className="bg-[#121217] border border-white/10 rounded-2xl p-5 relative overflow-hidden group hover:border-brand-purple/50 transition-colors cursor-default">
                    <div className="relative z-10 text-center space-y-4">
                        <div className="flex flex-col items-center">
                            <span className="text-4xl font-black text-white">{applicantCount}</span>
                            <span className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Applicants</span>
                        </div>
                        <Link 
                            href={`/gig/${id}/applicants`} 
                            className="block w-full py-3 bg-brand-purple text-white font-bold rounded-xl hover:bg-brand-purple/90 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)] flex items-center justify-center gap-2"
                        >
                            <Briefcase className="w-4 h-4" /> View Applicants
                        </Link>
                    </div>
                  </div>
                )}

                {/* --- D. VISITOR VIEW: Apply / Applied --- */}
                {!isOwner && !isWorker && gig.status === 'open' && (
                    hasApplied ? (
                        <button 
                            disabled 
                            className="w-full py-4 rounded-2xl bg-green-500/10 border border-green-500/30 text-green-500 font-bold flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
                        >
                            <CheckCircle2 className="w-5 h-5" /> Application Sent
                        </button>
                    ) : (
                        <button
                            onClick={handleApplyNavigation}
                            className="w-full group relative overflow-hidden rounded-2xl p-[2px] shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:shadow-[0_0_50px_rgba(139,92,246,0.5)] transition-shadow duration-500 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-blue animate-gradient-xy"></div>
                            <div className="relative bg-[#121217] rounded-[14px] p-4 flex items-center justify-center gap-3 h-full group-hover:bg-[#121217]/90 transition-colors">
                                <Send className="w-5 h-5 text-white group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-300" />
                                <span className="font-bold text-lg text-white">Apply Now</span>
                            </div>
                        </button>
                    )
                )}

                {/* --- SHARED: Open Chat --- */}
                {(isWorker || isOwner) && (gig.status === 'ASSIGNED' || gig.status === 'DELIVERED' || gig.status === 'COMPLETED') && (
                  <Link 
                    href={`/gig/${id}/chat`} 
                    className="block w-full py-3 bg-[#1A1A24] border border-white/10 text-white/70 font-bold rounded-xl text-center hover:bg-white/5 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> Open Chat
                  </Link>
                )}

                {/* --- OWNER: Refund/Cancel --- */}
                {isOwner && gig.status === "ASSIGNED" && (
                   <div className="pt-4 border-t border-white/5">
                      <button
                        onClick={handleRefund}
                        className="w-full py-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500/60 hover:bg-red-500/10 hover:text-red-400 transition-colors font-bold text-sm flex items-center justify-center gap-2"
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

      {/* --- LIGHTBOX OVERLAY --- */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-20"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div 
            className="relative w-full max-w-6xl h-full max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()} 
          >
            <Image 
              src={selectedImage} 
              alt="Full view" 
              fill 
              className="object-contain"
              quality={100}
            />
          </div>
        </div>
      )}

    </div>
  );
}