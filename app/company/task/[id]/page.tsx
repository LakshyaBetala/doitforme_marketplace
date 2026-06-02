"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, Users, Download, ShieldCheck, FileText, CheckCircle2, Gift, MessageCircle, AlertTriangle, X, ArrowRight
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

  const [showIncentiveModal, setShowIncentiveModal] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [incentiveAmount, setIncentiveAmount] = useState<string>("");

  // Premium Features
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [sortOption, setSortOption] = useState<"NEWEST" | "RATING" | "EXPERIENCE">("NEWEST");

  // Limited edit (only while open & nobody hired)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const EDIT_CATEGORIES = [
    "Tech & Engineering", "Design & Creative", "Science & Medical", "Law & Humanities",
    "Commerce & Finance", "Academics & Gigs", "Data & Research", "Writing & Content",
    "Marketing & PR", "Other",
  ];

  useEffect(() => {
    async function loadData() {
      if (!gigId) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push(`/login?next=/company/task/${gigId}`);

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

      // Fetch company premium status (Pro)
      const { data: companyData } = await supabase
        .from('companies')
        .select('pro_until')
        .eq('user_id', authUser?.id)
        .single();

      setIsSubscribed(!!(companyData?.pro_until && new Date(companyData.pro_until) > new Date()));

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
  const [handoffApp, setHandoffApp] = useState<any | null>(null);

  const handleHire = async (app: any) => {
    setHiringId(app.id);
    try {
      if (app.payment_preference === 'DIRECT') {
        const phone = app.users?.phone;
        if (!phone) {
           toast.error("Worker hasn't provided a phone number.");
           return;
        }
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
          mode: process.env.NEXT_PUBLIC_APP_URL?.includes('localhost') ? 'sandbox' : 'production',
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

  const openEdit = () => {
    setEditTitle(gig.title || "");
    setEditDescription(gig.description || "");
    setEditCategory(gig.category || "Other");
    setEditPrice(String(gig.price ?? ""));
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const res = await fetch("/api/company/edit-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gigId: gig.id,
          title: editTitle,
          description: editDescription,
          category: editCategory,
          price: editPrice,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't save changes.");
      } else {
        setGig((g: any) => ({ ...g, ...data.gig }));
        setShowEditModal(false);
        toast.success("Task updated");
      }
    } catch (e: any) {
      toast.error(e.message || "Network error.");
    }
    setSavingEdit(false);
  };

  if (loading) return <div className="h-screen bg-[#0B0B11] flex justify-center items-center"><Loader2 className="animate-spin text-white w-8 h-8" /></div>;
  if (!gig) return null;

  const acceptedCount = applications.filter(a => a.status === 'accepted').length;
  const hasApplicants = applications.length > 0;
  const canEdit = gig.status === 'open' && acceptedCount === 0;

  const labelClass = "block text-[10px] font-bold text-[#444] uppercase tracking-widest mb-2";

  // Sorting Logic
  const sortedApplications = [...applications].sort((a, b) => {
    if (sortOption === "RATING") {
       return (b.users?.rating || 0) - (a.users?.rating || 0);
    } else if (sortOption === "EXPERIENCE") {
       return (b.users?.jobs_completed || 0) - (a.users?.jobs_completed || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white pb-36 font-sans selection:bg-white selection:text-black">

      {/* TOP HEADER */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#222]">
        <div className="max-w-6xl mx-auto flex items-center justify-between p-6">
          <button onClick={() => router.push(gig?.listing_type === 'COMPANY_TASK' ? '/company/dashboard' : '/activity')} className="flex items-center gap-2 text-[#666] hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
            <ArrowLeft size={16} /> Back to {gig?.listing_type === 'COMPANY_TASK' ? 'Dashboard' : 'Activity'}
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
              <span className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] block">Task #{gig.id.split('-')[0]}</span>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                {gig.title}
              </h1>
              <p className="text-sm text-[#888] leading-relaxed max-w-2xl">{gig.description}</p>
              
              <div className="flex flex-wrap items-center gap-4">
                 <div className="flex flex-col">
                    <span className={labelClass}>Budget per Worker</span>
                    <span className="text-xl font-black text-white">₹{gig.price}</span>
                 </div>
                 <div className="w-px h-8 bg-[#222] mx-2 hidden sm:block"></div>
                 <div className="flex flex-col">
                    <span className={labelClass}>Positions Filled</span>
                    <span className="text-xl font-black text-white">{acceptedCount} <span className="text-[#444]">/</span> {gig.max_workers}</span>
                 </div>
              </div>
           </div>

           <div className="shrink-0 flex gap-4 w-full lg:w-auto">
              {canEdit && (
                <button onClick={openEdit} className="flex-1 lg:flex-none px-8 py-4 bg-white text-black hover:bg-gray-200 text-[10px] font-black uppercase tracking-widest transition-all">
                  Edit Task
                </button>
              )}
              <button onClick={() => router.push(`/gig/${gig.id}`)} className="flex-1 lg:flex-none px-8 py-4 bg-[#111] border border-[#222] hover:bg-[#222] text-[10px] font-black uppercase tracking-widest transition-all">
                Preview Task
              </button>
           </div>
        </div>

        {/* WORKER ROSTER */}
        <div className="space-y-12">
           <div className="flex items-center justify-between">
             <h2 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
               <span className="w-1.5 h-4 bg-white"></span>
               Applicants
               <span className="bg-white text-black px-2 py-0.5 text-[10px] font-black">{applications.length}</span>
             </h2>

             {/* Premium Sorting */}
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#444] uppercase tracking-[0.2em] hidden sm:block">Sort By:</span>
                <select 
                   value={sortOption}
                   onChange={(e) => setSortOption(e.target.value as any)}
                   disabled={!isSubscribed}
                   className={`bg-[#0a0a0a] border ${isSubscribed ? 'border-[#444] text-white focus:border-white' : 'border-[#222] text-[#444] cursor-not-allowed'} text-[10px] font-bold uppercase tracking-[0.2em] py-2 px-3 outline-none appearance-none transition-colors`}
                   title={!isSubscribed ? "Upgrade to Unlimited to sort applicants by Rating & Experience" : ""}
                >
                   <option value="NEWEST">Newest</option>
                   <option value="RATING">{!isSubscribed ? "🔒 Rating" : "Rating"}</option>
                   <option value="EXPERIENCE">{!isSubscribed ? "🔒 Experience" : "Experience"}</option>
                </select>
             </div>
           </div>

           {applications.length === 0 ? (
             <div className="border border-[#222] bg-[#0a0a0a] py-32 text-center">
                 <Users size={24} className="mx-auto text-[#222] mb-6" />
                 <p className="text-[#444] text-[10px] font-bold uppercase tracking-widest">No applicants yet. Share the task link to get started.</p>
             </div>
           ) : (
             <div className="grid gap-px bg-[#222] border border-[#222]">
               {sortedApplications.map(app => {
                 const worker = app.users;
                 const isDirect = app.payment_preference === 'DIRECT';
                 const isAccepted = app.status === 'accepted';
                 const isPending = app.status === 'pending';
                 const isApplied = app.status === 'applied';
                 return (
                    <div key={app.id} className="bg-[#0a0a0a] p-6 md:p-8 flex flex-col gap-6 group hover:bg-[#111] transition-colors relative">
                     {isAccepted && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-white"></div>
                     )}

                     {/* Post-hire guidance banner */}
                     {isAccepted && (
                       <div className={`w-full rounded-lg p-4 border ${isDirect ? 'bg-[#25D366]/10 border-[#25D366]/20' : 'bg-[#8825F5]/10 border-[#8825F5]/20'}`}>
                         <div className="flex items-start gap-3">
                           {isDirect ? (
                             <>
                               <span className="text-lg shrink-0">⚡</span>
                               <div>
                                 <p className="text-xs font-black uppercase tracking-widest text-[#25D366] mb-1">Direct Connect — Hired</p>
                                 <p className="text-[11px] text-[#888] leading-relaxed">
                                   Contact <span className="text-white font-bold">{worker?.name}</span> directly via WhatsApp or phone. Payment and delivery are handled between you.
                                 </p>
                                 {worker?.phone && (
                                   <p className="text-xs text-white/80 mt-2 font-mono bg-black/30 px-3 py-1.5 rounded inline-block border border-white/10">
                                     📱 {worker.phone}
                                   </p>
                                 )}
                               </div>
                             </>
                           ) : (
                             <>
                               <span className="text-lg shrink-0">🛡️</span>
                               <div>
                                 <p className="text-xs font-black uppercase tracking-widest text-[#C9A9FF] mb-1">Escrow — Hired</p>
                                 <p className="text-[11px] text-[#888] leading-relaxed">
                                   Communicate with <span className="text-white font-bold">{worker?.name}</span> through the platform chat. Payment is held in escrow and released once you approve the work.
                                 </p>
                               </div>
                             </>
                           )}
                         </div>
                       </div>
                     )}

                     {/* Pending (Direct Connect awaiting finalization) */}
                     {isPending && isDirect && (
                       <div className="w-full rounded-lg p-4 border bg-amber-500/10 border-amber-500/20">
                         <div className="flex items-start gap-3">
                           <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                           <div>
                             <p className="text-xs font-black uppercase tracking-widest text-amber-400 mb-1">Awaiting Finalization</p>
                             <p className="text-[11px] text-[#888] leading-relaxed">
                               You connected with {worker?.name} via WhatsApp. Click <span className="text-white font-bold">Finalize Hire</span> once agreed to officially mark them as hired.
                             </p>
                           </div>
                         </div>
                       </div>
                     )}
                      
                     <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8">
                       <div className="flex flex-col sm:flex-row items-start gap-6 md:gap-8 w-full md:flex-1">
                          <div className="w-16 h-16 bg-[#0B0B11] border border-[#222] rounded-xl flex items-center justify-center overflow-hidden shrink-0 transition-all">
                            <Avatar src={worker?.avatar_url} fallback={worker?.name || "U"} className="w-full h-full rounded-none" textClassName="text-xl font-black italic uppercase text-[#333]" />
                          </div>
                         <div className="space-y-4 w-full">
                           <div className="flex flex-wrap items-center gap-3">
                             <h4 className="font-black text-xl text-white uppercase italic tracking-tight">{worker?.name || "Anonymous"}</h4>
                             <span className={`text-[9px] font-black tracking-widest px-2 py-1 border ${
                               isAccepted ? 'bg-white text-black border-white' : 
                               app.status === 'rejected' ? 'bg-transparent text-red-500 border-red-500/30' : 
                               'bg-transparent text-[#444] border-[#222]'
                             } uppercase`}>
                               {app.status}
                             </span>
                             {/* Payment preference badge */}
                             <span className={`text-[9px] font-black tracking-widest px-2 py-1 border uppercase ${isDirect ? 'text-[#25D366] border-[#25D366]/30 bg-[#25D366]/5' : 'text-[#C9A9FF] border-[#8825F5]/30 bg-[#8825F5]/5'}`}>
                               {isDirect ? '⚡ Direct' : '🛡️ Escrow'}
                             </span>
                             {worker?.rating && worker.rating_count > 0 && (
                               <span className="text-[9px] font-black tracking-widest px-2 py-1 border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 uppercase">
                                 ★ {Number(worker.rating).toFixed(1)} ({worker.rating_count})
                               </span>
                             )}
                             {worker?.jobs_completed > 0 && (
                               <span className="text-[9px] font-black tracking-widest px-2 py-1 border border-[#222] text-[#666] uppercase">
                                 {worker.jobs_completed} Jobs Done
                               </span>
                             )}
                           </div>
                           <div className="text-[10px] font-bold text-[#444] tracking-widest uppercase break-words">
                              <span className="text-[#888]">{worker?.college || "No college listed"}</span> // {worker?.email}
                           </div>
                           {(worker?.skills?.length > 0 || worker?.experience) && (
                             <div className="text-xs text-[#888] flex flex-col gap-1">
                               {worker?.skills?.length > 0 && <p><span className="text-[#555] font-bold uppercase text-[9px] tracking-widest">Skills:</span> {worker.skills.join(', ')}</p>}
                               {worker?.experience && <p><span className="text-[#555] font-bold uppercase text-[9px] tracking-widest">Experience:</span> {worker.experience}</p>}
                             </div>
                           )}
                           <div className="flex flex-wrap gap-3">
                             <Link href={`/u/${worker?.username || app.worker_id}`} target="_blank" className="text-[9px] font-black uppercase tracking-widest text-[#666] hover:text-white border border-[#222] px-3 py-1.5 bg-[#111] transition-colors">
                               View Profile
                             </Link>
                             {worker?.resume_url && (
                               <a href={worker.resume_url} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest text-[#666] hover:text-white border border-[#222] px-3 py-1.5 bg-[#111] flex items-center gap-1.5 transition-colors">
                                 <FileText size={10} /> Resume
                               </a>
                             )}
                             {worker?.portfolio_links?.length > 0 && worker.portfolio_links.map((link: string, idx: number) => (
                               <a key={idx} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" className="text-[9px] font-black uppercase tracking-widest text-[#666] hover:text-white border border-[#222] px-3 py-1.5 bg-[#111] transition-colors">
                                 Portfolio {idx + 1}
                               </a>
                             ))}
                           </div>
                           {app.pitch && (
                             <div className="text-sm text-[#888] bg-[#0B0B11] border border-[#222] p-5 md:p-6 w-full italic leading-relaxed">
                               <span className="uppercase text-[8px] font-bold text-[#333] block mb-3 tracking-[0.3em]">Application Pitch</span>
                               &quot;{app.pitch}&quot;
                             </div>
                           )}
                         </div>
                       </div>

                       <div className="shrink-0 flex flex-col sm:flex-row items-stretch gap-px bg-[#222] border border-[#222] w-full md:w-auto overflow-hidden">
                          {isApplied && (
                            <>
                              {isDirect ? (
                                <button disabled={hiringId === app.id} onClick={async () => {
                                  if (!worker?.phone) {
                                    toast.error("Worker hasn't provided a phone number.");
                                    return;
                                  }
                                  const phoneStr = String(worker.phone);
                                  const cleanPhone = phoneStr.replace(/\D/g, '');
                                  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                                  const message = encodeURIComponent(`Hi ${worker?.name}, I'm reaching out regarding my task "${gig.title}" on DoItForMe.`);
                                  window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
                                  
                                  await updateApplicationStatus(app.id, 'pending');
                                }} className="flex-1 p-5 md:p-4 bg-[#0a0a0a] hover:bg-[#25D366] hover:text-white text-[10px] md:text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                  WhatsApp
                                </button>
                              ) : (
                                <button disabled={hiringId === app.id} onClick={() => handleHire(app)} className="flex-1 p-5 md:p-4 bg-[#0a0a0a] hover:bg-white hover:text-black text-[10px] md:text-[9px] font-black uppercase tracking-widest transition-all">
                                  {hiringId === app.id ? 'Processing...' : '🛡️ Hire via Escrow'}
                                </button>
                              )}
                              <button onClick={() => updateApplicationStatus(app.id, 'rejected')} className="flex-1 p-5 md:p-4 bg-[#0a0a0a] hover:bg-red-500 hover:text-white text-[10px] md:text-[9px] font-black uppercase tracking-widest transition-all border-l border-[#222]">Reject</button>
                            </>
                          )}
                          {isPending && (
                            <div className="flex flex-col w-full border-t border-yellow-500/30">
                              <div className="bg-yellow-500/10 p-4 text-center border-b border-yellow-500/20">
                                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest block mb-1">Direct Connect Pending</span>
                                <span className="text-[10px] text-yellow-500/70">Have you finalized terms on WhatsApp?</span>
                              </div>
                              <div className="flex">
                                {isDirect && worker?.phone && (
                                  <button onClick={() => {
                                    const phoneStr = String(worker.phone);
                                    const cleanPhone = phoneStr.replace(/\D/g, '');
                                    const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                                    const message = encodeURIComponent(`Hi ${worker?.name}, I'm reaching out regarding my task "${gig.title}" on DoItForMe.`);
                                    window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
                                  }} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-[#25D366] hover:text-white text-[9px] font-black uppercase tracking-widest transition-all border-r border-[#222] flex items-center justify-center gap-2">
                                    WhatsApp
                                  </button>
                                )}
                                {isDirect && (
                                  <button disabled={hiringId === app.id} onClick={async () => {
                                    setHiringId(app.id);
                                    try {
                                      const res = await fetch("/api/gig/hire-direct", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ gigId: gig.id, workerId: app.worker_id, applicationId: app.id })
                                      });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data.error || "Failed to finalize direct hire");
                                      
                                      setApplications(prev => prev.map(a => a.id === app.id ? { ...a, status: 'accepted' } : a));
                                      toast.success("Worker Officially Hired!");
                                    } catch(e: any) {
                                      toast.error(e.message);
                                    } finally {
                                      setHiringId(null);
                                    }
                                  }} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-yellow-500 hover:text-black text-[9px] font-black uppercase tracking-widest transition-all">
                                    ✓ Hire
                                  </button>
                                )}
                                <button onClick={() => updateApplicationStatus(app.id, 'rejected')} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-red-500 hover:text-white text-[9px] font-black uppercase tracking-widest transition-all border-l border-[#222]">Reject</button>
                              </div>
                            </div>
                          )}
                          {isAccepted && (
                            <>
                              {isDirect && worker?.phone && (
                                <button onClick={() => {
                                  const phoneStr = String(worker.phone);
                                  const cleanPhone = phoneStr.replace(/\D/g, '');
                                  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                                  const message = encodeURIComponent(`Hi ${worker?.name}, I'm reaching out regarding my task "${gig.title}" on DoItForMe.`);
                                  window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
                                }} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-[#25D366] hover:text-white text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-r border-[#222]">
                                  WhatsApp
                                </button>
                              )}
                              {!isDirect && (
                                <button onClick={() => router.push(`/chat/${gig.id}?chat=${gig.id}_${app.worker_id}`)} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-[#8825F5] hover:text-white text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border-r border-[#222]">
                                  <MessageCircle size={12} /> Platform Chat
                                </button>
                              )}
                              <button onClick={() => { setSelectedWorkerId(app.worker_id); setShowIncentiveModal(true); }} className="flex-1 p-4 bg-[#0a0a0a] hover:bg-white hover:text-black text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                                <Gift size={12} /> Incentive
                              </button>
                            </>
                          )}
                          {!isAccepted && (
                            <button onClick={() => router.push(`/chat/${gig.id}?chat=${gig.id}_${app.worker_id}`)} className="p-4 bg-[#0a0a0a] hover:bg-white hover:text-black transition-all flex items-center justify-center border-l border-[#222]">
                              <MessageCircle size={16} />
                            </button>
                          )}
                       </div>
                     </div>
                   </div>
                 )
               })}
             </div>
           )}
        </div>

      </div>

      {/* EDIT TASK MODAL — limited edit while open & nobody hired */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0B11]/95 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto" onClick={(e) => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="bg-[#0a0a0a] border border-[#222] p-8 md:p-10 w-full max-w-lg relative animate-in zoom-in-95 duration-200 my-8">
            <button onClick={() => setShowEditModal(false)} className="absolute top-6 right-6 text-[#444] hover:text-white transition-colors"><X size={18} /></button>
            <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">Edit Task</h3>
            <p className="text-[10px] font-bold text-[#666] uppercase tracking-widest mb-8 leading-relaxed">Refine your post to attract better applicants. Locks once you hire someone.</p>

            <div className="space-y-6">
              <div>
                <label className={labelClass}>Title</label>
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={120}
                  className="w-full bg-[#0B0B11] border border-[#222] p-4 text-white font-bold text-sm focus:outline-none focus:border-white transition-colors" />
              </div>
              <div>
                <label className={labelClass}>Description</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={5}
                  className="w-full bg-[#0B0B11] border border-[#222] p-4 text-white text-sm leading-relaxed focus:outline-none focus:border-white transition-colors resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Category</label>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-[#0B0B11] border border-[#222] p-4 text-white font-bold text-sm focus:outline-none focus:border-white transition-colors">
                    {EDIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Budget / Worker (₹)</label>
                  <input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} disabled={hasApplicants}
                    className="w-full bg-[#0B0B11] border border-[#222] p-4 text-white font-black text-sm focus:outline-none focus:border-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed" />
                  {hasApplicants && <p className="text-[9px] text-[#555] uppercase tracking-widest mt-2 leading-relaxed">Price locked — applicants applied at the listed rate.</p>}
                </div>
              </div>
            </div>

            <button onClick={handleSaveEdit} disabled={savingEdit || !editTitle.trim() || !editDescription.trim()}
              className="w-full mt-10 p-5 bg-white text-black font-black uppercase tracking-[0.3em] text-xs transition-all disabled:opacity-30 hover:bg-gray-200 flex items-center justify-center gap-2">
              {savingEdit ? <><Loader2 size={14} className="animate-spin" /> Saving</> : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* INCENTIVE MODAL */}
      {showIncentiveModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0B11]/95 backdrop-blur-sm flex items-center justify-center p-6" onClick={(e) => e.target === e.currentTarget && setShowIncentiveModal(false)}>
          <div className="bg-[#0a0a0a] border border-[#222] p-12 w-full max-w-md relative animate-in zoom-in-95 duration-200">
             <button onClick={() => setShowIncentiveModal(false)} className="absolute top-6 right-6 text-[#444] hover:text-white transition-colors">✕</button>
             
             <div className="w-12 h-12 bg-white flex items-center justify-center mb-8">
               <Gift size={24} className="text-black" />
             </div>
             
             <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-4">Grant Bonus</h3>
             <p className="text-[10px] font-bold text-[#666] uppercase tracking-widest mb-10 leading-relaxed">Send a bonus to reward high-performance delivery. (Coming Soon — will be enabled in the next update.)</p>
             
             <div className="space-y-10 mb-12">
                <div>
                  <label className={labelClass}>Bonus Amount (INR)</label>
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
               Authorize (Coming Soon)
             </button>
          </div>
        </div>
      )}



    </div>
  );
}
