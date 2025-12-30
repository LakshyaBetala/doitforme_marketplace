"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { 
  ArrowLeft, 
  Clock, 
  Send, 
  MessageSquare, 
  Loader2, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";

export default function ApplyPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [gig, setGig] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  // Form State
  const [message, setMessage] = useState("");
  const [eta, setEta] = useState("Within 24 hours");

  useEffect(() => {
    if (!id) {
      setError("Invalid Gig ID");
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        // 1. Get Auth User
        const { data: userData } = await supabase.auth.getUser();
        const u = userData?.user ?? null;
        setUser(u);

        if (!u) {
          return router.push(`/login?next=/gig/${id}/apply`);
        }

        // --- FIX 1: AUTO-CREATE PUBLIC USER IF MISSING ---
        // This solves the "Foreign Key Constraint" error
        const { data: publicUser } = await supabase
          .from("users")
          .select("id")
          .eq("id", u.id)
          .single();

        if (!publicUser) {
          console.log("User missing from public DB. Attempting auto-fix...");
          await fetch("/api/auth/create-user", { method: "POST" });
        }
        // ------------------------------------------------

        // 2. Fetch Gig (Using * to avoid column name errors)
        const { data: gigData, error: gigError } = await supabase
          .from("gigs")
          .select("*") 
          .eq("id", id)
          .single();

        if (gigError) throw gigError;
        if (!gigData) throw new Error("Gig data is null");

        setGig(gigData);

        // 3. Block Owner from Applying
        // Check both 'poster_id' and 'user_id' to be safe against schema changes
        const posterId = gigData.poster_id || gigData.user_id;
        if (posterId === u.id) {
          return; // Will be handled by render logic
        }

        // 4. Check Existing Application
        const { data: existingApp } = await supabase
          .from("applications")
          .select("*")
          .eq("gig_id", id)
          .eq("worker_id", u.id)
          .maybeSingle();

        if (existingApp) setAlreadyApplied(true);

      } catch (err: any) {
        console.error("Load Error:", err);
        setError(err.message || "Failed to load gig data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, router, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) return router.push("/login");
    if (!gig) return setError("Gig not found");
    
    // Safety check for owner
    const posterId = gig.poster_id || gig.user_id;
    if (posterId === user.id) return setError("You cannot apply to your own gig.");
    if (alreadyApplied) return setError("You already applied.");

    if (!message.trim()) return setError("Message is required");
    if (message.length > 300) return setError("Message must be ≤ 300 characters");

    setSubmitting(true);

    try {
      const { error: insertError } = await supabase.from("applications").insert({
        gig_id: id,
        worker_id: user.id,
        pitch: message.trim(),
        status: "applied",
      });

      if (insertError) throw insertError;

      router.push(`/gig/${id}`);
    } catch (err: any) {
      console.error("Submit Error:", err);
      // Show friendlier error if it's still the foreign key issue
      if (err?.message?.includes("foreign key")) {
         setError("Profile error: Please log out and sign up again to fix your account.");
      } else {
         setError(err?.message || "Failed to apply");
      }
      setSubmitting(false);
    }
  };

  // --- LOADING STATE ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
          <p className="text-white/50 text-sm animate-pulse">Loading Gig...</p>
        </div>
      </div>
    );
  }

  // --- OWNER / APPLIED STATE ---
  const posterId = gig?.poster_id || gig?.user_id;
  if (gig && (posterId === user?.id || alreadyApplied)) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#121217] border border-white/10 rounded-3xl p-8 text-center relative overflow-hidden">
          <div className="absolute top-[-50%] left-[-50%] w-full h-full bg-brand-purple/20 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
              {alreadyApplied ? <CheckCircle2 className="w-10 h-10 text-brand-green" /> : <AlertCircle className="w-10 h-10 text-brand-pink" />}
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              {alreadyApplied ? "Application Sent!" : "This is your gig"}
            </h2>
            <p className="text-white/60 mb-8 text-lg leading-relaxed">
              {alreadyApplied 
                ? "Good luck! You'll be notified if the poster accepts your request." 
                : "You cannot apply to a gig you posted yourself."}
            </p>
            <Link href="/dashboard" className="block w-full py-4 bg-white text-black rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-white/10">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white flex items-center justify-center p-4 md:p-8 relative overflow-hidden selection:bg-brand-purple selection:text-white">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-brand-purple/20 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-blue/10 blur-[150px] rounded-full"></div>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        
        {/* Back Button */}
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-8 group"
        >
          <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Cancel Application</span>
        </button>

        <div className="bg-[#121217]/90 backdrop-blur-xl border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
          
          {/* Subtle Border Gradient */}
          <div className="absolute inset-0 rounded-[32px] border border-white/5 pointer-events-none"></div>

          {/* Header */}
          <div className="mb-8 border-b border-white/10 pb-8">
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">
              Apply for Gig
            </h1>
            <p className="text-white/60 text-lg">
              Pitch yourself for <span className="text-white font-bold">"{gig?.title}"</span>
            </p>
            <div className="mt-4 inline-flex items-center px-4 py-1.5 rounded-full bg-brand-purple/10 border border-brand-purple/20 text-brand-purple text-sm font-bold uppercase tracking-wider">
              Budget: ₹{gig?.price}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Message Input */}
            <div className="space-y-3 group">
              <label className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2 group-focus-within:text-brand-blue transition-colors">
                <MessageSquare className="w-4 h-4" /> Why you?
              </label>
              <textarea
                className="w-full bg-black/20 border border-white/10 rounded-2xl p-5 text-white placeholder:text-white/20 focus:outline-none focus:border-brand-blue/50 focus:bg-brand-blue/5 transition-all min-h-[160px] resize-none leading-relaxed text-lg shadow-inner"
                value={message}
                onChange={(e) => { setMessage(e.target.value); setError(null); }}
                maxLength={300}
                placeholder="I have experience with this subject and can deliver by..."
                required
                autoFocus
              />
              <div className="flex justify-end">
                <span className={`text-xs ${message.length > 250 ? "text-brand-pink" : "text-white/30"}`}>
                  {message.length}/300
                </span>
              </div>
            </div>

            {/* ETA Input */}
            <div className="space-y-3 group">
              <label className="text-sm font-bold text-white/70 uppercase tracking-wider flex items-center gap-2 group-focus-within:text-brand-purple transition-colors">
                <Clock className="w-4 h-4" /> When can you finish?
              </label>
              <div className="relative">
                <select
                  className="w-full bg-black/20 border border-white/10 rounded-2xl p-5 text-white focus:outline-none focus:border-brand-purple/50 focus:bg-brand-purple/5 transition-all text-lg appearance-none cursor-pointer hover:bg-white/5 shadow-inner"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                >
                  <option className="bg-[#121217]">Within 24 hours</option>
                  <option className="bg-[#121217]">1–2 days</option>
                  <option className="bg-[#121217]">3–5 days</option>
                  <option className="bg-[#121217]">More than 5 days</option>
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-white/50">
                  ▼
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full relative group overflow-hidden rounded-2xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_40px_rgba(136,37,245,0.3)] hover:shadow-[0_0_60px_rgba(136,37,245,0.5)] transition-shadow duration-500"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-blue group-hover:opacity-100 transition-opacity duration-300 animate-gradient-xy"></div>
              <div className="relative bg-[#1a1a24] group-hover:bg-transparent transition-colors rounded-[15px] p-5 flex items-center justify-center gap-3">
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                    <span className="font-bold text-xl text-white tracking-wide">Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 text-white group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    <span className="font-bold text-xl text-white tracking-wide">Submit Application</span>
                  </>
                )}
              </div>
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}