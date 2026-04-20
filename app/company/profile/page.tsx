"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import {
  Building2, Mail, Globe, MapPin, Edit2, Save, X, Loader2, ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck
} from "lucide-react";

export default function CompanyProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("startup");

  const COMPANY_TYPES = ["startup", "agency", "enterprise", "ngo", "other"];

  useEffect(() => {
    async function loadCompany() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: companyData, error } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error || !companyData) {
        // Fallback UI or redirect could go here if they somehow don't have a company row
        // but onboarding guarantees they do.
        setLoading(false);
        return;
      }

      setCompany(companyData);
      setEditName(companyData.name || "");
      setEditWebsite(companyData.website || "");
      setEditEmail(companyData.contact_email || user.email || "");
      setEditDescription(companyData.description || "");
      setEditType(companyData.company_type || "startup");

      setLoading(false);
    }
    loadCompany();
  }, [router, supabase]);

  const startEditing = () => {
    setIsEditing(true);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    if (company) {
      setEditName(company.name || "");
      setEditWebsite(company.website || "");
      setEditEmail(company.contact_email || "");
      setEditDescription(company.description || "");
      setEditType(company.company_type || "startup");
    }
    setIsEditing(false);
    setSaveMessage(null);
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveMessage(null);

    if (!editName.trim()) {
      setSaveMessage({ type: 'error', text: 'Company name cannot be empty.' });
      setSaving(false);
      return;
    }

    try {
      const updates = {
        name: editName.trim(),
        website: editWebsite.trim(),
        contact_email: editEmail.trim(),
        description: editDescription.trim(),
        company_type: editType,
      };

      const { error } = await supabase
        .from("companies")
        .update(updates)
        .eq("id", company.id);

      if (error) throw error;

      setCompany({ ...company, ...updates });
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'Company profile updated!' });
      setTimeout(() => setSaveMessage(null), 3000);

    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to update.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  if (!company) return <div className="min-h-screen bg-[#050505] text-white flex justify-center items-center font-bold uppercase tracking-widest text-xs">Unit Profile Not Found.</div>;

  const labelClass = "text-[10px] font-bold text-[#444] uppercase tracking-widest mb-3 block";
  const inputClass = "w-full bg-[#0a0a0a] border border-[#222] rounded-none p-5 text-sm font-medium text-white outline-none focus:border-white transition-all placeholder:text-[#333] disabled:opacity-50";

  return (
    <main className="min-h-[100dvh] bg-[#050505] p-6 lg:p-12 pb-36 text-white selection:bg-white selection:text-black font-sans relative">
      
      {/* Side Marker */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-12 pointer-events-none">
        <div className="rotate-90 origin-left text-[10px] font-bold tracking-[0.5em] text-[#222] uppercase whitespace-nowrap">
          SYSTEM // PROFILE_MOD [VER-2.1]
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-16 relative z-10">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between border-b border-[#222] pb-8">
            <Link href="/company/dashboard" className="flex items-center gap-2 text-[#666] hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
                <ArrowLeft size={16} /> Dashboard
            </Link>
            <div className="flex items-center gap-3">
                <Image src="/Doitforme_logo.png" alt="DoItForMe" width={24} height={24} className="object-contain opacity-50" />
                <div className="flex flex-col">
                  <span className="font-black text-xs tracking-tighter text-white leading-none">DoItForMe</span>
                  <span className="text-[9px] font-bold text-[#333] uppercase tracking-[0.2em]">Enterprise Clearance</span>
                </div>
            </div>
        </div>

        {/* Status Alerts */}
        <div className="space-y-4">
            {!company.is_active && (
            <div className="bg-amber-950/20 border border-amber-500/30 p-6 flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Awaiting Deployment Clearance</p>
                <p className="text-[10px] text-amber-500/70 font-medium leading-relaxed">Administrator review in progress. Access to campus broadcast systems is restricted until credentials are verified.</p>
                </div>
            </div>
            )}

            {saveMessage && (
            <div className={`p-6 flex items-center gap-4 animate-in fade-in zoom-in-95 duration-300 ${saveMessage.type === 'success'
                ? 'bg-white/10 border border-white text-white'
                : 'bg-red-950/30 border border-red-500/50 text-red-500'
                }`}>
                {saveMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span className="text-[10px] font-black uppercase tracking-widest">{saveMessage.text}</span>
            </div>
            )}
        </div>

        {/* Core Profile Header */}
        <div className="flex flex-col lg:flex-row items-end justify-between gap-12 border-b border-[#222] pb-16">
           <div className="flex flex-col lg:flex-row items-center lg:items-end gap-10">
              
              {/* Logo Presentation */}
              <div className="relative group">
                <div className="w-32 h-32 md:w-40 md:h-40 bg-[#0a0a0a] border border-[#222] flex items-center justify-center overflow-hidden transition-all duration-500 grayscale hover:grayscale-0">
                   {company.logo_url || company.avatar_url ? (
                     <Image src={company.logo_url || company.avatar_url} alt="Logo" width={160} height={160} className="object-cover w-full h-full" />
                   ) : (
                     <Building2 size={48} className="text-[#222]" />
                   )}
                </div>
                {company.is_active && (
                    <div className="absolute -top-3 -right-3 bg-white text-black p-2 font-black italic text-[8px] uppercase tracking-tighter shadow-xl">
                      Verified Entity
                    </div>
                )}
              </div>

              {/* Title Identity */}
              <div className="text-center lg:text-left space-y-4">
                 <span className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] block">Identity // Organizational</span>
                 <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
                    {company.name}
                 </h1>
                 
                 <div className="flex flex-wrap items-center justify-center lg:justify-start gap-px bg-[#222] border border-[#222]">
                  {company.contact_email && (
                    <div className="bg-[#0a0a0a] px-4 py-2 border-r border-[#222] flex items-center gap-2">
                       <Mail size={12} className="text-[#444]" />
                       <span className="text-[9px] font-bold text-[#888] uppercase tracking-widest">{company.contact_email}</span>
                    </div>
                  )}
                  {company.website && (
                    <div className="bg-[#0a0a0a] px-4 py-2 border-r border-[#222] flex items-center gap-2">
                       <Globe size={12} className="text-[#444]" />
                       <span className="text-[9px] font-bold text-[#888] uppercase tracking-widest">{company.website.replace(/^https?:\/\//, '')}</span>
                    </div>
                  )}
                  <div className="bg-white text-black px-4 py-2 flex items-center gap-2">
                     <span className="text-[9px] font-black uppercase tracking-widest leading-none">{company.company_type || 'STANDARD'}</span>
                  </div>
                 </div>
              </div>
           </div>

           <div className="shrink-0 w-full lg:w-auto">
             {!isEditing ? (
                <button onClick={startEditing} className="w-full lg:w-auto px-10 py-5 bg-white text-black text-xs font-black uppercase tracking-[0.3em] hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                  <Edit2 size={14} /> Update Credentials
                </button>
             ) : (
                <div className="flex items-center gap-px bg-[#222] w-full border border-[#222]">
                  <button onClick={cancelEditing} className="flex-1 lg:flex-none px-6 py-5 bg-[#0a0a0a] text-[#444] hover:text-white text-[10px] font-black uppercase tracking-widest transition-all">
                    Discard
                  </button>
                  <button onClick={saveProfile} disabled={saving} className="flex-1 lg:flex-none px-10 py-5 bg-white text-black text-xs font-black uppercase tracking-[0.3em] hover:bg-gray-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Authorize Sync
                  </button>
                </div>
             )}
           </div>
        </div>

        {/* Operational Specs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-16">
          <div className="space-y-12">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
               <div className="space-y-4">
                  <label className={labelClass}>Organizational Title</label>
                  {isEditing ? (
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
                  ) : (
                    <div className="text-xl font-black text-white italic uppercase">{company.name}</div>
                  )}
               </div>

               <div className="space-y-4">
                  <label className={labelClass}>Classification</label>
                  {isEditing ? (
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className={inputClass}>
                      {COMPANY_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                    </select>
                  ) : (
                    <div className="text-xl font-black text-white italic uppercase">{company.company_type || 'N/A'}</div>
                  )}
               </div>

               <div className="space-y-4">
                  <label className={labelClass}>Technical Web Interface (Website)</label>
                  {isEditing ? (
                    <input type="url" placeholder="https://" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} className={inputClass} />
                  ) : (
                    <div className="text-xl font-black text-white italic uppercase tracking-tight">{company.website || 'OFFLINE'}</div>
                  )}
               </div>

               <div className="space-y-4">
                  <label className={labelClass}>Correspondence Vector (Email)</label>
                  {isEditing ? (
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className={inputClass} />
                  ) : (
                    <div className="text-xl font-black text-white italic uppercase tracking-tight">{company.contact_email || 'NOT FILED'}</div>
                  )}
               </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-[#222]">
              <label className={labelClass}>Operational Overview</label>
              {isEditing ? (
                <textarea rows={6} placeholder="SPECIFY MISSION PARAMETERS..." value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className={`${inputClass} resize-none leading-relaxed`} />
              ) : (
                 <div className="text-sm text-[#888] leading-relaxed max-w-3xl font-medium whitespace-pre-wrap">{company.description || 'NO SYSTEM DESCRIPTION FILED.'}</div>
              )}
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
