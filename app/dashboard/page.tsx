"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";
import Image from "next/image";
import { 
  Plus, 
  Briefcase, 
  ArrowUpRight, 
  Search, 
  Zap,
  MapPin,
  ShieldCheck,
  MessageSquare,
  X,
  User,
  Users,
  Star,
  Trophy
} from "lucide-react";

export default function Dashboard() {
  const supabase = supabaseBrowser();

  const [user, setUser] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for the new Floating Chat Widget
  const [isChatListOpen, setIsChatListOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Fetch live data from DB to ensure kyc_verified, rating, jobs_completed are current
        const { data: dbUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        // Merge: Database data overwrites user_metadata to ensure live values
        const mergedUser = {
          ...user,
          user_metadata: {
            ...user.user_metadata,
            ...dbUser,
          }
        };
        
        setUser(mergedUser);

        // 1. Fetch Marketplace Gigs + Applicant Count
        const { data: gigsData } = await supabase
          .from("gigs")
          .select("*, applications(count)") 
          .neq("poster_id", user.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(6);
        setGigs(gigsData || []);

        // 2. Fetch Active Chats (For the widget)
        const { data: activeGigs } = await supabase
          .from("gigs")
          .select("*")
          .eq("status", "ASSIGNED")
          .or(`poster_id.eq.${user.id},assigned_worker_id.eq.${user.id}`)
          .order("created_at", { ascending: false });

        setActiveChats(activeGigs || []);
      }
      setLoading(false);
    };

    loadData();
  }, []);

  if (loading) return <DashboardSkeleton />;

  const username = user?.user_metadata?.name || user?.email?.split("@")[0] || "Partner";
  
  // --- KYC CHECK ---
  const isKycVerified = user?.user_metadata?.kyc_verified === true;
  const rating = user?.user_metadata?.rating ? Number(user.user_metadata.rating).toFixed(1) : "5.0";
  const jobsCompleted = user?.user_metadata?.jobs_completed || 0;

  return (
    // Added 'pb-32' to bottom padding so scrolling clears the fixed buttons
    <main className="min-h-screen p-6 lg:p-12 pb-32 max-w-7xl mx-auto space-y-8 lg:space-y-12 relative overflow-x-hidden">
      
      {/* --- HERO HEADER --- */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 lg:w-10 lg:h-10">
               <Image src="/logo.svg" alt="Logo" fill className="object-contain" />
            </div>
            <span className="text-lg lg:text-xl font-bold text-white tracking-tight">DoItForMe</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
              Hello, <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple via-brand-pink to-white animate-pulse capitalize break-all">
                {username}
              </span>
            </h1>
          </div>
        </div>

        {/* --- PROFILE BUTTON AREA --- */}
        <div className="relative w-full md:w-auto">
            {/* Small Yellow Floating Icon with Tooltip */}
            {!isKycVerified && (
              <Link 
                href="/verify-id"
                className="group absolute bottom-full mb-3 right-0 md:right-6 z-20 p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-full shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-bounce hover:bg-yellow-500/20 transition-all hover:scale-110 flex items-center justify-center"
              >
                <User className="w-4 h-4" />
                <span className="hidden md:block absolute right-full mr-3 top-1/2 -translate-y-1/2 w-max px-3 py-1.5 bg-[#1A1A24] border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase tracking-wider rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-xl">
                  Verify KYC Now
                  <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-[#1A1A24] border-t border-r border-yellow-500/20 rotate-45"></span>
                </span>
              </Link>
            )}

            {/* Existing Main Profile Button */}
            <Link href="/profile" className="group relative overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 block w-full md:w-auto">
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-brand-dark px-6 py-3 md:py-2.5 text-sm font-medium text-white backdrop-blur-3xl">
                  <span className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                     My Profile
                  </span>
                  <ArrowUpRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"/>
                </span>
            </Link>
        </div>
      </header>

      {/* --- COMMAND CENTER --- */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-brand-purple/20 rounded-full blur-[128px] pointer-events-none"></div>

        {/* PROFILE STATS CARD (REPLACES WALLET) */}
        <div className="lg:col-span-8 relative group overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#121212] to-[#0A0A0A] p-6 md:p-10 flex flex-col justify-between min-h-[300px] md:min-h-[340px] shadow-2xl">
          <div className="absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity duration-700">
             <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] bg-brand-blue/20 rounded-full blur-[100px] animate-blob"></div>
             <div className="absolute bottom-[-20%] right-[-20%] w-[400px] h-[400px] bg-brand-purple/20 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
          </div>

          <div className="relative z-10 flex justify-between items-start">
            <div className="p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-inner">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            {isKycVerified ? (
                 <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-500 text-xs font-bold uppercase tracking-widest">
                    Verified Pro
                 </span>
            ) : (
                <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-yellow-500 text-xs font-bold uppercase tracking-widest">
                    Action Required
                 </span>
            )}
          </div>

          <div className="relative z-10 mt-auto pt-8">
            <div className="flex flex-col md:flex-row md:items-end gap-12">
                
                {/* Stat 1: Rating */}
                <div className="space-y-2">
                    <p className="text-white/50 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> Current Rating
                    </p>
                    <div className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        {rating}
                    </div>
                </div>

                {/* Stat 2: Jobs Completed */}
                <div className="space-y-2">
                    <p className="text-white/50 text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-brand-purple" /> Jobs Completed
                    </p>
                    <div className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                        {jobsCompleted}
                    </div>
                </div>

            </div>
          </div>
        </div>

        {/* ACTION GRID */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <Link href="/post" className="flex-1 relative group overflow-hidden rounded-[32px] p-1">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-blue opacity-30 group-hover:opacity-80 transition-opacity duration-500 animate-gradient-xy"></div>
            <div className="relative h-full bg-[#0E0E12] rounded-[28px] p-8 flex flex-col justify-center items-center text-center border border-white/10 group-hover:border-transparent transition-all">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-purple to-brand-blue flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(136,37,245,0.3)] group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                <Zap className="w-8 h-8 text-white fill-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">Post Request</h3>
              <p className="text-white/40 text-sm mt-2">Get tasks done instantly.</p>
            </div>
          </Link>

          <div className="flex-1 grid grid-cols-2 gap-4">
             <Link href="/gig/my-gigs" className="bg-[#121217] border border-white/5 rounded-3xl p-6 hover:bg-[#1A1A20] hover:border-brand-blue/30 transition-all group flex flex-col justify-between min-h-[140px]">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">Manage</div>
                  <div className="text-lg font-bold text-white leading-none">My Gigs</div>
                </div>
             </Link>
             <Link href="/gig/applied" className="bg-[#121217] border border-white/5 rounded-3xl p-6 hover:bg-[#1A1A20] hover:border-brand-pink/30 transition-all group flex flex-col justify-between min-h-[140px]">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-1">Track</div>
                  <div className="text-lg font-bold text-white leading-none">Applied</div>
                </div>
             </Link>
          </div>
        </div>
      </section>

      {/* --- MARKETPLACE FEED --- */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Marketplace</h2>
            <span className="hidden md:inline-block px-3 py-1 rounded-full bg-brand-blue/10 border border-brand-blue/20 text-brand-blue text-xs font-bold uppercase tracking-wider animate-pulse">
              Live Feed
            </span>
          </div>
          <Link href="/feed" className="text-sm font-medium text-white/60 hover:text-brand-purple transition-colors flex items-center gap-1 group">
            View All <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {gigs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gigs.map((gig) => (
              <Link 
                key={gig.id} 
                href={`/gig/${gig.id}`}
                className="group relative bg-[#13131A] hover:bg-[#181820] border border-white/5 hover:border-brand-purple/30 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
              >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-brand-purple to-brand-blue scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center text-sm font-bold text-white">
                      {gig.title[0]}
                    </div>
                    <div>
                      <span className="block text-xs text-white/40 font-mono">POSTED BY</span>
                      <span className="text-xs text-white/80">User #{gig.poster_id.slice(0,4)}</span>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-white group-hover:text-brand-green transition-colors">
                    ₹{gig.price}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3 line-clamp-1 group-hover:text-brand-purple transition-colors">
                  {gig.title}
                </h3>
                <p className="text-sm text-white/50 line-clamp-2 mb-8 leading-relaxed h-10">
                  {gig.description}
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-4">
                  
                  {/* METADATA GROUP */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 text-xs text-white/40 font-medium bg-white/5 px-2 py-1 rounded">
                        <MapPin className="w-3 h-3" />
                        <span>{gig.is_physical ? "On-Campus" : "Remote"}</span>
                    </div>
                    {/* APPLICANT COUNT BADGE */}
                    <div className="flex items-center gap-2 text-xs text-white/40 font-medium bg-white/5 px-2 py-1 rounded" title="Applicant slots">
                        <Users className="w-3 h-3" />
                        <span>{gig.applications?.[0]?.count || 0}/10</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-brand-blue uppercase tracking-wide">
                    Apply Now <ArrowUpRight className="w-3 h-3" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-white/5 p-20 text-center group">
            <div className="absolute inset-0 bg-brand-purple/5 group-hover:bg-brand-purple/10 transition-colors duration-700"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 border border-white/10 shadow-[0_0_60px_rgba(136,37,245,0.2)]">
                <Search className="w-10 h-10 text-white/40" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-4">No Active Gigs</h3>
              <p className="text-white/40 max-w-md mx-auto mb-10 text-lg">
                The marketplace is quiet. This is your chance to set the trend.
              </p>
              <Link href="/post" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-black font-bold hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all hover:scale-105">
                <Plus className="w-5 h-5" /> Create First Gig
              </Link>
            </div>
          </div>
        )}
      </section>

      
      {/* --- 💬 FLOATING CHAT WIDGET (Bottom Right) --- */}
      {activeChats.length > 0 && (
        <div className="fixed bottom-24 md:bottom-8 right-6 md:right-8 z-50 flex flex-col items-end gap-4">
          
          {/* Chat List Popover */}
          {isChatListOpen && (
            <div className="bg-[#1A1A24] border border-white/10 rounded-2xl shadow-2xl p-4 w-80 animate-in slide-in-from-bottom-5 fade-in duration-200 mb-2">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                <h3 className="font-bold text-white text-sm">Active Chats ({activeChats.length})</h3>
                <button onClick={() => setIsChatListOpen(false)} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activeChats.map(gig => (
                  <Link 
                    key={gig.id}
                    href={`/gig/${gig.id}/chat`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors group border border-transparent hover:border-white/5"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-purple/20 flex items-center justify-center text-brand-purple font-bold text-xs shrink-0">
                      {gig.title[0]}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-white text-sm font-medium truncate">{gig.title}</p>
                      <p className="text-white/40 text-xs truncate">
                        {gig.poster_id === user.id ? "You hired a worker" : "You're hired"}
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full shrink-0 animate-pulse"></div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Floating Button */}
          <button 
            onClick={() => setIsChatListOpen(!isChatListOpen)}
            className="group flex items-center justify-center w-14 h-14 bg-brand-purple rounded-full shadow-[0_0_30px_rgba(136,37,245,0.4)] hover:scale-110 transition-transform hover:rotate-3 active:scale-95"
          >
            {isChatListOpen ? (
              <X className="w-6 h-6 text-white" />
            ) : (
              <>
                <MessageSquare className="w-6 h-6 text-white" />
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-[#0B0B11] rounded-full animate-bounce"></span>
              </>
            )}
          </button>
        </div>
      )}

    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-12">
      <div className="h-20 w-1/3 bg-white/5 rounded-2xl animate-pulse"></div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 h-[340px] bg-white/5 rounded-[32px] animate-pulse"></div>
        <div className="lg:col-span-4 h-[340px] bg-white/5 rounded-[32px] animate-pulse"></div>
      </div>
    </div>
  );
}