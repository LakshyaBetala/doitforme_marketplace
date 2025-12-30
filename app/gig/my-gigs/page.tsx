"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { 
  ArrowLeft, 
  Plus, 
  Loader2, 
  MapPin, 
  IndianRupee, 
  Briefcase,
  AlertCircle
} from "lucide-react";

export default function MyGigsPage() {
  const supabase = supabaseBrowser();
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGigs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // --- ROBUST FETCH STRATEGY ---
        // 1. Try fetching using 'poster_id' (Most likely correct)
        let { data, error: fetchError } = await supabase
          .from("gigs")
          .select("*")
          .eq("poster_id", user.id)
          .order("created_at", { ascending: false });

        // 2. If that failed (column doesn't exist), try 'user_id'
        if (fetchError) {
           console.warn("poster_id failed, trying user_id...");
           const retry = await supabase
            .from("gigs")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
           
           if (retry.error) throw retry.error;
           data = retry.data;
        }

        setGigs(data || []);

      } catch (err: any) {
        console.error("Error loading gigs:", err);
        setError(err.message || "Failed to load gigs");
      } finally {
        setLoading(false);
      }
    };

    loadGigs();
  }, [supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B11] p-6 lg:p-12 pb-24 text-white selection:bg-brand-purple selection:text-white">
      
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[20%] w-[500px] h-[500px] bg-brand-purple/5 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-2 group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
            </Link>
            <h1 className="text-4xl font-black text-white tracking-tight">My Posted Gigs</h1>
          </div>
          <Link 
            href="/gig/create" 
            className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            <Plus className="w-5 h-5" /> Post New Gig
          </Link>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 flex items-center gap-3">
             <AlertCircle className="w-5 h-5" />
             <span>Error: {error}</span>
          </div>
        )}

        {/* Content */}
        {gigs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gigs.map((gig) => (
              <Link 
                key={gig.id} 
                href={`/gig/${gig.id}`}
                className="group relative bg-[#121217] border border-white/10 rounded-3xl p-6 hover:border-brand-purple/30 transition-all hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        gig.status === 'open' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
                        gig.status === 'completed' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                        'bg-white/5 border-white/10 text-white/50'
                      }`}>
                        {gig.status}
                      </span>
                      <span className="text-white/40 text-xs font-mono">
                        {new Date(gig.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-brand-purple transition-colors">
                      {gig.title}
                    </h3>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-white/60">
                      <div className="flex items-center gap-1.5">
                        <IndianRupee className="w-4 h-4 text-white/40" />
                        <span className="text-white font-bold">{gig.price}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-white/40" />
                        <span>{gig.location || "Remote"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-medium text-white/40">
                    <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                      <Briefcase className="w-3 h-3" /> Manage Applications
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[#121217] border border-white/10 rounded-[40px]">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Briefcase className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No active gigs found</h2>
            <p className="text-white/50 max-w-md mb-8">
              We couldn't find any gigs linked to your current User ID.
              If you just recreated your account, your old gigs might be orphaned.
            </p>
            <Link 
              href="/gig/create" 
              className="px-8 py-4 bg-brand-purple text-white font-bold rounded-xl hover:bg-brand-purple/80 transition-colors shadow-lg shadow-brand-purple/20"
            >
              Post a New Request
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}