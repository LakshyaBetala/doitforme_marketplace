"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Loader2, ArrowLeft, MapPin, Shield, MessageCircle, Clock, Users, Send, AlertTriangle, X, Check } from "lucide-react";
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

  if (loading) return <div className="h-screen bg-[#0B0B11] flex justify-center items-center"><Loader2 className="animate-spin text-brand-purple w-8 h-8" /></div>;
  if (!gig) return <div className="h-screen bg-[#0B0B11] flex flex-col gap-4 justify-center items-center text-white"><p className="text-white/50">Gig not found.</p><button onClick={() => router.push('/dashboard')} className="text-brand-purple text-sm font-bold">← Back to Dashboard</button></div>;

  const isCompanyTask = gig.listing_type === 'COMPANY_TASK';
  const accentColor = isCompanyTask ? '#00f2ff' : '#8825F5'; // Cyan for enterprise, Purple for standard
  const isMyGig = currentUser?.id === gig.poster_id;
  const timeAgo = gig.created_at ? getTimeAgo(new Date(gig.created_at)) : '';

  return (
    <div className={`min-h-screen ${isCompanyTask ? 'bg-[#050505]' : 'bg-[#0B0B11]'} text-white selection:bg-white selection:text-black pb-36 font-sans`}>

      {/* TOP HEADER BAR */}
      <div className={`sticky top-0 z-30 ${isCompanyTask ? 'bg-[#0a0a0a]/90 border-[#222]' : 'bg-[#0B0B11]/80 border-white/5'} backdrop-blur-xl border-b`}>
        <div className="max-w-2xl mx-auto flex items-center justify-between p-4">
          <button onClick={() => router.back()} className={`flex items-center gap-2 ${isCompanyTask ? 'text-[#666]' : 'text-white/60'} hover:text-white transition-colors text-xs font-bold uppercase tracking-widest`}>
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-[9px] uppercase font-black tracking-widest border ${
              gig.status === 'open' 
                ? (isCompanyTask ? 'bg-white text-black border-white' : 'bg-green-500/10 text-green-400 border-green-500/20') 
                : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
            }`}>
              {gig.status}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-10 animate-in fade-in duration-500">

        {/* IMAGES */}
        {gig.images && gig.images.length > 0 && (
          <div className={`w-full aspect-video ${isCompanyTask ? 'rounded-none border-[#222]' : 'rounded-3xl border-white/5'} bg-[#1A1A24] overflow-hidden relative border shadow-2xl`}>
            <Image 
              src={supabase.storage.from("gig-images").getPublicUrl(gig.images[0]).data.publicUrl}
              alt="Gig image"
              fill
              className={`object-cover ${isCompanyTask ? 'grayscale contrast-125' : ''}`}
            />
            {isCompanyTask && <div className="absolute inset-0 bg-gradient-to-t from-[#050505] to-transparent opacity-60"></div>}
          </div>
        )}

        {/* TITLE + PRICE */}
        <div className="space-y-4">
          <div className="space-y-2">
            {isCompanyTask && <span className="text-[10px] font-bold text-[#00f2ff] uppercase tracking-[0.4em] block">Enterprise Directive</span>}
            <h1 className={`text-3xl md:text-5xl font-black tracking-tighter leading-none uppercase ${isCompanyTask ? 'italic' : ''}`}>{gig.title}</h1>
          </div>
          
          <div className="flex items-center gap-6 mt-3 flex-wrap">
            <div className={`text-3xl md:text-4xl font-black flex items-center gap-1 ${isCompanyTask ? 'text-white' : 'text-brand-purple'}`}>
              <span className="text-xl opacity-50 italic">₹</span>{gig.price}
            </div>
            <div className="flex items-center gap-4">
               {gig.location && (
                 <span className="flex items-center gap-1 text-[10px] font-bold text-[#666] uppercase tracking-widest"><MapPin size={12} /> {gig.location}</span>
               )}
               {timeAgo && (
                 <span className="flex items-center gap-1 text-[10px] font-bold text-[#666] uppercase tracking-widest"><Clock size={12} /> {timeAgo}</span>
               )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={`px-3 py-1 text-[9px] uppercase font-black tracking-widest border ${
              isCompanyTask ? 'bg-white text-black border-white' : 'bg-brand-purple/10 text-brand-purple border-brand-purple/20'
            }`}>
              {gig.listing_type === 'COMPANY_TASK' ? '🏢 Operational Unit Task' : gig.listing_type}
            </span>
            {gig.category && (
              <span className={`px-3 py-1 text-[9px] uppercase font-black tracking-widest border border-[#222] text-[#666]`}>
                {gig.category}
              </span>
            )}
            {appCount > 0 && (
              <span className={`px-3 py-1 text-[9px] uppercase font-black tracking-widest border border-[#222] text-[#444] flex items-center gap-2`}>
                <Users size={10} /> {appCount} Transmissions
              </span>
            )}
          </div>
        </div>

        {/* POSTER CARD */}
        {poster && (
          <div className={`p-6 ${isCompanyTask ? 'rounded-none border-[#222] bg-[#0a0a0a]' : 'rounded-3xl border-white/5 bg-[#1A1A24]'} border flex items-center gap-6`}>
            <div className={`w-20 h-20 ${isCompanyTask ? 'rounded-none border-[#222]' : 'rounded-full border-brand-purple/30'} overflow-hidden bg-white/10 shrink-0 border-2 grayscale group-hover:grayscale-0 transition-all`}>
              {poster.avatar_url ? (
                <Image src={poster.avatar_url} alt="Poster" width={80} height={80} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-black text-[#444] italic uppercase">{poster.name?.[0]}</div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-black text-xl text-white uppercase italic tracking-tight truncate">{poster.name}</p>
              <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest">{poster.college || 'EXTERNAL_ORG'} // {poster.rating ? `${poster.rating} RATIO` : 'NEW_UNIT'}</p>
            </div>
            {!isMyGig && (
              <button 
                onClick={handleMessagePoster}
                className={`shrink-0 p-4 ${isCompanyTask ? 'bg-transparent border-[#222] hover:bg-white hover:text-black' : 'bg-white/5 hover:bg-white/10 border-white/10'} border text-[10px] font-black uppercase tracking-widest transition-all active:scale-95`}
              >
                <MessageCircle size={18} />
              </button>
            )}
          </div>
        )}

        {/* DESCRIPTION */}
        <div className={`p-8 ${isCompanyTask ? 'rounded-none border-[#222] bg-[#0a0a0a]' : 'rounded-[32px] border-white/5 bg-[#121217]'} border relative overflow-hidden`}>
          {isCompanyTask && <div className="absolute top-0 right-0 p-2 text-[8px] font-black text-[#111] uppercase tracking-[0.5em] select-none">Operational_Parameters</div>}
          <h2 className="text-[10px] font-black text-[#444] uppercase tracking-[0.3em] mb-6">Briefing // Specifications</h2>
          <p className="text-white font-medium leading-relaxed whitespace-pre-wrap">{gig.description}</p>
        </div>

        {/* DEADLINE */}
        {gig.deadline && (
          <div className={`p-6 ${isCompanyTask ? 'rounded-none border-[#222] bg-[#0a0a0a]' : 'rounded-2xl border-yellow-500/10 bg-yellow-500/5'} border flex items-center gap-4`}>
            <Clock size={18} className={`${isCompanyTask ? 'text-white' : 'text-yellow-400'} shrink-0`} />
            <div>
              <p className={`text-[9px] font-black ${isCompanyTask ? 'text-white' : 'text-yellow-400'} uppercase tracking-[0.2em]`}>Timeline Constraint</p>
              <p className="text-[10px] text-[#666] font-bold uppercase tracking-widest">{new Date(gig.deadline).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        )}

      </div>

      {/* STICKY BOTTOM ACTION BAR */}
      {!isMyGig && gig.status === 'open' && (
        <div className={`fixed bottom-0 left-0 right-0 p-6 ${isCompanyTask ? 'bg-[#050505]/95 border-t border-[#222]' : 'bg-gradient-to-t from-[#0B0B11] via-[#0B0B11]/95 to-transparent'} z-40 safe-area-bottom backdrop-blur-md`}>
          <div className="max-w-2xl mx-auto flex gap-4">
            <button 
              onClick={handleMessagePoster} 
              className={`flex-shrink-0 p-5 ${isCompanyTask ? 'bg-transparent border-[#222] hover:bg-white hover:text-black' : 'bg-white/5 hover:bg-white/10 border-white/10'} text-white font-black text-[10px] uppercase tracking-widest border transition-all active:scale-95 flex items-center gap-3`}
            >
              <MessageCircle size={20} />
              <span className="hidden sm:inline">Inquiry</span>
            </button>
            <button 
              onClick={() => setIsApplyModalOpen(true)} 
              className={`flex-1 py-5 ${isCompanyTask ? 'bg-white text-black hover:bg-[#00f2ff]' : 'bg-brand-purple hover:bg-brand-purple/90 text-white'} font-black text-xs uppercase tracking-[0.3em] transition-all active:scale-95 flex items-center justify-center gap-3 shadow-2xl`}
            >
              <Send size={18} /> Deploy Application
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
    <div className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-md p-6 flex items-end sm:items-center justify-center overflow-y-auto" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-[#0a0a0a] border border-[#222] p-8 md:p-12 ${isCompanyTask ? 'rounded-none' : 'rounded-[40px]'} w-full max-w-xl relative animate-in slide-in-from-bottom-8 duration-500`}>
        
        <button onClick={onClose} className="absolute top-8 right-8 text-[#444] hover:text-white transition-colors">
            <X size={24} />
        </button>
        
        <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2">Connect & Deploy</h2>
        <p className="text-[10px] font-bold text-[#444] uppercase tracking-widest mb-10">Select transaction protocol for this operation.</p>

        <div className="space-y-10">
            
            {/* PAYMENT PREFERENCE TOGGLE */}
            <div className="space-y-4">
              <label className="text-[9px] font-black text-[#222] uppercase tracking-[0.4em] block mb-6">Payment Security Protocol</label>
              
              <div className="grid grid-cols-1 gap-px bg-[#222] border border-[#222]">
                
                {/* DIRECT CONNECT */}
                <button 
                  onClick={() => setPaymentPref("DIRECT")} 
                  className={`p-8 flex flex-col items-start gap-4 transition-all text-left ${paymentPref === "DIRECT" ? "bg-white text-black" : "bg-[#0a0a0a] text-[#444] hover:bg-[#111]"}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <p className="font-black text-xl uppercase italic tracking-tight">⚡ Direct Vector</p>
                    <span className={`px-3 py-1 text-[9px] font-black tracking-widest border uppercase ${paymentPref === "DIRECT" ? 'bg-black text-white border-black' : 'bg-[#111] text-[#444] border-[#222]'}`}>No Protocol Fee</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-widest leading-loose opacity-70">Direct organizational contact. Payment managed outside the secure framework.</p>
                </button>

                {/* DIRECT CONNECT WARNING & CHECKBOX */}
                {paymentPref === "DIRECT" && (
                  <div className="p-8 bg-red-950/20 border-t border-[#222] space-y-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-start gap-4">
                       <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                       <div className="space-y-2">
                         <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em]">Risk Authorization Required</p>
                         <p className="text-[10px] text-red-500/70 font-medium leading-relaxed uppercase tracking-widest">
                           This channel is unshielded. The platform assumes zero liability for financial delivery or dispute mediation. 
                         </p>
                       </div>
                    </div>
                    
                    <label className="flex items-center gap-4 cursor-pointer group">
                       <div className={`w-6 h-6 border-2 flex items-center justify-center transition-all ${riskAccepted ? 'bg-red-500 border-red-500' : 'bg-transparent border-[#222] group-hover:border-red-500'}`}>
                          {riskAccepted && <Check size={14} className="text-white" />}
                       </div>
                       <input 
                         type="checkbox" 
                         className="hidden" 
                         checked={riskAccepted} 
                         onChange={(e) => setRiskAccepted(e.target.checked)} 
                       />
                       <span className={`text-[9px] font-black uppercase tracking-widest transition-colors ${riskAccepted ? 'text-white' : 'text-[#444] group-hover:text-red-500'}`}>
                         I assume all external risks.
                       </span>
                    </label>
                  </div>
                )}
                
                {/* ESCROW CONNECT */}
                {gig.price >= 500 ? (
                  <button 
                    onClick={() => setPaymentPref("ESCROW")} 
                    className={`p-8 flex flex-col items-start gap-4 transition-all text-left ${paymentPref === "ESCROW" ? "bg-white text-black" : "bg-[#0a0a0a] text-[#444] hover:bg-[#111]"}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <p className="font-black text-xl uppercase italic tracking-tight">🛡️ Secure Escrow</p>
                      <span className={`px-3 py-1 text-[9px] font-black tracking-widest border uppercase ${paymentPref === "ESCROW" ? 'bg-black text-white border-black' : 'bg-[#111] text-[#444] border-[#222]'}`}>3% Asset Fee</span>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest leading-loose opacity-70">Secured transaction shield. Guaranteed disbursement upon delivery of verified artifacts.</p>
                  </button>
                ) : (
                  <div className="p-8 bg-[#050505] opacity-20 cursor-not-allowed">
                    <p className="font-black text-xl text-[#444] uppercase italic tracking-tight">🛡️ Secure Escrow</p>
                    <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-2">Invalid for Assets &lt; ₹500</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[9px] font-black text-[#222] uppercase tracking-[0.4em] block">Technical Pitch // Transcript</label>
              <textarea 
                value={offerPitch}
                onChange={e => setOfferPitch(e.target.value)}
                placeholder="PROPOSE YOUR CAPABILITIES..."
                className="w-full bg-[#050505] border border-[#222] p-6 text-sm font-medium text-white outline-none focus:border-white resize-none transition-all placeholder:text-[#222]"
                rows={4}
              />
            </div>

            <button 
              onClick={handleApply}
              disabled={isApplying || (paymentPref === "DIRECT" && !riskAccepted)}
              className={`w-full py-6 font-black text-[10px] uppercase tracking-[0.4em] transition-all active:scale-95 flex items-center justify-center gap-3 ${
                (paymentPref === "DIRECT" && !riskAccepted) 
                ? 'bg-[#111] text-[#444] cursor-not-allowed' 
                : 'bg-white text-black hover:bg-[#00f2ff]'
              }`}
            >
              {isApplying ? <Loader2 className="animate-spin w-5 h-5" /> : "Deploy Transmission"}
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
