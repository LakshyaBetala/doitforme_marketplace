"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Loader2, ArrowLeft, MapPin, Shield, MessageCircle, Clock, Users, Send, AlertTriangle, X, Check } from "lucide-react";
import StatusBadge, { statusToTone, humanizeStatus } from "@/components/ui/StatusBadge";
import Skeleton from "@/components/ui/Skeleton";
import Image from "next/image";
import { toast } from "sonner";

export default function GigDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const gigId = params?.id as string;
  const supabase = supabaseBrowser();

  const [gig, setGig] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [poster, setPoster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [appCount, setAppCount] = useState(0);

  // Apply Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [offerPitch, setOfferPitch] = useState("");
  const [paymentPref, setPaymentPref] = useState<"DIRECT" | "ESCROW">("DIRECT");
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    async function loadGig() {
      if (!gigId) return;
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

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
        const { count } = await supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('gig_id', gigId);
        setAppCount(count || 0);
      }
      setLoading(false);
    }
    loadGig();
  }, [gigId, supabase]);

  const handleApply = async () => {
    if (!currentUser) return router.push("/login");
    setIsApplying(true);
    
    try {
      const res = await fetch("/api/gig/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId,
          offerPitch,
          paymentPreference: paymentPref
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to apply");
      }

      toast.success("Application submitted!");
      router.push(`/chat/${gigId}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsApplying(false);
    }
  };

  const handleMessagePoster = () => {
    if (!currentUser) return router.push("/login");
    router.push(`/chat/${gigId}`);
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
  const timeAgo = gig.created_at ? getTimeAgo(new Date(gig.created_at)) : '';

  return (
    <div className={`min-h-[100dvh] bg-[#0B0B11] text-white selection:bg-indigo-500/30 selection:text-white pb-36 font-sans relative`}>
      {/* Background Atmosphere */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-40 left-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* TOP HEADER BAR */}
      <div className={`sticky top-0 z-30 bg-white/[0.02] backdrop-blur-2xl border-b border-white/5 transition-all`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between p-4 px-6 md:px-0">
          <button onClick={() => router.back()} className={`flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium`}>
            <ArrowLeft size={16} /> Return
          </button>
          <div className="flex items-center gap-2">
            <StatusBadge tone={gig.status === 'open' ? 'success' : statusToTone(gig.status)}>
              {humanizeStatus(gig.status)}
            </StatusBadge>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-10 animate-in fade-in duration-500">

        {/* IMAGES */}
        {gig.images && gig.images.length > 0 && (
          <div className={`w-full aspect-video rounded-3xl border border-white/10 bg-white/5 overflow-hidden relative shadow-2xl shadow-black/50 group`}>
            <Image 
              src={supabase.storage.from("gig-images").getPublicUrl(gig.images[0]).data.publicUrl}
              alt="Gig image"
              fill
              className={`object-cover transition-transform duration-700 group-hover:scale-105 ${isCompanyTask ? 'grayscale' : ''}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/80 via-transparent to-transparent"></div>
          </div>
        )}

        {/* TITLE + PRICE */}
        <div className="space-y-4 relative z-10 px-2 md:px-0">
          <div className="space-y-2">
            {isCompanyTask && <span className="text-xs font-semibold text-indigo-400 mb-2 inline-flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div> Enterprise Directive</span>}
            <h1 className={`text-3xl md:text-5xl font-bold tracking-tight leading-tight text-white`}>{gig.title}</h1>
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
              isCompanyTask ? 'bg-white/10 text-white border-white/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}>
              {gig.listing_type === 'COMPANY_TASK' ? 'Operational Unit Task' : gig.listing_type}
            </span>
            {gig.category && (
              <span className={`px-4 py-1.5 text-xs font-medium rounded-full border border-white/10 text-zinc-400 bg-white/5`}>
                {gig.category}
              </span>
            )}
            {appCount > 0 && (
              <span className={`px-4 py-1.5 text-xs font-medium rounded-full border border-indigo-500/20 text-indigo-300 bg-indigo-500/5 flex items-center gap-2`}>
                <Users size={14} /> {appCount} Applications Active
              </span>
            )}
          </div>
        </div>

        {/* POSTER CARD */}
        {poster && (
          <div className={`p-8 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-md flex items-center gap-6 shadow-lg shadow-black/20`}>
            <div className={`w-20 h-20 rounded-full border border-white/20 overflow-hidden bg-white/5 shrink-0 shadow-inner group-hover:border-indigo-500/50 transition-all`}>
              {poster.avatar_url ? (
                <Image src={poster.avatar_url} alt="Poster" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-zinc-600 uppercase">{poster.name?.[0]}</div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-bold text-xl text-white tracking-tight truncate">{poster.name}</p>
              <p className="text-[13px] font-medium text-zinc-400 bg-white/5 px-2 py-1 rounded-md inline-block mt-2 border border-white/5">{poster.college || 'EXTERNAL_ORG'} &bull; {poster.rating ? `${poster.rating} RATIO` : 'NEW_UNIT'}</p>
            </div>
            {!isMyGig && (
              <button 
                onClick={handleMessagePoster}
                className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all hover:scale-105 active:scale-95 shadow-sm`}
              >
                <MessageCircle size={20} />
              </button>
            )}
          </div>
        )}

        {/* DESCRIPTION */}
        <div className={`p-8 md:p-10 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-md relative overflow-hidden shadow-lg shadow-black/20 mt-8`}>
          {isCompanyTask && <div className="absolute top-0 right-0 p-3 bg-white/5 rounded-bl-2xl text-[10px] font-bold text-zinc-500 uppercase tracking-widest select-none border-b border-l border-white/10">Operational_Parameters</div>}
          <h2 className="text-sm font-semibold text-zinc-300 mb-6 flex items-center gap-3">
             <span className="w-4 h-px bg-zinc-500"></span> Briefing Specifications
          </h2>
          <p className="text-zinc-200 text-[15px] leading-[1.8] font-medium whitespace-pre-wrap">{gig.description}</p>
        </div>

        {/* DEADLINE */}
        {gig.deadline && (
          <div className={`p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md flex items-center gap-5 shadow-lg shadow-amber-500/5`}>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
               <Clock size={20} className={`text-amber-400`} />
            </div>
            <div>
              <p className={`text-xs font-semibold text-amber-500 mb-1`}>Delivery Timeline Constraint</p>
              <p className="text-sm text-zinc-300 font-medium">{new Date(gig.deadline).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        )}

      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      {!isMyGig && gig.status === 'open' && (
        <div className={`fixed bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-[#050505] via-[#050505]/95 to-transparent z-40 safe-area-bottom backdrop-blur-sm pointer-events-none`}>
          <div className="max-w-2xl mx-auto flex gap-4 pointer-events-auto">
            <button 
              onClick={handleMessagePoster} 
              className={`flex-shrink-0 w-14 h-14 md:w-auto md:px-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-3 backdrop-blur-xl shadow-lg`}
            >
              <MessageCircle size={22} />
              <span className="hidden md:inline">Inquiry</span>
            </button>
            <button 
              onClick={() => setIsApplyModalOpen(true)} 
              className={`flex-1 py-4 bg-white text-black hover:bg-zinc-200 transition-all font-semibold text-[15px] rounded-full active:scale-95 flex items-center justify-center gap-3 shadow-[0_4px_14px_0_rgb(255,255,255,0.39)]`}
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
          paymentPref={paymentPref}
          setPaymentPref={setPaymentPref}
          isCompanyTask={isCompanyTask}
        />
      )}

    </div>
  );
}

function ApplicationModal({ isOpen, onClose, gig, currentUser, handleApply, isApplying, offerPitch, setOfferPitch, paymentPref, setPaymentPref, isCompanyTask }: any) {
  const [riskAccepted, setRiskAccepted] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0B11]/80 backdrop-blur-xl p-4 flex items-end sm:items-center justify-center overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-[#0A0A0A] border border-white/10 p-8 md:p-12 rounded-3xl w-full max-w-xl relative animate-in zoom-in-95 duration-300 shadow-2xl shadow-black/80`}>
        
        <button onClick={onClose} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full border border-white/5">
            <X size={20} />
        </button>
        
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Connect & Apply</h2>
        <p className="text-sm font-medium text-zinc-400 mb-10">Select transaction protocol for this application.</p>

        <div className="space-y-10">
            
            {/* PAYMENT PREFERENCE TOGGLE */}
            <div className="space-y-4">
              <label className="text-xs font-semibold text-zinc-400 block mb-4">Payment Security Protocol</label>
              
              <div className="flex flex-col gap-3">
                
                {/* DIRECT CONNECT */}
                <button 
                  onClick={() => setPaymentPref("DIRECT")} 
                  className={`p-6 flex flex-col items-start gap-4 transition-all text-left rounded-2xl border ${paymentPref === "DIRECT" ? "bg-white/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)] shadow-inner backdrop-blur-md" : "bg-white/[0.02] border-white/10 hover:bg-white/5"}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <p className="font-bold text-lg tracking-tight text-white flex items-center gap-2">⚡ Direct Connect</p>
                    <span className={`px-3 py-1 text-[10px] font-semibold rounded-full border ${paymentPref === "DIRECT" ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-zinc-500 border-white/10'}`}>No Platform Fee</span>
                  </div>
                  <p className="text-[13px] font-medium text-zinc-400 leading-relaxed">Direct organizational contact. Payment managed outside the secure framework.</p>
                </button>

                {/* DIRECT CONNECT WARNING & CHECKBOX */}
                {paymentPref === "DIRECT" && (
                  <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-5 animate-in zoom-in-95 duration-200 shadow-inner">
                    <div className="flex items-start gap-4">
                       <AlertTriangle size={24} className="text-red-400 shrink-0 mt-0.5" />
                       <div className="space-y-2">
                         <p className="text-sm font-bold text-red-400">Risk Authorization Required</p>
                         <p className="text-xs text-red-400/80 font-medium leading-relaxed">
                           This channel is unshielded. The platform assumes zero liability for financial delivery or dispute mediation. 
                         </p>
                       </div>
                    </div>
                    
                    <label className="flex items-center gap-4 cursor-pointer group pt-2 border-t border-red-500/10">
                       <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${riskAccepted ? 'bg-red-500 border-red-500' : 'bg-black/50 border-white/20 group-hover:border-red-500/50'}`}>
                          {riskAccepted && <Check size={14} className="text-white" />}
                       </div>
                       <input 
                         type="checkbox" 
                         className="hidden" 
                         checked={riskAccepted} 
                         onChange={(e) => setRiskAccepted(e.target.checked)} 
                       />
                       <span className={`text-sm font-medium transition-colors ${riskAccepted ? 'text-white' : 'text-zinc-400 group-hover:text-red-400'}`}>
                         I acknowledge and assume all external transaction risks.
                       </span>
                    </label>
                  </div>
                )}
                
                {/* ESCROW CONNECT */}
                {gig.price >= 500 ? (
                  <button 
                    onClick={() => setPaymentPref("ESCROW")} 
                    className={`p-6 flex flex-col items-start gap-4 transition-all text-left rounded-2xl border ${paymentPref === "ESCROW" ? "bg-white/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)] shadow-inner backdrop-blur-md" : "bg-white/[0.02] border-white/10 hover:bg-white/5"}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <p className="font-bold text-lg tracking-tight text-white flex items-center gap-2">🛡️ Secure Escrow</p>
                      <span className={`px-3 py-1 text-[10px] font-semibold rounded-full border ${paymentPref === "ESCROW" ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-zinc-500 border-white/10'}`}>3% Platform Fee</span>
                    </div>
                    <p className="text-[13px] font-medium text-zinc-400 leading-relaxed">Secured transaction shield. Guaranteed disbursement upon delivery of verified artifacts.</p>
                  </button>
                ) : (
                  <div className="p-6 bg-white/[0.01] border border-white/5 rounded-2xl opacity-40 cursor-not-allowed">
                    <p className="font-bold text-lg text-zinc-600 tracking-tight flex items-center gap-2">🛡️ Secure Escrow</p>
                    <p className="text-[11px] font-semibold text-red-500/80 mt-2 bg-red-500/10 px-2 py-1 rounded inline-block">Invalid for Assets &lt; ₹500</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-semibold text-zinc-400 block">Application Pitch</label>
              <textarea 
                value={offerPitch}
                onChange={e => setOfferPitch(e.target.value)}
                placeholder="Explain why you're a good fit for this gig..."
                className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 text-sm font-medium text-white outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 resize-none transition-all placeholder:text-zinc-600 shadow-inner"
                rows={4}
              />
            </div>

            <button 
              onClick={handleApply}
              disabled={isApplying || (paymentPref === "DIRECT" && !riskAccepted)}
              className={`w-full py-4 text-[15px] font-semibold rounded-full transition-all flex items-center justify-center gap-3 ${
                (paymentPref === "DIRECT" && !riskAccepted) 
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
