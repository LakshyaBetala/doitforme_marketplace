"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { 
  Type, 
  AlignLeft, 
  IndianRupee, 
  MapPin, 
  Globe, 
  Building, 
  Image as ImageIcon,
  Loader2,
  Send,
  X,
  AlertCircle,
  CheckCircle2,
  UploadCloud
} from "lucide-react";

export default function PostGigPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATE MANAGEMENT ---
  const [user, setUser] = useState<any | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState("Online");
  const [location, setLocation] = useState("");
  // Deadline (date + time)
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // --- AUTH CHECK ---
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);
      // Fetch public profile to check UPI
      if (u) {
        const { data: dbUser } = await supabase.from("users").select("upi_id").eq("id", u.id).maybeSingle();
        setUserProfile(dbUser);
      }
      setUserLoading(false);
      if (!u) router.push("/login");
    })();
  }, [router, supabase]);

  // --- HANDLERS ---

  // Handle Image Selection
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    
    // Create local previews for immediate UI feedback
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    
    setImages((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  };

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // Validation
  const validate = () => {
    if (!title.trim()) return "Please enter a gig title.";
    if (title.length > 80) return "Title is too long (max 80 chars).";
    if (!description.trim()) return "Please describe the task.";
    if (description.length > 500) return "Description is too long (max 500 chars).";
    const p = Number(price);
    if (Number.isNaN(p) || p < 20) return "Minimum budget is ₹20.";
    if (mode !== "Online" && !location.trim()) return "Location is required for offline tasks.";
    // Deadline validation (if provided)
    if (deadlineDate) {
      const dt = new Date(`${deadlineDate}T${deadlineTime || "23:59"}`);
      if (isNaN(dt.getTime())) return "Invalid deadline date/time.";
      if (dt.getTime() <= Date.now()) return "Deadline must be in the future.";
    }
    return null;
  };

  // --- SUBMIT LOGIC ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return setError(validationError);
    }
    
    if (!user) return setError("Session expired. Please login again.");

    if (!userProfile?.upi_id) {
      setError("Please add your UPI ID in your profile before posting a gig.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const uploadedPaths: string[] = [];

      // 1. Upload Images to Supabase Storage
      if (images.length > 0) {
        await Promise.all(
          images.map(async (file) => {
            // Sanitize filename
            const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
            const path = `${user.id}/${Date.now()}_${fileName}`;

            const { data, error: uploadError } = await supabase.storage
              .from("gig-images")
              .upload(path, file, { cacheControl: "3600", upsert: false });

            if (uploadError) throw uploadError;
            
            // Get Public URL (Optional, but storing path is usually enough)
            uploadedPaths.push(path);
          })
        );
      }

      // 2. Prepare Payload (Mapping to DB Schema)
      const payload = {
        poster_id: user.id,           // Correct field name
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        is_physical: mode !== "Online", // Convert UI mode to boolean
        location: mode === "Online" ? null : location.trim(),
        images: uploadedPaths,        // Array of string paths
        // Persist deadline as ISO string if provided
        deadline: deadlineDate ? new Date(`${deadlineDate}T${deadlineTime || "23:59"}`).toISOString() : null,
        status: "open",               // Initial status
        created_at: new Date().toISOString()
      };

      // 3. Insert into DB
      const { error: dbError } = await supabase.from("gigs").insert(payload);

      if (dbError) throw dbError;

      // Success! Redirect
      router.push("/dashboard");
      
    } catch (err: any) {
      console.error("Submission Error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B11]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
          <p className="text-white/50 text-sm animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white flex items-center justify-center p-4 py-20 relative overflow-hidden selection:bg-brand-purple selection:text-white">
      
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-brand-purple/20 blur-[150px] rounded-full opacity-60"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-blue/20 blur-[150px] rounded-full opacity-60"></div>
      </div>

      <div className="w-full max-w-4xl relative z-10">
        
        {/* --- BACK BUTTON --- */}
        <button
          onClick={() => router.back()}
          className="mb-8 flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* --- PAGE HEADER --- */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center p-4 bg-white/5 rounded-3xl mb-6 border border-white/10 shadow-[0_0_40px_rgba(136,37,245,0.15)] backdrop-blur-md">
             <Image src="/logo.svg" alt="DoItForMe" width={48} height={48} className="w-12 h-12 object-contain" />
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">
            Post a <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-brand-blue">New Request</span>
          </h1>
          {!userProfile?.upi_id && (
            <div className="mx-auto max-w-2xl mb-4">
              <div className="p-3 rounded-md bg-red-600 text-white text-sm font-bold text-center">
                Please add your UPI ID in your <Link href="/profile" className="underline">Profile</Link> to post gigs. You won't be able to receive payments without it.
              </div>
            </div>
          )}
          <p className="text-white/50 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Need help with an assignment, delivery, or task? <br className="hidden md:block"/>
            Set your budget and let verified peers handle it.
          </p>
        </div>

        {/* --- MAIN FORM CARD --- */}
        <form 
          onSubmit={handleSubmit} 
          className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[#121217]/90 backdrop-blur-2xl shadow-2xl p-8 md:p-12 space-y-10"
        >
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none"></div>

          {/* Validation Error Banner */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* SECTION 1: DETAILS */}
          <div className="space-y-8">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span className="w-8 h-[1px] bg-white/20"></span> Task Details
            </h3>

            <div className="grid gap-8">
              {/* Title Input */}
              <div className="group space-y-3">
                <label className="text-base font-semibold text-white/80 group-focus-within:text-brand-purple transition-colors flex items-center gap-2">
                  <Type className="w-4 h-4" /> What needs to be done?
                </label>
                <div className="relative">
                  <input
                    className="w-full bg-black/20 border border-white/10 rounded-2xl p-5 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-purple/50 focus:bg-brand-purple/5 transition-all font-medium text-lg shadow-inner"
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setError(""); }}
                    maxLength={80}
                    placeholder="e.g. Pick up my laundry from Block A"
                    autoFocus
                  />
                  <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono ${title.length > 70 ? "text-red-400" : "text-white/20"}`}>
                    {title.length}/80
                  </span>
                </div>
              </div>

              {/* Description Input */}
              <div className="group space-y-3">
                <label className="text-base font-semibold text-white/80 group-focus-within:text-brand-blue transition-colors flex items-center gap-2">
                  <AlignLeft className="w-4 h-4" /> Details & Requirements
                </label>
                <div className="relative">
                  <textarea
                    className="w-full bg-black/20 border border-white/10 rounded-2xl p-5 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-blue/50 focus:bg-brand-blue/5 transition-all min-h-[160px] resize-none leading-relaxed text-base shadow-inner"
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setError(""); }}
                    maxLength={500}
                    placeholder="Provide specific instructions. E.g. 'Deliver before 5 PM', 'Bring ID card', etc."
                  />
                  <span className={`absolute right-4 bottom-4 text-xs font-mono ${description.length > 450 ? "text-red-400" : "text-white/20"}`}>
                    {description.length}/500
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: LOGISTICS */}
          <div className="space-y-8">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span className="w-8 h-[1px] bg-white/20"></span> Logistics
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Budget Input */}
              <div className="group space-y-3">
                <label className="text-base font-semibold text-white/80 group-focus-within:text-green-400 transition-colors flex items-center gap-2">
                  <IndianRupee className="w-4 h-4" /> Your Budget
                </label>
                <div className="relative">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 font-bold text-xl pointer-events-none">₹</div>
                  <input
                    type="number"
                    className="w-full bg-black/20 border border-white/10 rounded-2xl p-5 pl-10 text-white placeholder:text-white/20 focus:outline-none focus:border-green-500/50 focus:bg-green-500/5 transition-all font-mono font-bold text-2xl shadow-inner"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); setError(""); }}
                    min={20}
                    placeholder="0"
                  />
                </div>
                <p className="text-xs text-white/30 pl-2">Minimum ₹20 required</p>
              </div>

              {/* Location Input (Conditional) */}
              <div className="group space-y-3">
                <label className="text-base font-semibold text-white/80 group-focus-within:text-brand-pink transition-colors flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location
                </label>
                <input
                  className={`w-full border rounded-2xl p-5 transition-all focus:outline-none text-base ${
                    mode === "Online" 
                      ? "bg-white/5 border-white/5 text-white/30 cursor-not-allowed" 
                      : "bg-black/20 border-white/10 text-white placeholder:text-white/20 focus:border-brand-pink/50 focus:bg-brand-pink/5 shadow-inner"
                  }`}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={mode === "Online"}
                  placeholder={mode === "Online" ? "Not required for online tasks" : "e.g. Library, Main Gate"}
                />
              </div>
            </div>

            {/* Mode Selection Tiles */}
            <div className="space-y-3">
              <label className="text-base font-semibold text-white/80">Task Mode</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: "Online", icon: Globe, label: "Remote / Online", desc: "No meeting needed" },
                  { id: "Offline (Same Campus)", icon: Building, label: "On Campus", desc: "Within college" },
                  { id: "Outside Campus", icon: MapPin, label: "Outside", desc: "City travel" }
                ].map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`relative overflow-hidden flex flex-col items-start gap-2 p-5 rounded-2xl border text-left transition-all duration-300 group/tile ${
                      mode === m.id
                        ? "bg-brand-purple/10 border-brand-purple text-white shadow-[0_0_20px_rgba(136,37,245,0.2)]"
                        : "bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <div className={`p-2 rounded-lg transition-colors ${mode === m.id ? "bg-brand-purple text-white" : "bg-white/10 group-hover/tile:bg-white/20"}`}>
                      <m.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-sm font-bold">{m.label}</span>
                      <span className="text-[10px] opacity-60 uppercase tracking-wide">{m.desc}</span>
                    </div>
                    {mode === m.id && (
                      <div className="absolute top-3 right-3 text-brand-purple">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 3: DEADLINE */}
          <div className="space-y-8">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span className="w-8 h-[1px] bg-white/20"></span> Deadline (optional)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              <div className="sm:col-span-2">
                <input
                  type="date"
                  className="w-full bg-black/20 border border-white/10 rounded-2xl p-3 text-white focus:outline-none focus:border-brand-purple/50 transition-all text-lg"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <input
                  type="time"
                  className="w-full bg-black/20 border border-white/10 rounded-2xl p-3 text-white focus:outline-none focus:border-brand-purple/50 transition-all text-lg"
                  value={deadlineTime}
                  onChange={(e) => setDeadlineTime(e.target.value)}
                  step={900}
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: ATTACHMENTS */}
          <div className="space-y-8">
            <h3 className="text-sm font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
              <span className="w-8 h-[1px] bg-white/20"></span> Attachments
            </h3>

            <div 
              className={`relative border-2 border-dashed rounded-3xl p-8 transition-all duration-300 ${
                isDragging 
                  ? "border-brand-purple bg-brand-purple/10 scale-[1.01]" 
                  : "border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onFilesChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              
              <div className="flex flex-col items-center justify-center text-center">
                <div className={`p-4 rounded-full mb-4 transition-transform duration-300 ${isDragging ? "scale-110 bg-brand-purple text-white" : "bg-white/5 text-white/50"}`}>
                   <UploadCloud className="w-8 h-8" />
                </div>
                <p className="text-lg font-medium text-white mb-1">
                  {isDragging ? "Drop images here" : "Click or Drag images here"}
                </p>
                <p className="text-sm text-white/40">Supports JPG, PNG (Max 5MB)</p>
              </div>
            </div>

            {/* Image Previews Grid */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative group/img aspect-square rounded-2xl overflow-hidden border border-white/10 bg-black">
                    <Image src={src} alt="Preview" fill className="object-cover opacity-80 group-hover/img:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full transition-transform hover:scale-110"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full h-[1px] bg-white/10"></div>

          {/* --- SUBMIT ACTIONS --- */}
          <div className="pt-2">
            <button
              disabled={loading || !userProfile?.upi_id}
              className="w-full relative group overflow-hidden rounded-2xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_40px_rgba(136,37,245,0.3)] hover:shadow-[0_0_60px_rgba(136,37,245,0.5)] transition-shadow duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-blue group-hover:opacity-100 transition-opacity duration-300 animate-gradient-xy"></div>
              <div className="relative bg-[#1a1a24] group-hover:bg-transparent transition-colors rounded-[15px] p-5 flex items-center justify-center gap-3">
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                    <span className="font-bold text-xl text-white tracking-wide">Posting Gig...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-6 h-6 text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    <span className="font-bold text-xl text-white tracking-wide">Post Request Now</span>
                  </>
                )}
              </div>
            </button>
            {!userProfile?.upi_id && (
              <p className="text-center text-sm text-red-400 mt-3">Please add your UPI ID in your <Link href="/profile" className="underline">Profile</Link> to post gigs.</p>
            )}
            <p className="text-center text-xs text-white/30 mt-4">
              By posting, you agree to our Terms of Service. Payment will be held in escrow.
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}