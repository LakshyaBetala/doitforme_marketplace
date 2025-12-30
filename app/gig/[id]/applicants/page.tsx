"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { 
  ArrowLeft, 
  User, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  Loader2, 
  ShieldCheck,
  Briefcase,
  Star,
  DollarSign,
  AlertCircle
} from "lucide-react";

export default function ApplicantsPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [gig, setGig] = useState<any | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      try {
        // 1. Get Current User
        const { data: userData } = await supabase.auth.getUser();
        const u = userData?.user ?? null;

        if (!u) return router.push("/login");

        // 2. Fetch Gig
        const { data: gigData, error: gigError } = await supabase
          .from("gigs")
          .select("*")
          .eq("id", id)
          .single();

        if (gigError || !gigData) throw new Error("Gig not found");
        setGig(gigData);

        // 3. Ownership Check
        const posterId = gigData.poster_id || gigData.user_id;
        if (posterId !== u.id) {
          setError("You are not allowed to view applicants for this gig.");
          setLoading(false);
          return;
        }

        // 4. Fetch Applications (LIMIT 10)
        const { data: apps, error: appsError } = await supabase
          .from("applications")
          .select(`
            *,
            worker:users (
              id,
              email,
              name,
              kyc_verified,
              rating,
              rating_count
            )
          `)
          .eq("gig_id", id)
          .order("created_at", { ascending: false })
          .limit(10); // <--- LIMIT TO 10 APPLICANTS

        if (appsError) throw appsError;
        setApplicants(apps || []);

      } catch (err: any) {
        console.error("Load Error:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, supabase, router]);

  // --- HIRE WORKER (ESCROW TRANSACTION) ---
  const handleAccept = async (workerId: string) => {
    if (!gig) return;
    
    // 1. Confirmation
    const confirmMsg = `HIRING CONFIRMATION:\n\nThis will deduct ₹${gig.price} from your wallet and hold it in escrow.\n\nDo you want to proceed?`;
    if (!confirm(confirmMsg)) return;
    
    setAssigning(workerId);

    try {
      // 2. Call the Secure API Route
      const res = await fetch("/api/gig/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          gigId: id, 
          workerId: workerId, 
          price: gig.price 
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Payment failed");
      }

      // 3. Success
      alert("Success! Funds moved to escrow. You can now chat with the worker.");
      window.location.reload();

    } catch (err: any) {
      alert("Transaction Failed: " + err.message);
      setAssigning(null);
    }
  };

  // --- RENDER ---

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex flex-col items-center justify-center text-white p-4">
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <Link href="/dashboard" className="px-6 py-3 bg-white text-black rounded-xl font-bold">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 lg:p-12 pb-24 selection:bg-brand-purple selection:text-white">
      
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-brand-purple/5 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Header */}
        <div className="mb-8">
          <Link href={`/gig/${id}`} className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Gig</span>
          </Link>
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black text-white mb-2">Manage Applications</h1>
              <p className="text-white/60">
                For <span className="text-white font-bold">"{gig?.title}"</span> • Budget: <span className="text-green-400 font-mono">₹{gig?.price}</span>
              </p>
            </div>
            {/* Applicant Counter */}
            <div className="text-right hidden sm:block">
               <span className="text-2xl font-bold text-white">{applicants.length}</span>
               <span className="text-white/40 text-sm"> / 10 Applicants</span>
            </div>
          </div>
        </div>

        {/* --- ASSIGNED WORKER VIEW --- */}
        {gig?.assigned_worker_id ? (
          <div className="bg-[#121217] border border-green-500/30 rounded-[32px] p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-green-500/5 pointer-events-none"></div>
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500 border border-green-500/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Worker Assigned!</h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">
              Funds are held in escrow. You can now chat with the worker to discuss deliverables.
            </p>
            
            {(() => {
              const hired = applicants.find(a => a.worker_id === gig.assigned_worker_id);
              return hired ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3 bg-black/40 p-4 rounded-2xl border border-white/10 pr-8">
                    <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden relative">
                      <div className="flex items-center justify-center w-full h-full text-white/50 font-bold bg-brand-purple/20">
                        {hired.worker?.name?.[0] || hired.worker?.email?.[0] || "U"}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-white">{hired.worker?.name || "Student"}</p>
                      <p className="text-xs text-white/50">{hired.worker?.email}</p>
                    </div>
                  </div>
                  
                  {/* LINK TO THE CHAT PAGE */}
                  <Link 
                    href={`/gig/${id}/chat`}
                    className="flex items-center gap-2 px-8 py-3 bg-brand-purple text-white font-bold rounded-xl hover:bg-brand-purple/80 transition-all shadow-lg shadow-brand-purple/20"
                  >
                    <MessageSquare className="w-4 h-4" /> Open Chat Session
                  </Link>
                </div>
              ) : (
                <p className="text-red-400">Worker details not found.</p>
              );
            })()}
          </div>
        ) : (
          /* --- APPLICANT LIST --- */
          <div className="space-y-4">
            
            {/* Limit Warning if max reached */}
            {applicants.length >= 10 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3 text-yellow-500 text-sm mb-4">
                    <AlertCircle className="w-4 h-4" />
                    <span>Application limit reached (10/10). No new applicants can join.</span>
                </div>
            )}

            {applicants.length === 0 ? (
              <div className="text-center py-20 bg-[#121217] rounded-[32px] border border-white/10">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40">No applicants yet.</p>
              </div>
            ) : (
              applicants.map((app) => (
                <div 
                  key={app.id} 
                  className="bg-[#121217] border border-white/10 rounded-[24px] p-6 hover:border-brand-purple/30 transition-all group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    
                    {/* Worker Info */}
                    <div className="flex items-start gap-4">
                      {/* Avatar / Initial Fallback */}
                      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 overflow-hidden relative flex-shrink-0 flex items-center justify-center text-xl font-bold uppercase text-white/60">
                        {app.worker?.name?.[0] || app.worker?.email?.[0] || <User className="w-6 h-6"/>}
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg text-white">
                            {app.worker?.name || app.worker?.email?.split('@')[0] || "Unknown Student"}
                          </h3>
                          
                          {app.worker?.kyc_verified && (
                            <div className="p-1" title="Verified ID">
                              <ShieldCheck className="w-4 h-4 text-green-500" />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-4 text-xs text-white/40 mb-3">
                          {/* Rating - Updated Logic */}
                          <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="font-bold">
                              {app.worker?.rating ? Number(app.worker.rating).toFixed(1) : "New"}
                            </span>
                            <span className="text-white/30 text-[10px] ml-1">
                              {/* Display "0 reviews" if count is missing, otherwise pluralize correctly */}
                              ({app.worker?.rating_count || 0} {app.worker?.rating_count === 1 ? 'review' : 'reviews'})
                            </span>
                          </div>

                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> ETA: <span className="text-white">{app.eta || "Not specified"}</span>
                          </span>
                          
                          <span className="hidden sm:inline">Applied {new Date(app.created_at).toLocaleDateString()}</span>
                        </div>

                        {/* Pitch */}
                        <div className="bg-white/5 rounded-xl p-4 text-sm text-white/80 leading-relaxed border border-white/5 max-w-2xl">
                          "{app.pitch || app.message || "No message provided."}"
                        </div>
                      </div>
                    </div>

                    {/* Hire Button */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => handleAccept(app.worker_id)}
                        disabled={assigning === app.worker_id}
                        className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 shadow-lg shadow-white/5"
                      >
                        {assigning === app.worker_id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <DollarSign className="w-4 h-4" />
                        )}
                        <span>Hire & Pay ₹{gig.price}</span>
                      </button>
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}