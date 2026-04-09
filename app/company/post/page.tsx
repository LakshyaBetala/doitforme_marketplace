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
    "Commerce & Finance", "Academics & Projects", "Data & Research", "Writing & Content", 
    "Marketing & PR", "Other"
  ];

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      if (!u) return router.push("/login");

      const { data: dbUser } = await supabase.from("users").select("role, is_verified_company").eq("id", u.id).single();
      
      if (dbUser?.role !== 'COMPANY' || !dbUser?.is_verified_company) {
          toast.error("Access denied. Only verified companies can post company tasks.");
          return router.push('/company/dashboard');
      }

      setUser({ ...u, user_metadata: { ...u.user_metadata, ...dbUser } });
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
      <div className="min-h-screen flex items-center justify-center bg-[#070B1A]">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B1A] text-white pt-8 pb-24 px-4 flex justify-center relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 blur-[150px] rounded-full"></div>
      </div>

      <div className="w-full max-w-3xl relative z-10 space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => router.push('/company/dashboard')} className="text-white/60 hover:text-white transition w-10 h-10 flex items-center justify-center rounded-full bg-white/10 border border-white/5">
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/20 px-4 py-2 rounded-full">
            <Building2 size={16} className="text-indigo-400" />
            <span className="text-sm font-bold text-indigo-400 uppercase tracking-widest">New Company Task</span>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="bg-[#0F172A] border border-[#1E293B] rounded-[32px] p-6 md:p-10 space-y-8 shadow-2xl">
          
          {/* Title & Category */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest">Task Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Need 5 Campus Ambassadors for TechFest" className="w-full bg-[#1A1A24] border border-[#1E293B] rounded-2xl p-5 text-lg text-white outline-none focus:border-indigo-500/50 transition-all focus:ring-1 focus:ring-indigo-500/50" />
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest">Category</label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${category === cat ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30" : "bg-[#1A1A24] border border-[#1E293B] text-zinc-400 hover:bg-white/10 hover:text-white"}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest">Detailed Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Clear details about the job responsibilities, skills required, etc." className="w-full bg-[#1A1A24] border border-[#1E293B] rounded-2xl p-5 text-base text-white outline-none focus:border-indigo-500/50 transition-all resize-none h-40 focus:ring-1 focus:ring-indigo-500/50" />
            </div>
          </div>

          <hr className="border-[#1E293B]" />

          {/* Logistics */}
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest">Required Workers</label>
                  <div className="relative">
                    <User size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input type="number" min="1" max="50" value={maxWorkers} onChange={(e) => setMaxWorkers(parseInt(e.target.value) || 1)} className="w-full bg-[#1A1A24] border border-[#1E293B] rounded-2xl py-4 pl-12 pr-5 text-xl font-bold text-white outline-none focus:border-indigo-500/50 transition-all" />
                  </div>
                  <p className="text-[10px] text-zinc-500">Max limit per task is 50 workers.</p>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest">Budget (Per Worker)</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-zinc-500 font-mono">₹</span>
                    <input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="500" className="w-full bg-[#1A1A24] border border-[#1E293B] rounded-2xl py-4 pl-10 pr-5 text-xl font-black text-white outline-none focus:border-indigo-500/50 transition-all font-mono" />
                  </div>
                  <p className="text-[10px] text-zinc-500">Total estimated budget: ₹{(Number(price) || 0) * (maxWorkers || 1)}</p>
                </div>
             </div>

             <div className="space-y-3">
                <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest">Format</label>
                <div className="flex flex-wrap gap-2">
                  {["Online", "Offline (On-Site)"].map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${mode === m ? "bg-indigo-600 text-white" : "bg-[#1A1A24] border border-[#1E293B] text-zinc-400"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {mode !== "Online" && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-indigo-400 uppercase tracking-widest">Location</label>
                  <div className="relative">
                    <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      className="w-full bg-[#1A1A24] border border-[#1E293B] rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:border-indigo-500/50 transition-all"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Enter full address or venue"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Deadline Date</label>
                  <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="w-full bg-[#1A1A24] border border-[#1E293B] rounded-xl p-4 text-sm text-white outline-none focus:border-indigo-500/50" style={{colorScheme: 'dark'}} />
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Deadline Time</label>
                  <input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="w-full bg-[#1A1A24] border border-[#1E293B] rounded-xl p-4 text-sm text-white outline-none focus:border-indigo-500/50" style={{colorScheme: 'dark'}} />
                </div>
              </div>
          </div>

          <hr className="border-[#1E293B]" />

          {/* Media */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex justify-between items-center">
              <span>Attachments <span className="text-zinc-500 normal-case ml-1">(Optional)</span></span>
            </label>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              <input ref={fileInputRef} type="file" accept="image/*, .pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              
              <button onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#1E293B] hover:border-indigo-500/50 hover:bg-indigo-500/10 flex flex-col items-center justify-center shrink-0 transition-all group">
                <FileText className="w-6 h-6 text-zinc-500 group-hover:text-indigo-400 mb-2" />
                <span className="text-[10px] text-zinc-500 group-hover:text-indigo-400 font-bold uppercase tracking-widest">Upload files</span>
              </button>

              {imagePreviews.map((src, i) => {
                const isImage = images[i]?.type.startsWith("image/");
                return (
                  <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-[#1E293B] shrink-0 group bg-[#1A1A24]">
                    {isImage ? (
                      <Image src={src} alt="Preview" fill className="object-cover" />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-2 text-center text-indigo-400">
                        <FileText size={24} className="mb-1 opacity-80" />
                        <span className="text-[8px] text-zinc-400 leading-tight truncate w-full">{images[i]?.name}</span>
                      </div>
                    )}
                    <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/80 backdrop-blur-md p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-500"><X size={12} /></button>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading} className={`w-full p-5 rounded-2xl font-black text-lg transition-all flex justify-center items-center gap-2 active:scale-95 shadow-[0_0_30px_rgba(79,70,229,0.2)] mt-8 ${loading ? 'bg-[#1E293B] text-zinc-500' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white'}`}>
            {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <><CheckCircle size={22} /> Publish Company Task</>}
          </button>
        </div>
      </div>
    </div>
  );
}
