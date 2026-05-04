"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { toast } from "sonner";
import { useModeration } from "@/app/hooks/useModeration";
import Image from "next/image";
import {
  Loader2, X, Camera, FileText, Image as ImageIcon, MapPin, CheckCircle, ArrowLeft, Building2, User
} from "lucide-react";

export default function CompanyPostTask() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const { analyze } = useModeration();

  const [user, setUser] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [description, setDescription] = useState("");
  const [maxWorkers, setMaxWorkers] = useState<number>(1);
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState("Online");
  const [location, setLocation] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const categories = [
    "Tech & Engineering", "Design & Creative", "Science & Medical", "Law & Humanities", 
    "Commerce & Finance", "Academics & Gigs", "Data & Research", "Writing & Content", 
    "Marketing & PR", "Other"
  ];

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!u) return router.push("/login");

      const { data: dbUser } = await supabase.from("users").select("role, is_verified_company").eq("id", u.id).single();
      const { data: companyData } = await supabase.from("companies").select("id").eq("user_id", u.id).single();
      
      if (dbUser?.role !== 'COMPANY' || !dbUser?.is_verified_company) {
          toast.error("Access denied. Only verified companies can post company tasks.");
          return router.push('/company/dashboard');
      }

      setUser({ ...u, user_metadata: { ...u.user_metadata, ...dbUser, company_id: companyData?.id } });
      setLoadingInitial(false);
      setDeadlineDate(new Date().toISOString().split("T")[0]);
    })();
  }, [router, supabase]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    if (images.length + files.length > 5) {
      toast.error("Max 5 images allowed.");
      return;
    }
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setImages(prev => [...prev, ...newFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setError("");

    if (!title.trim() || !description.trim() || !price || !category) {
      return setError("Please fill in all required fields.");
    }

    if (maxWorkers < 1 || maxWorkers > 50) {
      return setError("Required workers must be between 1 and 50.");
    }

    const p = Number(price);
    if (Number.isNaN(p) || p < 100) return "Minimum budget per worker is ₹100.";

    if (mode !== "Online" && !location.trim()) {
      return setError("Location is required for offline tasks.");
    }

    setLoading(true);
    const textToAnalyze = `${title} ${description}`;
    const aiResult = await analyze(textToAnalyze, 'POST');
    if (!aiResult.isSafe) {
      setLoading(false);
      return setError(`Safety Alert: ${aiResult.reason || "Content flagged by AI."}`);
    }

    try {
      const uploadedPaths: string[] = [];
      if (images.length > 0) {
        await Promise.all(
          images.map(async (file) => {
            const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
            const path = `${user.id}/${Date.now()}_${fileName}`;
            const { error: uploadError } = await supabase.storage.from("gig-images").upload(path, file);
            if (uploadError) throw uploadError;
            uploadedPaths.push(path);
          })
        );
      }

      const deadlineISO = deadlineDate ? new Date(`${deadlineDate}T${deadlineTime || "23:59:59"}`).toISOString() : null;

      const payload = {
        listing_type: "COMPANY_TASK",
        category,
        poster_id: user.id,
        company_id: user.user_metadata?.company_id || null,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        max_workers: maxWorkers,
        is_physical: mode !== "Online",
        location: mode !== "Online" ? location.trim() : null,
        images: uploadedPaths,
        deadline: deadlineISO,
        status: "open",
        created_at: new Date().toISOString()
      };

      const { data: newGig, error: dbError } = await supabase.from("gigs").insert(payload).select('id').single();
      if (dbError) throw dbError;

      toast.success("Company Task posted successfully!");
      router.push("/company/dashboard");

    } catch (err: any) {
      console.error("Submission Error:", err);
      setError(err?.message || "Something went wrong.");
      setLoading(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B11]">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  const labelClass = "block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-3";
  const inputClass = "w-full bg-[#0a0a0a] border border-[#222] rounded-none p-5 text-sm font-medium text-white outline-none focus:border-white transition-all placeholder:text-[#333]";

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white pt-12 pb-24 px-4 flex justify-center relative font-sans selection:bg-white selection:text-black">
      
      {/* Editorial side marker */}
      <div className="fixed left-6 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-12 pointer-events-none">
        <div className="rotate-90 origin-left text-[10px] font-bold tracking-[0.5em] text-[#222] uppercase whitespace-nowrap">
          DEPLOYMENT // PROTOCOL 04-X
        </div>
      </div>

      <div className="w-full max-w-4xl relative z-10 space-y-12">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#222] pb-8">
          <button onClick={() => router.push('/company/dashboard')} className="text-[#666] hover:text-white transition flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
            <ArrowLeft size={16} /> Dashboard
          </button>
          
          <div className="flex items-center gap-3">
            <Image src="/Doitforme_logo.png" alt="DoItForMe" width={24} height={24} className="object-contain opacity-50" />
            <div className="flex flex-col">
              <span className="font-black text-xs tracking-tighter text-white leading-none">DoItForMe</span>
              <span className="text-[9px] font-bold text-[#444] uppercase tracking-[0.2em]">Enterprise</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-5 bg-red-950/30 border border-red-500/50 text-red-500 text-xs font-bold uppercase tracking-widest text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-12">
          
          {/* Primary Section */}
          <div className="space-y-10">
            <div className="space-y-4">
               <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic leading-none">Task Definition</h1>
               <p className="text-[#666] text-sm">Provide precise technical specifications for the required student resource units.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className={labelClass}>Deployment Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="E.G. CAMPUS AMBASSADOR PROGRAM..." className={inputClass} />
              </div>

              <div className="space-y-3">
                <label className={labelClass}>Classification</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  {categories.map(cat => <option key={cat} value={cat}>{cat.toUpperCase()}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className={labelClass}>Operational Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="DETAILED OBJECTIVES, EXPECTATIONS, AND DELIVERABLES..." className={`${inputClass} h-48 resize-none`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               <div className="space-y-3">
                  <label className={labelClass}>Resource Units (Workers)</label>
                  <div className="relative">
                    <User size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#444]" />
                    <input type="number" min="1" max="50" value={maxWorkers} onChange={(e) => setMaxWorkers(parseInt(e.target.value) || 1)} className={`${inputClass} pl-12 font-mono text-lg`} />
                  </div>
               </div>

               <div className="space-y-3">
                  <label className={labelClass}>Budget / Unit (INR)</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#444]">₹</span>
                    <input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="500" className={`${inputClass} pl-10 font-mono text-lg font-black`} />
                  </div>
               </div>

               <div className="space-y-3">
                  <label className={labelClass}>Operational Format</label>
                  <div className="flex gap-px bg-[#222] border border-[#222]">
                    {["Online", "Offline (On-Site)"].map((m) => (
                      <button key={m} onClick={() => setMode(m)} className={`flex-1 px-4 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === m ? "bg-white text-black" : "bg-[#0a0a0a] text-[#444] hover:text-white"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
               </div>
            </div>

            {mode !== "Online" && (
              <div className="space-y-3 pt-4 border-t border-[#222]">
                <label className={labelClass}>Physical Vector (Location)</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[#444]" />
                  <input
                    className={`${inputClass} pl-12`}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="FULL ADDRESS OR CAMPUS VENUE..."
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className={labelClass}>Termination Date (Deadline)</label>
                <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className={inputClass} style={{colorScheme: 'dark'}} />
              </div>
              <div className="space-y-3">
                <label className={labelClass}>Termination Time</label>
                <input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className={inputClass} style={{colorScheme: 'dark'}} />
              </div>
            </div>

            <div className="pt-8 border-t border-[#222] space-y-6">
              <label className={labelClass}>Technical Attachments</label>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                <input ref={fileInputRef} type="file" accept="image/*, .pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                
                <button onClick={() => fileInputRef.current?.click()} className="w-32 h-32 bg-[#0a0a0a] border border-[#222] hover:border-white flex flex-col items-center justify-center shrink-0 transition-all group">
                  <FileText className="w-6 h-6 text-[#444] group-hover:text-white mb-3" />
                  <span className="text-[9px] text-[#444] group-hover:text-white font-bold uppercase tracking-[0.2em]">Add Files</span>
                </button>

                {imagePreviews.map((src, i) => {
                  const isImage = images[i]?.type.startsWith("image/");
                  return (
                    <div key={i} className="relative w-32 h-32 border border-[#222] shrink-0 group bg-[#0a0a0a]">
                      {isImage ? (
                        <Image src={src} alt="Preview" fill className="object-cover grayscale hover:grayscale-0 transition-all" />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                          <FileText size={24} className="mb-2 text-white" />
                          <span className="text-[8px] text-[#444] leading-tight truncate w-full uppercase font-bold">{images[i]?.name}</span>
                        </div>
                      )}
                      <button onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-white text-black p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500 hover:text-white"><X size={12} /></button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-12">
               <button onClick={handleSubmit} disabled={loading} className={`w-full p-6 font-black text-xs uppercase tracking-[0.4em] transition-all flex justify-center items-center gap-3 ${loading ? 'bg-[#111] text-[#333]' : 'bg-white text-black hover:bg-gray-200'}`}>
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><CheckCircle size={18} /> Deploy to Ecosystem</>}
              </button>
              <div className="mt-4 text-center">
                <p className="text-[10px] font-bold text-[#333] uppercase tracking-widest">Total Deployment Budget: ₹{(Number(price) || 0) * (maxWorkers || 1)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
