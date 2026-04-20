"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Loader2, Briefcase, IndianRupee, ArrowRight, ShieldCheck, CheckCircle, Clock, Phone, MessageSquare, Zap, AlertTriangle } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  'open': { label: 'Open', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  'assigned': { label: 'In Progress', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  'AWAITING_FUNDS': { label: 'Awaiting Escrow', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  'SUBMITTED': { label: 'Work Submitted', color: 'text-[#00f2ff]', bg: 'bg-[#00f2ff]/10', border: 'border-[#00f2ff]/20' },
  'delivered': { label: 'Delivered', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  'completed': { label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'cancelled': { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'disputed': { label: 'Disputed', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  'pending': { label: 'Pending', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
  'approved': { label: 'Approved', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['pending'];
  return (
    <span className={`px-2.5 py-1 rounded-lg ${config.bg} ${config.border} border text-[10px] uppercase font-black tracking-widest ${config.color} whitespace-nowrap`}>
      {config.label}
    </span>
  );
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
    <div className="flex items-center gap-1.5 text-xs text-yellow-400">
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
          window.location.reload();
      }
  };

  const handleSubmitWork = async (gigId: string, applicationId: string) => {
      toast.loading("Submitting work...");
      
      // Set auto_release_at to NOW() + 24 HOURS
      const releaseDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('gigs')
         .update({ status: 'SUBMITTED', auto_release_at: releaseDate })
         .eq('id', gigId);
      
      if(error) toast.error("Failed to submit work");
      else {
          toast.success("Work submitted! 24-hour review timer started.");
          window.location.reload();
      }
  };

  const handleApproveWork = async (gigId: string) => {
      toast.loading("Releasing funds...");
      const { error } = await supabase.from('gigs')
         .update({ status: 'completed', escrow_status: 'RELEASED' })
         .eq('id', gigId);
      
      if(error) toast.error("Failed to release funds");
      else {
          toast.success("Work approved, funds released!");
          window.location.reload();
      }
  };

  if (loading) return <div className="min-h-screen bg-[#0B0B11] flex justify-center items-center"><Loader2 className="animate-spin text-[#00f2ff] w-8 h-8" /></div>;

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-4 md:p-8 cursor-default selection:bg-[#00f2ff] selection:text-black pb-32">
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
        
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight">Activity Hub</h1>
          <button onClick={() => router.push('/dashboard')} className="text-xs text-white/50 hover:text-white transition-colors bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">← Dashboard</button>
        </div>

        {/* TABS */}
        <div className="flex bg-white/5 p-1 rounded-2xl relative border border-white/5">
           <button onClick={() => setActiveTab("HIRING")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-all ${activeTab === 'HIRING' ? 'bg-[#00f2ff] text-black shadow-lg shadow-[#00f2ff]/20' : 'text-white/60 hover:text-white'}`}>
             <Briefcase size={14} /> Outsourcing ({hiringGigs.length})
           </button>
           <button onClick={() => setActiveTab("WORKING")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-all ${activeTab === 'WORKING' ? 'bg-[#00f2ff] text-black shadow-lg shadow-[#00f2ff]/20' : 'text-white/60 hover:text-white'}`}>
             <Zap size={14} /> Hustling ({workingGigs.length})
           </button>
        </div>

        {/* LIST */}
        <div className="space-y-4">
           {activeTab === "HIRING" && hiringGigs.length === 0 && (
             <div className="text-center py-16">
               <Briefcase size={40} className="mx-auto text-white/20 mb-3" />
               <p className="text-white/50 text-sm">No gigs posted yet.</p>
               <button onClick={() => router.push('/post')} className="mt-4 px-5 py-2 rounded-full bg-[#00f2ff] text-black text-xs font-bold">Post a Gig</button>
             </div>
           )}
           {activeTab === "WORKING" && workingGigs.length === 0 && (
             <div className="text-center py-16">
               <Zap size={40} className="mx-auto text-white/20 mb-3" />
               <p className="text-white/50 text-sm">No gigs found. Go find some work!</p>
               <button onClick={() => router.push('/dashboard')} className="mt-4 px-5 py-2 rounded-full bg-[#00f2ff] text-black text-xs font-bold">Find Gigs</button>
             </div>
           )}

           {activeTab === "HIRING" && hiringGigs.map(gig => (
             <div key={gig.id} className="bg-[#1A1A24] border border-white/5 rounded-2xl p-5 hover:border-[#00f2ff]/30 transition-all group">
                <div className="flex justify-between items-start mb-3">
                   <div className="flex-1 min-w-0">
                     <h3 className="font-bold text-white text-lg truncate">{gig.title}</h3>
                     <p className="text-[#00f2ff] font-black flex items-center gap-1"><IndianRupee size={12} /> {gig.price}</p>
                   </div>
                   <StatusBadge status={gig.status} />
                </div>

                {/* Worker contact info for active gigs */}
                {gig.worker && ['assigned', 'AWAITING_FUNDS', 'SUBMITTED', 'delivered', 'completed'].includes(gig.status) && (
                  <div className="p-3 bg-[#00f2ff]/5 rounded-xl text-sm mb-3 border border-[#00f2ff]/10 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-white/50 text-xs">Hustler:</span> <span className="font-bold text-white">{gig.worker.name}</span>
                    </div>
                    {gig.worker.phone && (
                      <a href={`tel:${gig.worker.phone}`} className="flex items-center gap-1 text-xs text-[#00f2ff] font-bold bg-[#00f2ff]/10 px-2.5 py-1 rounded-lg border border-[#00f2ff]/20 hover:bg-[#00f2ff]/20 transition-colors">
                        <Phone size={10} /> {gig.worker.phone}
                      </a>
                    )}
                  </div>
                )}

                {/* Auto-release countdown */}
                {gig.status === 'SUBMITTED' && gig.auto_release_at && (
                  <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-yellow-400 font-bold">Auto-release timer:</span>
                    <CountdownTimer targetDate={gig.auto_release_at} />
                  </div>
                )}

                <div className="flex flex-col md:flex-row gap-2 mt-3 border-t border-white/5 pt-3">
                   <button onClick={() => router.push(`/chat/${gig.id}`)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-all text-center flex items-center justify-center gap-2 border border-white/5">
                     <MessageSquare size={14} /> Chat
                   </button>

                   {gig.status === 'AWAITING_FUNDS' && (
                     <button onClick={() => handleFundEscrow(gig.id)} className="flex-1 py-2.5 rounded-xl bg-[#00f2ff] hover:bg-[#00f2ff]/90 text-black font-bold text-sm transition-all shadow-lg shadow-[#00f2ff]/20 flex items-center gap-2 justify-center">
                       <ShieldCheck size={14} /> Fund Escrow (3%)
                     </button>
                   )}

                   {(gig.status === 'SUBMITTED' || gig.status === 'delivered') && (
                     <button onClick={() => handleApproveWork(gig.id)} className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm transition-all shadow-lg shadow-green-500/20 flex items-center gap-2 justify-center">
                       <CheckCircle size={14} /> Approve & Release
                     </button>
                   )}
                </div>
             </div>
           ))}

           {activeTab === "WORKING" && workingGigs.map(app => {
             const gig = app.gig;
             if(!gig) return null;
             const displayStatus = app.status === 'approved' ? gig.status : app.status;

             return (
               <div key={app.id} className="bg-[#1A1A24] border border-white/5 rounded-2xl p-5 hover:border-[#00f2ff]/30 transition-all group">
                  <div className="flex justify-between items-start mb-3">
                     <div className="flex-1 min-w-0">
                       <h3 className="font-bold text-white text-lg truncate">{gig.title}</h3>
                       <p className="text-green-400 font-black flex items-center gap-1"><IndianRupee size={12} /> {app.negotiated_price || gig.price}</p>
                     </div>
                     <StatusBadge status={displayStatus} />
                  </div>

                   {/* Payment preference badge */}
                  {app.payment_preference && (
                    <div className="mb-3">
                      <span className={`px-2 py-1 rounded-lg text-[10px] uppercase font-black tracking-widest border ${app.payment_preference === 'ESCROW' ? 'bg-[#00f2ff]/10 text-[#00f2ff] border-[#00f2ff]/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                        {app.payment_preference === 'ESCROW' ? '🛡️ Escrow Protected' : '⚡ Direct Connect'}
                      </span>
                    </div>
                  )}

                   {/* Poster contact info for active gigs */}
                  {app.status === 'approved' && gig.poster && ['assigned', 'AWAITING_FUNDS', 'SUBMITTED', 'delivered', 'completed'].includes(gig.status) && (
                    <div className="p-3 bg-white/5 rounded-xl text-sm mb-3 border border-white/5 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-white/50 text-xs">Client:</span> <span className="font-bold text-white">{gig.poster.name}</span>
                      </div>
                      {gig.poster.phone && (
                        <a href={`tel:${gig.poster.phone}`} className="flex items-center gap-1 text-xs text-[#00f2ff] font-bold bg-[#00f2ff]/10 px-2.5 py-1 rounded-lg border border-[#00f2ff]/20 hover:bg-[#00f2ff]/20 transition-colors">
                          <Phone size={10} /> {gig.poster.phone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Auto-release countdown for submitted work */}
                  {gig.status === 'SUBMITTED' && gig.auto_release_at && (
                    <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-between">
                      <span className="text-xs text-yellow-400 font-bold">Auto-release:</span>
                      <CountdownTimer targetDate={gig.auto_release_at} />
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row gap-2 mt-3 border-t border-white/5 pt-3">
                     <button onClick={() => router.push(`/chat/${gig.id}`)} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-all text-center flex items-center justify-center gap-2 border border-white/5">
                       <MessageSquare size={14} /> Chat
                     </button>

                     {app.status === 'approved' && gig.status === 'AWAITING_FUNDS' && (
                        <div className="flex-1 py-2.5 rounded-xl bg-yellow-500/10 text-yellow-500 font-bold text-sm text-center border border-yellow-500/20 flex items-center justify-center gap-2">
                          <Clock size={14} /> Waiting for Escrow
                        </div>
                     )}

                     {app.status === 'approved' && (gig.status === 'assigned') && (
                       <button onClick={() => handleSubmitWork(gig.id, app.id)} className="flex-1 py-2.5 rounded-xl bg-[#00f2ff] hover:bg-[#00f2ff]/90 text-black font-bold text-sm transition-all shadow-lg shadow-[#00f2ff]/20 flex items-center gap-2 justify-center">
                         <ArrowRight size={14} /> Submit Work
                       </button>
                     )}
                  </div>
               </div>
             )
           })}

        </div>

      </div>
    </div>
  );
}
