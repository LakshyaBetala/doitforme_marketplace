"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { containsSensitiveInfo } from "@/lib/moderation";
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
  UploadCloud,
  Briefcase as BriefcaseIcon,
  ShoppingBag as ShoppingBagIcon,
  ShieldCheck
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
  const [securityDeposit, setSecurityDeposit] = useState("");
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

  // --- NEW STATES FOR CTO PLAN ---
  const [listingType, setListingType] = useState<"HUSTLE" | "MARKET" | null>(null);
  const [marketType, setMarketType] = useState<"SELL" | "RENT">("SELL");
  const [itemCondition, setItemCondition] = useState<"NEW" | "LIKE_NEW" | "GOOD" | "FAIR">("GOOD");

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
    if (!title.trim()) return "Please enter a title.";
    if (title.length > 80) return "Title is too long (max 80 chars).";
    if (!description.trim()) return "Please describe the item/task.";
    if (description.length > 500) return "Description is too long (max 500 chars).";
    const p = Number(price);
    if (Number.isNaN(p) || p < 1) return "Please enter a valid price/budget.";

    // Specific validation for HUSTLE
    if (listingType === "HUSTLE") {
      if (p < 20) return "Minimum budget is ₹20.";
      if (mode !== "Online" && !location.trim()) return "Location is required for offline tasks.";
    }

    // Specific validation for MARKET
    if (listingType === "MARKET") {
      if (images.length === 0) return "Please upload at least one image for your item.";
      if (marketType === "RENT" && (!securityDeposit || Number(securityDeposit) < 0)) {
        return "Please enter a valid security deposit (can be 0).";
      }
    }

    // Content Moderation
    const titleCheck = containsSensitiveInfo(title);
    if (titleCheck.detected) return `Title Violation: ${titleCheck.reason}`;

    const descCheck = containsSensitiveInfo(description);
    if (descCheck.detected) return `Description Violation: ${descCheck.reason}`;

    // Deadline validation (Corrected for Local Timezone & Next Hour issue)
    if (deadlineDate) {
      // Build date object from user local input
      const localDeadline = new Date(`${deadlineDate}T${deadlineTime || "23:59:59"}`);

      if (isNaN(localDeadline.getTime())) return "Invalid deadline date/time.";

      // Use a 1-minute buffer to prevent "past time" errors during the submission process
      if (localDeadline.getTime() <= Date.now() - 60000) {
        return "Deadline must be in the future.";
      }
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
      // Fix: Construct the ISO string from the local time components
      const deadlineISO = deadlineDate
        ? new Date(`${deadlineDate}T${deadlineTime || "23:59:59"}`).toISOString()
        : null;

      const payload = {
        listing_type: listingType || "HUSTLE", // Fallback for safety
        market_type: listingType === "MARKET" ? marketType : null,
        item_condition: listingType === "MARKET" ? itemCondition : null,
        poster_id: user.id,
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        security_deposit: (listingType === "MARKET" && marketType === "RENT") ? Number(securityDeposit) : 0,
        is_physical: listingType === "HUSTLE" ? mode !== "Online" : true, // Market items are physical by default?
        location: (listingType === "MARKET" || mode !== "Online") ? (location.trim() || "Campus") : null, // Default location for market items
        images: uploadedPaths,
        deadline: listingType === "HUSTLE" ? deadlineISO : null, // Only for hustles
        status: "open",
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

  // --- RENDER SELECTION SCREEN ---
  if (!listingType) {
    return (
      <div className="min-h-screen bg-[#0B0B11] text-white flex items-center justify-center p-6 selection:bg-brand-purple">
        <div className="max-w-2xl w-full space-y-12">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-light tracking-tight text-white/90">
              Create a new listing
            </h1>
            <p className="text-white/40 text-sm font-light">Select the type of post you want to create.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OPTION 1: HIRE (HUSTLE) */}
            <button
              onClick={() => setListingType("HUSTLE")}
              className="group relative p-8 rounded-3xl border border-white/5 bg-[#121217] hover:border-white/10 hover:bg-[#1A1A24] transition-all text-left"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-white/60 group-hover:text-white group-hover:scale-110 transition-all">
                <BriefcaseIcon className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-medium mb-2 text-white/90">Hire a Student</h2>
              <p className="text-sm text-white/40 leading-relaxed">
                Post a task, gig, or errand. Get it done by peers on campus.
              </p>
            </button>

            {/* OPTION 2: SELL / RENT (MARKET) */}
            <button
              onClick={() => setListingType("MARKET")}
              className="group relative p-8 rounded-3xl border border-white/5 bg-[#121217] hover:border-white/10 hover:bg-[#1A1A24] transition-all text-left"
            >
              <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-white/60 group-hover:text-white group-hover:scale-110 transition-all">
                <ShoppingBagIcon className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-medium mb-2 text-white/90">Sell or Rent</h2>
              <p className="text-sm text-white/40 leading-relaxed">
                List items for sale or rent to other students on campus.
              </p>
            </button>
          </div>

          <div className="text-center">
            <button onClick={() => router.back()} className="text-xs text-white/30 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN FORM RENDER ---
  return (
    <div className="min-h-screen bg-[#0B0B11] text-white flex items-center justify-center p-4 py-12 selection:bg-brand-purple">
      <div className="w-full max-w-3xl relative z-10">

        {/* NAV */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => setListingType(null)}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="text-xs font-mono text-white/20 uppercase tracking-widest">
            {listingType} MODE
          </div>
        </div>

        {/* HEADER */}
        <div className="mb-10">
          <h1 className="text-3xl font-light tracking-tight mb-2">
            {listingType === "MARKET" ? "List an Item" : "Post a Request"}
          </h1>
          <p className="text-white/40 text-sm">
            {listingType === "MARKET" ? "Sell or rent out your unused items." : "Get help with your tasks quickly."}
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-12">

          {/* MARKET TOGGLE */}
          {listingType === "MARKET" && (
            <div className="flex gap-4 border-b border-white/5 pb-8">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${marketType === 'SELL' ? 'border-brand-pink' : 'border-white/20 group-hover:border-white/40'}`}>
                  {marketType === 'SELL' && <div className="w-2 h-2 rounded-full bg-brand-pink" />}
                </div>
                <input type="radio" name="marketType" className="hidden" onClick={() => setMarketType('SELL')} />
                <span className={`text-sm ${marketType === 'SELL' ? 'text-white' : 'text-white/40'}`}>Sell Item</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${marketType === 'RENT' ? 'border-brand-orange' : 'border-white/20 group-hover:border-white/40'}`}>
                  {marketType === 'RENT' && <div className="w-2 h-2 rounded-full bg-brand-orange" />}
                </div>
                <input type="radio" name="marketType" className="hidden" onClick={() => setMarketType('RENT')} />
                <span className={`text-sm ${marketType === 'RENT' ? 'text-white' : 'text-white/40'}`}>Rent Out</span>
              </label>
            </div>
          )}

          {/* SECTION 1: BASICS */}
          <div className="space-y-6">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Title</label>
              <input
                className="w-full bg-transparent border-b border-white/10 py-4 text-xl md:text-2xl text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-colors"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                maxLength={80}
                placeholder={listingType === "MARKET" ? "e.g. Engineering Mathematics Book" : "e.g. Need help moving boxes"}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Description</label>
              <textarea
                className="w-full bg-transparent border-b border-white/10 py-4 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-colors min-h-[100px] resize-none leading-relaxed"
                value={description}
                onChange={(e) => { setDescription(e.target.value); setError(""); }}
                maxLength={500}
                placeholder="Provide clear details about what you need or what you're listing..."
              />
            </div>

            {/* MARKET: Condition */}
            {listingType === "MARKET" && (
              <div className="space-y-3 pt-4">
                <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Condition</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "NEW", label: "New" },
                    { id: "LIKE_NEW", label: "Like New" },
                    { id: "GOOD", label: "Good" },
                    { id: "FAIR", label: "Fair" }
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setItemCondition(c.id as any)}
                      className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${itemCondition === c.id
                        ? "bg-white text-black"
                        : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: LOGISTICS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 border-t border-white/5 pt-8">
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">
                  {listingType === "MARKET" ? (marketType === "RENT" ? "Rental Fee" : "Price") : "Budget"}
                </label>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl text-white/40">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className="w-full bg-transparent border-b border-white/10 py-2 text-3xl font-light text-white placeholder:text-white/10 focus:outline-none focus:border-white/40 transition-colors"
                    value={price}
                    onChange={(e) => { setPrice(e.target.value); setError(""); }}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Security Deposit for Rent */}
              {listingType === "MARKET" && marketType === "RENT" && (
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Security Deposit</label>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl text-white/40">₹</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="w-full bg-transparent border-b border-white/10 py-2 text-xl font-light text-white placeholder:text-white/10 focus:outline-none focus:border-white/40 transition-colors"
                      value={securityDeposit}
                      onChange={(e) => { setSecurityDeposit(e.target.value); setError(""); }}
                      placeholder="0"
                    />
                  </div>
                  <p className="text-[10px] text-white/30 pt-1">Refunded upon safe return.</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Location</label>
                <input
                  className={`w-full bg-transparent border-b border-white/10 py-4 text-base text-white placeholder:text-white/20 focus:outline-none focus:border-white/40 transition-colors ${listingType === "HUSTLE" && mode === "Online" ? "opacity-30 cursor-not-allowed" : ""}`}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={listingType === "HUSTLE" && mode === "Online"}
                  placeholder={listingType === "HUSTLE" && mode === "Online" ? "Remote (Online)" : "e.g. Block A, Campus"}
                />
              </div>

              {listingType === "HUSTLE" && (
                <div className="space-y-6">
                  {/* Mode Selection */}
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Mode</label>
                    <div className="flex gap-2">
                      {["Online", "Offline (Same Campus)", "Outside Campus"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMode(m)}
                          className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${mode === m ? "border-brand-purple text-brand-purple bg-brand-purple/10" : "border-white/10 text-white/40 hover:border-white/20"}`}
                        >
                          {m.includes("Offline") ? "On Campus" : m}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Deadline Input */}
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Deadline</label>
                    <div className="grid grid-cols-2 gap-4">
                      <input
                        type="date"
                        className="bg-transparent border-b border-white/10 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-colors"
                        value={deadlineDate}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setDeadlineDate(e.target.value)}
                      />
                      <input
                        type="time"
                        className="bg-transparent border-b border-white/10 py-2 text-sm text-white focus:outline-none focus:border-white/40 transition-colors"
                        value={deadlineTime}
                        onChange={(e) => setDeadlineTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: MEDIA (Minimalist) */}
          <div className="border-t border-white/5 pt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Attachments</h3>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-brand-purple hover:text-white transition-colors cursor-pointer flex items-center gap-1">
                <UploadCloud className="w-3 h-3" /> Add Photos
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFilesChange}
            />

            <div className="flex gap-4 overflow-x-auto pb-2">
              {/* Add Button Box */}
              <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-white/20 hover:border-white/30 hover:text-white cursor-pointer transition-all shrink-0">
                <span className="text-xl font-light">+</span>
              </div>

              {imagePreviews.map((src, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/10 shrink-0 group">
                  <Image src={src} alt="Preview" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SUBMIT */}
          <div className="border-t border-white/5 pt-8 pb-20">
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            {!userProfile?.upi_id && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                Missing UPI ID. Please add it in your <Link href="/profile" className="underline">Profile</Link>.
              </div>
            )}

            <button
              disabled={loading || !userProfile?.upi_id}
              className="w-full bg-white text-black font-medium py-4 rounded-xl hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99]"
            >
              {loading ? "Publishing..." : "Publish Listing"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}