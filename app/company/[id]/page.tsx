"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import {
  Building2, MapPin, Loader2, IndianRupee, ShieldCheck, ExternalLink, Globe, User, Clock, ArrowLeft
} from "lucide-react";

export default function CompanyPublicProfile() {
  const params = useParams();
  const router = useRouter();
  const companyId = params?.id as string;
  const supabase = supabaseBrowser();

  const [company, setCompany] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!companyId) return;

      // Fetch company details
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
        
      if (!companyData || companyError) {
        setLoading(false);
        return;
      }
      setCompany(companyData);

      // Fetch active gigs posted by this company
      const { data: gigsData } = await supabase
        .from('gigs')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (gigsData) setGigs(gigsData);
      
      setLoading(false);
    }
    loadData();
  }, [companyId, supabase]);

  if (loading) return <div className="h-screen bg-[#070B1A] flex justify-center items-center"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>;
  
  if (!company) return (
    <div className="h-screen bg-[#070B1A] flex flex-col gap-4 justify-center items-center text-white">
      <Building2 size={48} className="text-zinc-600 mb-4" />
      <p className="text-white/50 text-xl font-bold">Company not found.</p>
      <button onClick={() => router.push('/dashboard')} className="text-indigo-400 mt-4 text-sm font-bold flex items-center gap-2">
         <ArrowLeft size={16} /> Back to Dashboard
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070B1A] text-white pb-36 font-sans">

      {/* TOP HEADER BAR */}
      <div className="sticky top-0 z-30 bg-[#070B1A]/80 backdrop-blur-xl border-b border-[#1E293B]">
        <div className="max-w-4xl mx-auto flex items-center justify-between p-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-bold">
            <ArrowLeft size={18} /> Back
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-8 mt-4">

        {/* HERO CARD */}
        <div className="relative overflow-hidden rounded-[32px] border border-[#1E293B] bg-[#0F172A] p-8 md:p-12 shadow-2xl group">
           <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none group-hover:bg-indigo-500/15 transition-colors"></div>
           
           <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8">
             
             {/* Logo */}
             <div className="relative shrink-0">
               <div className="w-28 h-28 md:w-36 md:h-36 rounded-3xl p-[2px] bg-gradient-to-tr from-indigo-500 via-white to-purple-600 shadow-xl">
                 <div className="w-full h-full rounded-3xl bg-[#0F172A] flex items-center justify-center overflow-hidden relative">
                   {company.logo_url ? (
                     <Image src={company.logo_url} alt="Logo" fill className="object-cover" />
                   ) : (
                     <Building2 size={48} className="text-indigo-400 opacity-80" />
                   )}
                 </div>
               </div>
               {company.is_active && (
                   <div className="absolute -bottom-2 -right-2 bg-green-500 text-black p-1.5 rounded-full border-4 border-[#0F172A] shadow-md" title="Verified Company">
                     <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                   </div>
               )}
             </div>

             {/* Info */}
             <div className="flex-1 text-center md:text-left space-y-4 w-full">
               <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                 {company.name}
               </h1>
               
               <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-white/60 text-xs md:text-sm font-medium">
                 {company.company_type && (
                   <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 uppercase tracking-widest text-[10px] font-black">
                     {company.company_type}
                   </span>
                 )}
                 {company.website && (
                   <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors">
                     <Globe className="w-4 h-4 text-zinc-400 shrink-0" /> Visit Website
                     <ExternalLink size={10} className="ml-1 opacity-50" />
                   </a>
                 )}
               </div>

               <p className="text-sm md:text-base text-zinc-400 leading-relaxed whitespace-pre-wrap max-w-2xl mt-4">
                 {company.description || "No description provided."}
               </p>
             </div>
           </div>
        </div>

        {/* OPEN OPPORTUNITIES */}
        <div className="space-y-6">
           <h2 className="text-2xl font-black text-white flex items-center gap-3">
             Open Opportunities
             <span className="px-3 py-1 bg-white/10 text-white rounded-full text-sm font-bold">{gigs.length}</span>
           </h2>

           {gigs.length === 0 ? (
              <div className="border border-[#1E293B] bg-[#0F172A] rounded-3xl p-12 text-center">
                 <Building2 size={48} className="mx-auto text-zinc-600 mb-4" />
                 <p className="text-zinc-400 font-medium">This company has no open tasks at the moment.</p>
              </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {gigs.map(gig => (
                 <Link href={`/gig/${gig.id}`} key={gig.id} className="bg-[#0F172A] border border-[#1E293B] hover:border-indigo-500/50 rounded-2xl p-6 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] transition-all flex flex-col group min-h-[200px]">
                   <div className="mb-3">
                     <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] uppercase font-black tracking-widest rounded-lg border border-indigo-500/20">
                         {gig.listing_type === 'COMPANY_TASK' ? 'Company Task' : gig.listing_type}
                     </span>
                   </div>
                   
                   <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 pr-4 leading-snug group-hover:text-indigo-400 transition-colors uppercase tracking-wide">{gig.title}</h3>
                   
                   <p className="text-xs text-zinc-500 line-clamp-2 mb-4">{gig.description}</p>
                   
                   <div className="mt-auto pt-4 border-t border-[#1E293B] flex items-center justify-between">
                       <span className="text-xl text-white font-black flex items-center gap-1">
                         <IndianRupee size={16} className="text-indigo-400" /> {gig.price} <span className="text-xs text-zinc-500 font-normal ml-1">/ worker</span>
                       </span>
                       <div className="flex items-center gap-4">
                           <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                             <User size={12} className="text-zinc-500" /> {gig.max_workers} limit
                           </span>
                       </div>
                   </div>
                 </Link>
               ))}
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
