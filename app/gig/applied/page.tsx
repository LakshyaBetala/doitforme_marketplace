"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { 
  ArrowLeft, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Briefcase,
  IndianRupee,
  ArrowUpRight
} from "lucide-react";

export default function AppliedGigsPage() {
  const supabase = supabaseBrowser();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadApplications = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch Applications for this user
        const { data: apps, error: appError } = await supabase
          .from("applications")
          .select("*")
          .eq("worker_id", user.id)
          .order("created_at", { ascending: false });

        if (appError) throw appError;

        if (apps && apps.length > 0) {
          // 2. Manual Join: Fetch Gig Details for these applications
          const gigIds = apps.map((app) => app.gig_id);
          const { data: gigs } = await supabase
            .from("gigs")
            .select("id, title, price, status")
            .in("id", gigIds);

          // 3. Merge Data
          const merged = apps.map((app) => {
            const gig = gigs?.find((g) => g.id === app.gig_id);
            return { ...app, gig };
          });
          
          setApplications(merged);
        }
      } catch (err) {
        console.error("Error fetching applications:", err);
      } finally {
        setLoading(false);
      }
    };

    loadApplications();
  }, [supabase]);

  // --- STATUS BADGE HELPER ---
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" /> Accepted
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase tracking-wider">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B11] p-6 lg:p-12 pb-24 text-white selection:bg-brand-purple selection:text-white">
      
      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-brand-purple/5 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-brand-blue/5 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-2 group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
            </Link>
            <h1 className="text-4xl font-black text-white tracking-tight">Track Applications</h1>
          </div>
        </div>

        {/* Content */}
        {applications.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {applications.map((app) => (
              <Link 
                key={app.id} 
                href={`/gig/${app.gig_id}`}
                className="group relative bg-[#121217] border border-white/10 rounded-3xl p-6 hover:border-brand-purple/30 transition-all hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-white/5 rounded-2xl border border-white/5">
                        <Briefcase className="w-6 h-6 text-brand-blue" />
                      </div>
                      {getStatusBadge(app.status || 'pending')}
                    </div>
                    
                    <h3 className="text-xl font-bold text-white mb-2 line-clamp-2">
                      {app.gig?.title || "Unknown Gig"}
                    </h3>
                    
                    <div className="flex items-center gap-2 text-white/50 text-sm">
                      <IndianRupee className="w-4 h-4" />
                      <span className="font-mono text-white/80">{app.gig?.price || "0"}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs text-white/30 font-medium">
                      Applied {new Date(app.created_at).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1 text-xs font-bold text-white group-hover:text-brand-purple transition-colors">
                      View Gig <ArrowUpRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[#121217] border border-white/10 rounded-[40px]">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No applications yet</h2>
            <p className="text-white/50 max-w-md mb-8">
              You haven't applied to any gigs yet. Explore the marketplace to find tasks you can help with.
            </p>
            <Link 
              href="/dashboard" 
              className="px-8 py-4 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform"
            >
              Browse Marketplace
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}