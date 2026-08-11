"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Loader2, Briefcase, IndianRupee, ArrowRight, ShieldCheck, CheckCircle, Clock, Phone, MessageSquare, Zap, AlertTriangle, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
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

  // Submit-work modal (delivery note + optional link)
  const [submitGigId, setSubmitGigId] = useState<string | null>(null);
  const [submitNote, setSubmitNote] = useState("");
  const [submitLink, setSubmitLink] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadActivity() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      // Load Hiring (Gigs I posted)
      const { data: myPosts } = await supabase
        .from('gigs')
        .select('*, worker:users!assigned_worker_id(name, phone)')
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
      setLoading(false);
    }
    loadActivity();
  }, [router, supabase]);

  const handleFundEscrow = async (gigId: string) => {
      toast.loading("Initiating payment...");
      const { error } = await supabase.from('gigs')
         .update({ status: 'assigned', escrow_status: 'FUNDED' })
         .eq('id', gigId);
      
      if(error) toast.error("Payment failed");
      else {
          toast.success("Escrow funded! Work can begin.");
          setHiringGigs(prev => prev.map(g => g.id === gigId ? { ...g, status: 'assigned', escrow_status: 'FUNDED' } : g));
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
          const res = await fetch("/api/gig/deliver", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ gigId: submitGigId, note: submitNote, deliveryLink: submitLink.trim() || undefined })
          });
          const data = await res.json().catch(() => ({}));
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

  const handleApproveWork = async (gigId: string, isDirect: boolean = false) => {
      toast.loading(isDirect ? "Closing task..." : "Releasing funds...");
      
      const updateData = isDirect
          ? { status: 'completed' }
          : { status: 'completed', escrow_status: 'RELEASED' };
          
      const { error } = await supabase.from('gigs')
         .update(updateData)
         .eq('id', gigId);
      
      if(error) toast.error(isDirect ? "Failed to close task" : "Failed to release funds");
      else {
          toast.success(isDirect ? "Task closed successfully!" : "Work approved, funds released!");
          setHiringGigs(prev => prev.map(g => g.id === gigId ? { ...g, ...updateData } : g));
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
                {gig.worker && ['assigned', 'AWAITING_FUNDS', 'SUBMITTED', 'delivered', 'completed'].includes(gig.status) && (
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

                <div className="flex flex-col md:flex-row gap-2 mt-3 border-t border-white/5 pt-3">
                   <button onClick={() => router.push(`/chat/${gig.id}`)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition text-center flex items-center justify-center gap-2 border border-white/5">
                     <MessageSquare size={14} /> Chat
                   </button>

                   {gig.status === 'AWAITING_FUNDS' && gig.payment_gateway !== 'DIRECT' && (
                     <button onClick={() => handleFundEscrow(gig.id)} className="flex-1 py-2.5 rounded-xl bg-[#8825F5] hover:bg-[#7a1de0] text-white font-bold text-sm transition shadow-lg shadow-[#C9A9FF]/20 flex items-center gap-2 justify-center">
                       <ShieldCheck size={14} /> Fund Escrow (3%)
                     </button>
                   )}

                   {(gig.status === 'SUBMITTED' || gig.status === 'delivered' || (gig.status === 'assigned' && gig.payment_gateway === 'DIRECT')) && (
                     <button onClick={() => handleApproveWork(gig.id, gig.payment_gateway === 'DIRECT')} className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition shadow-lg shadow-green-500/20 flex items-center gap-2 justify-center">
                       <CheckCircle size={14} /> {gig.payment_gateway === 'DIRECT' ? 'Close Task' : 'Approve & Release'}
                     </button>
                   )}
                </div>
             </div>
           ))}

           {activeTab === "WORKING" && workingGigs.map(app => {
             const gig = app.gig;
             if(!gig) return null;
             const displayStatus = app.status === 'accepted' ? gig.status : app.status;

             return (
               <div key={app.id} className="bg-[#1A1A24] border border-white/5 rounded-2xl p-5 hover:border-[#C9A9FF]/30 transition group">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                     <div className="flex-1 min-w-0">
                       <h3 className="font-bold text-white text-lg truncate">{gig.title}</h3>
                       <p className="text-white font-semibold flex items-center gap-1"><IndianRupee size={12} /> {app.negotiated_price || gig.price}</p>
                     </div>
                     <div className="shrink-0 max-w-[50%] flex justify-end">
                        <StatusBadge status={displayStatus} />
                     </div>
                  </div>



                   {/* Poster contact info for active gigs */}
                  {app.status === 'accepted' && gig.poster && ['assigned', 'AWAITING_FUNDS', 'SUBMITTED', 'delivered', 'completed'].includes(gig.status) && (
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
