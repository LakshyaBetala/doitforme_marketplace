"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Users, Download, ShieldCheck, FileText, CheckCircle2, Gift, MessageCircle, AlertTriangle
} from "lucide-react";

export default function CompanyTaskHubPage() {
  const params = useParams();
  const router = useRouter();
  const gigId = params?.id as string;
  const supabase = supabaseBrowser();

  const [user, setUser] = useState<any>(null);
  const [gig, setGig] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Incentive Modal
  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [incentiveAmount, setIncentiveAmount] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      if (!gigId) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);

      // Fetch task
      const { data: gigData, error: gigError } = await supabase
        .from('gigs')
        .select('*')
        .eq('id', gigId)
        .eq('poster_id', authUser?.id)
        .single();
        
      if (gigError || !gigData) {
        toast.error("Task not found or access denied.");
        router.push("/company/dashboard");
        return;
      }
      setGig(gigData);

      // Fetch applications & worker info (including worker profile details)
      const { data: appsData } = await supabase
        .from('applications')
        .select(`
          id, worker_id, status, pitch, created_at, negotiated_price, payment_preference,
          users!applications_worker_id_fkey(name, email, avatar_url, phone, college, skills, portfolio_links, experience, resume_url, rating, rating_count, jobs_completed)
        `)
        .eq('gig_id', gigId)
        .order('created_at', { ascending: false });

      if (appsData) setApplications(appsData);
      
      setLoading(false);
    }
    loadData();
  }, [gigId, router, supabase]);

  const [hiringId, setHiringId] = useState<string | null>(null);

  const handleHire = async (app: any) => {
    setHiringId(app.id);
    try {
      if (app.payment_preference === 'DIRECT') {
        const phone = app.users?.phone;
        if (!phone) {
           toast.error("Worker hasn't provided a phone number.");
           return;
        }
        const phoneStr = String(phone);
        const message = encodeURIComponent(`Hi ${app.users?.name}, I'm reaching out regarding my task "${gig.title}" on DoItForMe.`);
        window.open(`https://wa.me/91${phoneStr.replace(/\D/g,'')}?text=${message}`, '_blank');
        
        await updateApplicationStatus(app.id, 'accepted');
        toast.success("Redirected to Direct Connect!");
      } else {
        const res = await fetch("/api/gig/hire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gigId: gig.id, workerId: app.worker_id })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to initiate payment");

        const { load } = await import('@cashfreepayments/cashfree-js');
        const cashfree = await load({
          mode: process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ? 'sandbox' : 'sandbox',
        });
        
        cashfree.checkout({
          paymentSessionId: data.paymentSessionId,
          redirectTarget: "_self",
        });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setHiringId(null);
    }
  };

  const updateApplicationStatus = async (appId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', appId);

      if (error) throw error;
      
      setApplications(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      toast.success(`Applicant ${newStatus === 'accepted' ? 'Approved' : 'Rejected'}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const grantIncentive = async () => {
    if (!selectedWorkerId || !incentiveAmount || isNaN(Number(incentiveAmount))) return;
    
    // In a real flow, this would trigger an escrow top-up or direct payment intent.
    // For now we log it as an escrow event / transaction.
    toast.success(`Bonus of ₹${incentiveAmount} granted successfully (Mocked).`);
    setShowIncentiveModal(false);
    setIncentiveAmount("");
    setSelectedWorkerId(null);
  };

  if (loading) return <div className="h-screen bg-[#0B0B11] flex justify-center items-center"><Loader2 className="animate-spin text-white w-8 h-8" /></div>;
  if (!gig) return null;

  const acceptedCount = applications.filter(a => a.status === 'accepted').length;

  const labelClass = "block text-[10px] font-bold text-[#444] uppercase tracking-widest mb-2";

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white pb-36 font-sans selection:bg-white selection:text-black">

      {/* TOP HEADER */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#222]">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-6">
          <button onClick={() => router.push('/company/dashboard')} className="flex items-center gap-2 text-[#666] hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
            <ArrowLeft size={16} /> Back to Repository
          </button>
          <div className="flex items-center gap-4">
            <span className={`px-2 py-1 text-[9px] font-black tracking-[0.2em] uppercase border ${gig.status === 'open' ? 'bg-white text-black border-white' : 'bg-transparent text-[#444] border-[#222]'}`}>
              {gig.status}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 lg:p-12 space-y-16">

        {/* TASK SUMMARY HEADER */}
        <div className="border-b border-[#222] pb-12 flex flex-col lg:flex-row items-end justify-between gap-8">
           <div className="max-w-3xl space-y-6">
              <span className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] block">Operational Hub // Task: {gig.id.split('-')[0]}</span>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                {gig.title}
              </h1>
              <p className="text-sm text-[#888] leading-relaxed max-w-2xl">{gig.description}</p>
              
              <div className="flex flex-wrap items-center gap-4">
                 <div className="flex flex-col">
                    <span className={labelClass}>Unit Budget</span>
                    <span className="text-xl font-black text-white">₹{gig.price}</span>
                 </div>
                 <div className="w-px h-8 bg-[#222] mx-2 hidden sm:block"></div>
                 <div className="flex flex-col">
                    <span className={labelClass}>Deployment Capacity</span>
                    <span className="text-xl font-black text-white">{acceptedCount} <span className="text-[#444]">/</span> {gig.max_workers} UNITS</span>
                 </div>
              </div>
           </div>

           <div className="shrink-0 flex gap-4 w-full lg:w-auto">
              <button onClick={() => router.push(`/gig/${gig.id}`)} className="flex-1 lg:flex-none px-8 py-4 bg-[#111] border border-[#222] hover:bg-[#222] text-[10px] font-black uppercase tracking-widest transition-all">
                Preview Vector
              </button>
           </div>
        </div>

        {/* WORKER ROSTER */}
        <div className="space-y-12">
           <div className="flex items-center justify-between">
             <h2 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
               <span className="w-1.5 h-4 bg-white"></span>
               Applicant Pipeline
               <span className="bg-white text-black px-2 py-0.5 text-[10px] font-black">{applications.length}</span>
             </h2>
           </div>

           {applications.length === 0 ? (
             <div className="border border-[#222] bg-[#0a0a0a] py-32 text-center">
                 <Users size={24} className="mx-auto text-[#222] mb-6" />
                 <p className="text-[#444] text-[10px] font-bold uppercase tracking-widest">Pipeline Empty. Monitoring for Incoming Vectors...</p>
             </div>
           ) : (
             <div className="grid gap-px bg-[#222] border border-[#222]">
               {applications.map(app => {
                 const worker = app.users;
                 return (
                   <div key={app.id} className="bg-[#0a0a0a] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 group hover:bg-[#111] transition-colors relative">
                     {app.status === 'accepted' && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-white"></div>
                     )}
                     
                     <div className="flex items-start gap-8 flex-1">
                       <div className="w-16 h-16 bg-[#0B0B11] border border-[#222] flex items-center justify-center overflow-hidden shrink-0 grayscale group-hover:grayscale-0 transition-all">
                         {worker?.avatar_url ? (
                           <Image src={worker.avatar_url} alt="Profile" width={64} height={64} className="object-cover w-full h-full" />
                         ) : (
                           <span className="font-black text-xl text-[#333] italic uppercase">{worker?.name?.[0] || "?"}</span>
                         )}
                       </div>
                       <div className="space-y-4 flex-1">
                         <div className="flex flex-wrap items-center gap-4">
                           <h4 className="font-black text-xl text-white uppercase italic tracking-tight">{worker?.name || "ANONYMOUS UNIT"}</h4>
                           <span className={`text-[9px] font-black tracking-widest px-2 py-1 border ${
                             app.status === 'accepted' ? 'bg-white text-black border-white' : 
                             app.status === 'rejected' ? 'bg-transparent text-red-500 border-red-500/30' : 
                             'bg-transparent text-[#444] border-[#222]'
                           } uppercase`}>
                             {app.status}
                           </span>
                         </div>
                         <div className="text-[10px] font-bold text-[#444] tracking-widest uppercase">
                            <span className="text-[#888]">{worker?.college || "CREDENTIALS NOT FILED"}</span> // {worker?.email}
                         </div>
                         {(worker?.skills?.length > 0 || worker?.experience) && (
                           <div className="text-xs text-[#888] flex flex-col gap-1">
                             {worker?.skills?.length > 0 && <p><span className="text-[#555] font-bold uppercase text-[9px] tracking-widest">Skills:</span> {worker.skills.join(', ')}</p>}
                             {worker?.experience && <p><span className="text-[#555] font-bold uppercase text-[9px] tracking-widest">Experience:</span> {worker.experience}</p>}
                           </div>
                         )}
                         <div className="flex gap-4">
                           <Link href={`/u/${worker?.username || app.worker_id}`} target="_blank" className="text-[9px] font-black uppercase tracking-widest text-[#666] hover:text-white border border-[#222] px-3 py-1 bg-[#111]">
                             View Profile
                           </Link>
                           {worker?.resume_url && (
                             <a href={worker.resume_url} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest text-[#666] hover:text-white border border-[#222] px-3 py-1 bg-[#111]">View Resume</a>
                           )}
                           {worker?.portfolio_links?.length > 0 && worker.portfolio_links.map((link: string, idx: number) => (
                             <a key={idx} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest text-[#666] hover:text-white border border-[#222] px-3 py-1 bg-[#111]">Portfolio {idx + 1}</a>
                           ))}
                         </div>
                         {app.pitch && (
                           <div className="text-sm text-[#888] bg-[#0B0B11] border border-[#222] p-6 max-w-xl italic leading-relaxed">
                             <span className="uppercase text-[8px] font-bold text-[#333] block mb-3 tracking-[0.3em]">Proposal Transcript</span>
                             "{app.pitch}"
                           </div>
                         )}
                       </div>
                     </div>

                     <div className="shrink-0 flex items-center gap-px bg-[#222] border border-[#222] w-full md:w-auto overflow-hidden">
                        {(app.status === 'applied' || app.status === 'pending') && (
                          <>
                            <button disabled={hiringId === app.id} onClick={() => handleHire(app)} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-white hover:text-black text-[9px] font-black uppercase tracking-widest transition-all">
                              {hiringId === app.id ? 'Processing...' : `Hire Vector (${app.payment_preference || 'DIRECT'})`}
                            </button>
                            <button onClick={() => updateApplicationStatus(app.id, 'rejected')} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest transition-all">Reject</button>
                          </>
                        )}
                        {app.status === 'accepted' && (
                          <>
                            {(app.payment_preference === 'DIRECT' || (app.payment_preference === 'ESCROW' && gig.payment_status === 'ESCROW_FUNDED')) && worker?.phone && (
                              <button onClick={() => {
                                const message = encodeURIComponent(`Hi ${worker?.name}, I'm reaching out regarding my task "${gig.title}" on DoItForMe.`);
                                window.open(`https://wa.me/91${String(worker.phone).replace(/\D/g,'')}?text=${message}`, '_blank');
                              }} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-[#25D366] hover:text-white text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-r border-[#222]">
                                WhatsApp
                              </button>
                            )}
                            <button onClick={() => { setSelectedWorkerId(app.worker_id); setShowIncentiveModal(true); }} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-white hover:text-black text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                              <Gift size={12} /> Incentive
                            </button>
                          </>
                        )}
                        <button onClick={() => router.push(`/chat/${gig.id}`)} className="p-4 bg-[#0a0a0a] hover:bg-white hover:text-black transition-all flex items-center justify-center border-l border-[#222]">
                          <MessageCircle size={16} />
                        </button>
                     </div>
                   </div>
                 )
               })}
             </div>
           )}
        </div>

      </div>

      {/* INCENTIVE MODAL */}
      {showIncentiveModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0B11]/95 backdrop-blur-sm flex items-center justify-center p-6" onClick={(e) => e.target === e.currentTarget && setShowIncentiveModal(false)}>
          <div className="bg-[#0a0a0a] border border-[#222] p-12 w-full max-w-md relative animate-in zoom-in-95 duration-200">
             <button onClick={() => setShowIncentiveModal(false)} className="absolute top-6 right-6 text-[#444] hover:text-white transition-colors">✕</button>
             
             <div className="w-12 h-12 bg-white flex items-center justify-center mb-8">
               <Gift size={24} className="text-black" />
             </div>
             
             <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4">Grant Bonus</h3>
             <p className="text-[10px] font-bold text-[#666] uppercase tracking-widest mb-10 leading-relaxed">Financial incentive for high-performance delivery. Funds will be deployed to the worker's node immediately upon authorization.</p>
             
             <div className="space-y-10 mb-12">
                <div>
                  <label className={labelClass}>Incentive Vector (Amount INR)</label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-[#444]">₹</span>
                    <input 
                      type="number" 
                      value={incentiveAmount} 
                      onChange={e => setIncentiveAmount(e.target.value)} 
                      placeholder="e.g. 500"
                      className="w-full bg-[#0B0B11] border border-[#222] p-6 pl-12 text-white font-black text-2xl focus:outline-none focus:border-white transition-colors"
                    />
                  </div>
                </div>
             </div>

             <button 
               onClick={grantIncentive}
               disabled={!incentiveAmount}
               className="w-full p-6 bg-white text-black font-black uppercase tracking-[0.3em] text-xs transition-all disabled:opacity-30 hover:bg-gray-200"
             >
               Authorize Transaction
             </button>
          </div>
        </div>
      )}

    </div>
  );
}
