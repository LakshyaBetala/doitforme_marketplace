"use client";

import { toast } from "sonner";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { containsSensitiveInfo } from "@/lib/moderation-rules";
import { useModeration } from "@/app/hooks/useModeration";
import { useGigFormStore } from "@/store/useGigFormStore";
import Image from "next/image";
import {
  Loader2, Send, X, Camera, FileText, Image as ImageIcon, MapPin, BriefcaseIcon, ShoppingBagIcon, ChevronLeft, ChevronRight, CheckCircle
} from "lucide-react";

export default function PostGigWizard() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const { analyze } = useModeration();

  // --- ZUSTAND STORE ---
  const store = useGigFormStore();
  const { listingType, marketType, itemCondition, category, title, description, githubLink, price, securityDeposit, mode, location, deadlineDate, deadlineTime } = store;

  const [step, setStep] = useState(1);
  // --- LOCAL STATE ---
  const [user, setUser] = useState<any | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any | null>(null);

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [minDate, setMinDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  useEffect(() => {
    setMinDate(new Date().toISOString().split("T")[0]);
  }, []);

  // --- AUTH CHECK ---
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user ?? null;
      setUser(u);
      if (u) {
        const { data: dbUser } = await supabase.from("users").select("upi_id").eq("id", u.id).maybeSingle();
        setUserProfile(dbUser);
      }
      setUserLoading(false);
      if (!u) router.push("/login");
    })();
  }, [router, supabase]);

  // --- IMAGE HANDLERS ---
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    if (images.length + files.length > 5) {
      toast.error("Max 5 images allowed.");
      return;
    }
    const newFiles = Array.from(files).filter((f) => {
      if (listingType === "HUSTLE") {
        return f.type.startsWith("image/") || f.type === "application/pdf" || f.type.includes("word") || f.type.includes("document");
      }
      return f.type.startsWith("image/");
    });
    const newPreviews = newFiles.map(file => URL.createObjectURL(file));
    setImages(prev => [...prev, ...newFiles]);
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // --- VALIDATION PER STEP ---
  const validateStep1 = () => {
    if (!listingType) return "Please select a listing type.";
    return null;
  };

  const validateStep2 = () => {
    if (!category) return "Please select a category.";
    if (!title.trim()) return "Please enter a title.";
    if (title.length > 80) return "Title is too long (max 80 chars).";
    if (!description.trim()) return "Please describe the item/task.";
    if (description.length > 500) return "Description is too long (max 500 chars).";
    if (listingType === "MARKET" && marketType !== "REQUEST" && images.length === 0) {
      return "Please upload at least one image.";
    }
    return null;
  };

  const validateStep3 = () => {
    const p = Number(price);
    if (Number.isNaN(p) || p < 1) return "Please enter a valid price/budget.";
    if (listingType === "HUSTLE") {
      if (p < 20) return "Minimum budget is ₹20.";
      if (mode !== "Online" && !location.trim()) return "Location is required for offline tasks.";
    }
    if (listingType === "MARKET" && marketType === "RENT") {
      if (!securityDeposit || Number(securityDeposit) < 0) return "Valid security deposit required.";
    }
    if (deadlineDate) {
      const localDeadline = new Date(`${deadlineDate}T${deadlineTime || "23:59:59"}`);
      if (isNaN(localDeadline.getTime())) return "Invalid deadline date/time.";
      if (localDeadline.getTime() <= Date.now() - 60000) return "Deadline must be in the future.";
    }
    return null;
  };

  // --- NAVIGATION ---
  const nextStep = () => {
    setError("");
    let err = null;
    if (step === 1) err = validateStep1();
    if (step === 2) err = validateStep2();
    if (err) return setError(err);
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevStep = () => {
    setError("");
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // --- FINAL SUBMIT ---
  const handleSubmit = async () => {
    setError("");
    const err = validateStep3();
    if (err) return setError(err);

    setLoading(true);
    const textToAnalyze = `${title} ${description}`;
    const aiResult = await analyze(textToAnalyze, 'POST');
    if (!aiResult.isSafe) {
      setLoading(false);
      return setError(`Safety Alert: ${aiResult.reason || "Content flagged by AI."}`);
    }

    if (!user) return setError("Session expired. Please login again.");
    if (!userProfile?.upi_id) {
      setLoading(false);
      return setError("Please add your UPI ID in your profile before posting.");
    }

    try {
      const uploadedPaths: string[] = [];
      if (images.length > 0) {
        await Promise.all(
          images.map(async (file) => {
            const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '');
            const path = `${user.id}/${Date.now()}_${fileName}`;
            const { error: uploadError } = await supabase.storage.from("gig-images").upload(path, file, { cacheControl: "3600", upsert: false });
            if (uploadError) throw uploadError;
            uploadedPaths.push(path);
          })
        );
      }

      const deadlineISO = deadlineDate ? new Date(`${deadlineDate}T${deadlineTime || "23:59:59"}`).toISOString() : null;

      const payload = {
        listing_type: listingType || "HUSTLE",
        category,
        market_type: listingType === "MARKET" ? marketType : null,
        item_condition: listingType === "MARKET" ? itemCondition : null,
        poster_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        security_deposit: (listingType === "MARKET" && marketType === "RENT") ? Number(securityDeposit) : 0,
        is_physical: listingType === "HUSTLE" ? mode !== "Online" : true,
        location: (listingType === "MARKET" || mode !== "Online") ? (location.trim() || "Campus") : null,
        images: uploadedPaths,
        deadline: listingType === "HUSTLE" ? deadlineISO : null,
        github_link: (listingType === "HUSTLE" && (category === "Tech & Engineering" || category === "Academics & Projects") && githubLink.trim()) ? githubLink.trim() : null,
        status: "open",
        created_at: new Date().toISOString()
      };

      const { data: newGig, error: dbError } = await supabase.from("gigs").insert(payload).select('id').single();
      if (dbError) throw dbError;

      // --- ASYNC TELEGRAM BROADCAST PING ---
      if (newGig?.id && payload.category) {
        fetch("/api/telegram/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gigId: newGig.id,
            category: payload.category,
            title: payload.title,
            price: payload.price,
            posterId: payload.poster_id
          })
        }).catch(err => console.error("Telegram broadcast failed to trigger:", err));
      }
      // -------------------------------------

      store.reset(); // clear drafts
      toast.success(listingType === 'MARKET' ? "Item listed! Your listing is now live." : "Hustle posted! Your gig is now live.");
      router.push("/dashboard");

    } catch (err: any) {
      console.error("Submission Error:", err);
      setError(err?.message || "Something went wrong.");
      setLoading(false);
    }
  };

  // --- RENDERERS ---
  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0B11]">
        <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
      </div>
    );
  }

  // Categories helper
  const availableCategories = listingType === "HUSTLE" ? [
    "Tech & Engineering", "Design & Creative", "Science & Medical", "Law & Humanities", "Commerce & Finance", "Academics & Projects", "Errands & Manual Labor", "Writing & Content", "Tutoring", "Other"
  ] : [
    "Electronics", "Furniture", "Books & Study Material", "Vehicles", "Fashion & Clothing", "Appliances", "Accessories", "Sports & Fitness", "Subscriptions & Tickets", "Other"
  ];

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white pt-12 pb-24 px-4 selection:bg-brand-purple flex justify-center backdrop-blur-3xl relative overflow-hidden">

      {/* BACKGROUND BLOBS */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[800px] h-[800px] bg-brand-purple/10 blur-[150px] rounded-full opacity-30 will-change-transform transform translate-z-0"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-brand-blue/10 blur-[150px] rounded-full opacity-30 will-change-transform transform translate-z-0"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10 space-y-8 animate-in fade-in duration-500">

        {/* PROGRESS HEADER */}
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => step > 1 ? prevStep() : router.back()} className="text-white/60 hover:text-white transition w-10 h-10 flex items-center justify-center rounded-full bg-white/10 border border-white/5">
            <ChevronLeft size={20} />
          </button>

          <div className="flex flex-col items-center">
            <div className="flex gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-1.5 w-12 rounded-full transition-colors duration-300 ${i === step ? 'bg-brand-purple shadow-[0_0_10px_rgba(136,37,245,0.5)]' : i < step ? 'bg-white' : 'bg-white/10'}`} />
              ))}
            </div>
            {step > 1 && (
              <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-brand-purple">
                {listingType === 'HUSTLE' ? 'HUSTLE' : `MARKET • ${marketType || ''}`}
              </span>
            )}
          </div>

          <div className="w-10 h-10 flex items-center justify-center">
            {step === 3 ? <span className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">Final</span> : <span className="text-[10px] uppercase text-white/60">Step {step}</span>}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium animate-in slide-in-from-top-4">
            {error}
          </div>
        )}

        {/* STEP 1: TYPE SELECTION */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in-50 slide-in-from-right-8 duration-300">
            <div className="text-center space-y-2 mb-10">
              <h1 className="text-4xl font-black tracking-tight">What do you want to do?</h1>
              <p className="text-white/50 text-sm">Select the type of listing you want to create.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={() => { store.setField('listingType', 'HUSTLE'); store.setField('category', ''); }} className={`group relative p-8 rounded-[32px] border transition-all text-left overflow-hidden ${listingType === 'HUSTLE' ? 'border-brand-purple bg-brand-purple/10 shadow-[0_0_30px_rgba(136,37,245,0.15)] ring-1 ring-brand-purple/50' : 'border-white/5 bg-[#121217] hover:bg-[#1A1A24] hover:border-white/10'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all ${listingType === 'HUSTLE' ? 'bg-brand-purple text-white shadow-lg' : 'bg-white/10 text-white/50 group-hover:bg-white/10 group-hover:text-white'}`}>
                  <BriefcaseIcon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Hustle</h2>
                <p className="text-sm text-white/50 leading-relaxed">Request services or chores from peers on campus.</p>
              </button>

              <button onClick={() => { store.setField('listingType', 'MARKET'); store.setField('category', ''); }} className={`group relative p-8 rounded-[32px] border transition-all text-left overflow-hidden ${listingType === 'MARKET' ? 'border-brand-pink bg-brand-pink/10 shadow-[0_0_30px_rgba(236,72,153,0.15)] ring-1 ring-brand-pink/50' : 'border-white/5 bg-[#121217] hover:bg-[#1A1A24] hover:border-white/10'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all ${listingType === 'MARKET' ? 'bg-brand-pink text-white shadow-lg' : 'bg-white/10 text-white/50 group-hover:bg-white/10 group-hover:text-white'}`}>
                  <ShoppingBagIcon className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Marketplace</h2>
                <p className="text-sm text-white/50 leading-relaxed">Buy, sell, or rent items efficiently.</p>
              </button>
            </div >

            {listingType === "MARKET" && (
              <div className="pt-8 border-t border-white/5 animate-in slide-in-from-bottom-4">
                <label className="text-xs font-bold uppercase tracking-widest text-white/60 mb-4 block text-center">Market Sub-Type</label>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    { id: "SELL", label: "Sell Item", c: "border-brand-pink" },
                    { id: "RENT", label: "Rent Out", c: "border-brand-purple" },
                    { id: "REQUEST", label: "Request Item", c: "border-blue-400" }
                  ].map(t => (
                    <button key={t.id} onClick={() => store.setField('marketType', t.id as any)} className={`px-6 py-3 rounded-full text-sm font-bold border transition-all ${marketType === t.id ? `${t.c} bg-white/10` : 'border-white/10 text-white/50 hover:border-white/20 hover:text-white'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div >
            )
            }
          </div >
        )}

        {/* STEP 2: DETAILS */}
        {
          step === 2 && (
            <div className="space-y-8 animate-in fade-in-50 slide-in-from-right-8 duration-300">
              <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-black">The Details</h1>
                <p className="text-white/50 text-sm">
                  {listingType === 'HUSTLE'
                    ? 'Tell exactly what task you need done.'
                    : marketType === 'SELL' ? 'Describe the item you are selling.'
                      : marketType === 'RENT' ? 'Describe the item you are renting out.'
                        : marketType === 'REQUEST' ? 'Describe the item you are looking for.'
                          : 'Tell exactly what you need.'}
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map((cat) => (
                      <button key={cat} onClick={() => store.setField('category', cat)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${category === cat ? "bg-white text-black shadow-lg" : "bg-[#1A1A24] border border-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Title</label>
                  <input value={title} onChange={(e) => store.setField('title', e.target.value)} maxLength={80} placeholder={
                    listingType === 'HUSTLE' ? "e.g. Need help making an project" :
                      marketType === 'SELL' ? "e.g. iPad Pro (M1) 128GB - Like New" :
                        marketType === 'RENT' ? "e.g. Scientific Calculator for Rent" :
                          marketType === 'REQUEST' ? "e.g. Looking to buy/borrow an umbrella" :
                            "e.g. Needed quickly"
                  } className="w-full bg-[#1A1A24] border border-white/10 rounded-2xl p-5 text-lg text-white outline-none focus:border-brand-purple/50 transition-all shadow-inner" />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Description</label>
                  <textarea value={description} onChange={(e) => store.setField('description', e.target.value)} maxLength={500} placeholder="Clear details..." className="w-full bg-[#1A1A24] border border-white/10 rounded-2xl p-5 text-base text-white outline-none focus:border-brand-purple/50 transition-all resize-none h-32 shadow-inner" />
                </div>

                {listingType === "HUSTLE" && (category === "Tech & Engineering" || category === "Academics & Projects") && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">GitHub <span className="text-[10px] text-white/60 normal-case">(Optional)</span></label>
                    <input type="url" value={githubLink} onChange={(e) => store.setField('githubLink', e.target.value)} placeholder="https://github.com/..." className="w-full bg-[#1A1A24] border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-brand-purple/50" />
                  </div>
                )}

                {listingType === "MARKET" && (
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Item Condition</label>
                    <div className="flex flex-wrap gap-2">
                      {[{ id: "NEW", label: "New" }, { id: "LIKE_NEW", label: "Like New" }, { id: "GOOD", label: "Good" }, { id: "FAIR", label: "Fair" }].map(c => (
                        <button key={c.id} onClick={() => store.setField('itemCondition', c.id as any)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${itemCondition === c.id ? "bg-white text-black" : "bg-[#1A1A24] border border-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
                }

                {/* IMAGES UPLOAD (In Step 2) */}
                <div className="space-y-3 pt-6 border-t border-white/5">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-widest flex justify-between items-center">
                    <span>Media & Attachments</span>
                    <span className="text-white/60 normal-case">{images.length}/5 max</span>
                  </label>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    <input ref={fileInputRef} type="file" accept={listingType === 'HUSTLE' ? "image/*, .pdf, .doc, .docx" : "image/*"} multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFiles(e.target.files)} />

                    <button onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/10 hover:border-white/30 hover:bg-white/10 flex flex-col items-center justify-center shrink-0 transition-all group">
                      <ImageIcon className="w-6 h-6 text-white/60 group-hover:text-white mb-2" />
                      <span className="text-[10px] text-white/60 group-hover:text-white font-bold uppercase tracking-widest">Gallery</span>
                    </button>

                    <button onClick={() => cameraInputRef.current?.click()} className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/10 hover:border-brand-purple/40 hover:bg-brand-purple/10 flex flex-col items-center justify-center shrink-0 transition-all group">
                      <Camera className="w-6 h-6 text-white/60 group-hover:text-brand-purple mb-2" />
                      <span className="text-[10px] text-white/60 group-hover:text-brand-purple font-bold uppercase tracking-widest">Camera</span>
                    </button>

                    {imagePreviews.map((src, i) => {
                      const isImage = images[i]?.type.startsWith("image/");
                      return (
                        <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden border border-white/10 shrink-0 group bg-[#1A1A24]">
                          {isImage ? (
                            <Image src={src} alt="Preview" fill className="object-cover" />
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full p-2 text-center text-brand-purple">
                              <FileText size={24} className="mb-1 opacity-80" />
                              <span className="text-[8px] text-white/50 leading-tight truncate w-full">{images[i]?.name}</span>
                            </div>
                          )}
                          <button onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-black/80 backdrop-blur-md p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-black scale-75 border border-white/10"><X size={12} /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div >
            </div >
          )}

        {/* STEP 3: LOGISTICS */}
        {
          step === 3 && (
            <div className="space-y-8 animate-in fade-in-50 slide-in-from-right-8 duration-300">
              <div className="space-y-2 mb-8">
                <h1 className="text-3xl font-black">Logistics & Price</h1>
                <p className="text-white/50 text-sm">Where, when, and how much.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">
                    {listingType === "MARKET" ? (marketType === "RENT" ? "Rental Fee (Per Day)" : marketType === "REQUEST" ? "My Budget" : "Price") : "Budget"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl text-white/60 font-mono">₹</span>
                    <input type="number" inputMode="decimal" value={price} onChange={(e) => store.setField('price', e.target.value)} placeholder="500" className="w-full bg-[#1A1A24] border border-white/10 rounded-2xl py-5 pl-12 pr-5 text-4xl font-black text-white outline-none focus:border-brand-purple/50 transition-all shadow-inner tracking-tighter" />
                  </div>
                </div>

                {listingType === "MARKET" && marketType === "RENT" && (
                  <div className="space-y-3 bg-brand-purple/5 p-4 rounded-2xl border border-brand-purple/20">
                    <label className="flex items-center justify-between text-xs font-bold text-brand-purple uppercase tracking-widest"><span>Security Deposit</span> <span className="normal-case opacity-60">Refundable</span></label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-purple/50 font-mono">₹</span>
                      <input type="number" inputMode="decimal" value={securityDeposit} onChange={(e) => store.setField('securityDeposit', e.target.value)} placeholder="2000" className="w-full bg-black/20 border border-brand-purple/20 rounded-xl py-3 pl-10 pr-4 text-xl font-bold text-brand-purple outline-none focus:border-brand-purple/50 transition-all font-mono" />
                    </div>
                  </div>
                )}

                {listingType === "HUSTLE" && (
                  <div className="space-y-3 border-t border-white/5 pt-6">
                    <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Format</label>
                    <div className="flex flex-wrap gap-2">
                      {["Online", "Offline (Same Campus)", "Outside Campus"].map((m) => (
                        <button key={m} onClick={() => store.setField('mode', m)} className={`px-4 py-3 rounded-xl text-sm font-bold transition-all ${mode === m ? "bg-white text-black shadow-lg" : "bg-[#1A1A24] border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"}`}>
                          {m.includes("Offline") ? "On Campus" : m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-white/60 uppercase tracking-widest">Location</label>
                  <div className="relative">
                    <MapPin size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 z-10" />
                    <input
                      className={`w-full bg-[#1A1A24] border border-white/10 rounded-2xl py-5 pl-12 pr-12 text-lg text-white placeholder:text-white/60 focus:outline-none focus:border-brand-purple/50 transition-all shadow-inner ${listingType === "HUSTLE" && mode === "Online" ? "opacity-30 cursor-not-allowed" : ""}`}
                      value={location}
                      onChange={(e) => {
                        store.setField('location', e.target.value);
                        setShowLocationSuggestions(true);
                        setError("");
                      }}
                      onFocus={() => setShowLocationSuggestions(true)}
                      disabled={listingType === "HUSTLE" && mode === "Online"}
                      placeholder={listingType === "HUSTLE" && mode === "Online" ? "Remote (Online)" : "Search campus hotspot or type custom..."}
                    />

                    {/* PIN LOCATION BUTTON */}
                    {!(listingType === "HUSTLE" && mode === "Online") && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!navigator.geolocation) return toast.error("Geolocation not supported");

                          store.setField('location', "Locating...");
                          navigator.geolocation.getCurrentPosition(
                            async (pos) => {
                              const { latitude, longitude } = pos.coords;
                              try {
                                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                                const data = await response.json();
                                if (data && data.display_name) {
                                  const addr = data.address;
                                  const shortName = addr.amenity || addr.building || addr.road || addr.suburb || data.display_name.split(',')[0];
                                  const secondary = addr.city || addr.state_district || "";
                                  store.setField('location', `${shortName}${secondary ? `, ${secondary}` : ''}`);
                                } else {
                                  store.setField('location', `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                                }
                              } catch (e) {
                                store.setField('location', `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                              }
                              setShowLocationSuggestions(false);
                            },
                            (err) => {
                              toast.error("Location access denied. Please enable permissions.");
                              store.setField('location', "");
                            }
                          );
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-brand-purple transition-colors z-10 p-1"
                        title="Pin My Location"
                      >
                        <MapPin className="w-5 h-5" />
                      </button>
                    )}

                    {/* Autocomplete Dropdown */}
                    {showLocationSuggestions && location.length > 0 && !(listingType === "HUSTLE" && mode === "Online") && (
                      <div className="absolute top-[72px] left-0 w-full bg-[#1A1A24] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {[
                          "Tech Park Java", "Tech Park Main Entrance",
                          "Central Library Gate 1", "Central Library Reading Room",
                          "Main Building Allotment Section", "Main Building Clock Tower",
                          "Hostel Block A Lobby", "Hostel Block B Mess", "Girls Hostel Gate",
                          "Food Court", "Nescafe Kiosk", "Dental College", "Medical College"
                        ]
                          .filter(s => s.toLowerCase().includes(location.toLowerCase()) && s !== location)
                          .map((match) => (
                            <button
                              key={match}
                              type="button"
                              onClick={() => { store.setField('location', match); setShowLocationSuggestions(false); }}
                              className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
                            >
                              <MapPin size={14} className="text-white/60" /> {match}
                            </button>
                          ))}
                        <div className="px-4 py-2 text-[10px] text-white/50 border-t border-white/5 bg-black/20">
                          Press Enter to use "{location}"
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Pick Chips */}
                  {!(listingType === "HUSTLE" && mode === "Online") && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {["Tech Park Java", "Central Library", "Clock Tower", "Hostel Block A", "Food Court"].map((spot) => (
                        <button
                          key={spot}
                          type="button"
                          onClick={() => { store.setField('location', spot); setShowLocationSuggestions(false); }}
                          className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-white/60 hover:bg-brand-purple/20 hover:border-brand-purple/50 hover:text-white transition-all"
                        >
                          {spot}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Click outside overlay */}
                  {showLocationSuggestions && (
                    <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowLocationSuggestions(false)} />
                  )}
                </div>

                {listingType === "HUSTLE" && (
                  <div className="pr-1 pt-4 grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest">Date</label>
                      <input type="date" style={{ colorScheme: "dark" }} value={deadlineDate} min={minDate} onChange={(e) => store.setField('deadlineDate', e.target.value)} className="w-full bg-[#1A1A24] border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-white/40 transition-all" />
                    </div>
                    <div className="space-y-3">
                      <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest">Time</label>
                      <input type="time" style={{ colorScheme: "dark" }} value={deadlineTime} onChange={(e) => store.setField('deadlineTime', e.target.value)} className="w-full bg-[#1A1A24] border border-white/10 rounded-xl p-4 text-sm text-white outline-none focus:border-white/40 transition-all" />
                    </div>
                  </div>
                )}
              </div>
            </div >
          )
        }

        {/* BOTTOM ACTION BAR */}
        <div className="pt-8 flex justify-end">
          {step < 3 ? (
            <button onClick={nextStep} className="w-full md:w-auto px-10 py-5 rounded-2xl bg-white hover:bg-zinc-200 text-black font-black text-lg transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] flex justify-center items-center gap-2 active:scale-95 group">
              Continue <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className={`w-full px-10 py-5 rounded-2xl font-black text-lg transition-all flex justify-center items-center gap-2 active:scale-95 shadow-[0_0_30px_rgba(136,37,245,0.3)] ${loading ? 'bg-zinc-800 text-white/50' : 'bg-brand-purple hover:bg-[#7D5FFF] text-white group'}`}>
              {loading ? <Loader2 className="animate-spin w-6 h-6" /> : <><CheckCircle size={22} /> {
                listingType === 'HUSTLE' ? 'Post Hustle' :
                  marketType === 'SELL' ? 'List Item for Sale' :
                    marketType === 'RENT' ? 'List Item for Rent' :
                      marketType === 'REQUEST' ? 'Post Request' :
                        'Post Listing'
              }</>}
            </button>
          )}
        </div >

      </div >
    </div >
  );
}
