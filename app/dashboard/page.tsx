"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
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
  Filter,
  SlidersHorizontal,
  Clock
} from "lucide-react";

export default function Dashboard() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [activeChats, setActiveChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  
  // --- SEARCH STATE ---
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        setUser({ ...user, user_metadata: { ...user.user_metadata, ...dbUser } });

        // Fetch Gigs
            const nowIso = new Date().toISOString();
            const { data: gigsData } = await supabase
               .from("gigs")
               .select("*, applications(count)") 
               .neq("poster_id", user.id)
               .eq("status", "open")
               .or(`deadline.is.null,deadline.gt.${nowIso}`)
               .order("created_at", { ascending: false })
               .limit(20);
        setGigs(gigsData || []);

        // Fetch Chats
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

  // --- SEARCH LOGIC ---
  const filteredGigs = gigs.filter((gig) => 
    gig.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gig.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Optional: Redirect to full feed with query if needed
      // router.push(`/feed?search=${searchQuery}`);
    }
  }

  if (loading) return <DashboardSkeleton />;

  const username = user?.user_metadata?.name || user?.email?.split("@")[0] || "Partner";
  const isKycVerified = user?.user_metadata?.kyc_verified === true;

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 font-sans selection:bg-brand-purple selection:text-white">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <Link href="/" className="flex items-center gap-2 group">
                <div className="relative w-7 h-7">
                   <Image src="/logo.svg" alt="Logo" fill className="object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="font-bold text-lg tracking-tight">DoItForMe</span>
             </Link>
          </div>

          <div className="flex items-center gap-3">
             {!isKycVerified && (
               <Link href="/verify-id" className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase tracking-wider hover:bg-yellow-500/20 transition-all">
                  <User size={12} /> Verify ID
               </Link>
             )}
             <div className="h-6 w-px bg-zinc-800 mx-2 hidden sm:block"></div>
             <Link href="/profile" className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                   <User size={14} />
                </div>
                <span className="hidden sm:inline-block">{username}</span>
             </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 pt-10">
        {/* UPI MISSING BANNER */}
        {!user?.user_metadata?.upi_id && (
          <div className="mb-6">
            <div className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-bold text-center">
              Please add your UPI ID in your <Link href="/profile" className="underline">Profile</Link> to start receiving work. You won't be able to post or apply for gigs without it.
            </div>
          </div>
        )}
        
        {/* --- CONTROL DECK (Stats & Actions) --- */}
        <section className="mb-12 grid grid-cols-1 md:grid-cols-12 gap-6">
           
           {/* Welcome & Stats */}
           <div className="md:col-span-8 p-8 rounded-3xl bg-[#0A0A0A] border border-white/5 relative overflow-hidden group">
              <div className="relative z-10 flex flex-col justify-between h-full">
                 <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Marketplace Overview</h1>
                    <p className="text-zinc-500 max-w-md">Track your active gigs, manage applications, and find new opportunities.</p>
                 </div>
                 <div className="flex gap-8 mt-8 border-t border-white/5 pt-6">
                    <div>
                       <div className="text-2xl font-bold text-white">{user?.user_metadata?.jobs_completed || 0}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Jobs Done</div>
                    </div>
                    <div>
                       <div className="text-2xl font-bold text-white">{Number(user?.user_metadata?.rating || 5).toFixed(1)}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Rating</div>
                    </div>
                    <div>
                       <div className="text-2xl font-bold text-white">₹{user?.user_metadata?.total_earned || 0}</div>
                       <div className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Earned</div>
                    </div>
                 </div>
              </div>
              <div className="absolute right-0 top-0 w-64 h-64 bg-brand-purple/5 rounded-full blur-[80px] group-hover:bg-brand-purple/10 transition-colors duration-500" />
           </div>

           {/* Quick Actions */}
           <div className="md:col-span-4 flex flex-col gap-3">
              <Link href="/post" className="flex-1 flex items-center justify-between p-6 rounded-3xl bg-white text-black hover:bg-zinc-200 transition-all group">
                 <span className="font-bold text-lg">Post New Task</span>
                 <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform"><Plus size={20}/></div>
              </Link>
              <div className="flex-1 grid grid-cols-2 gap-3">
                 <Link href="/gig/my-gigs" className="flex flex-col justify-center p-5 rounded-3xl bg-[#0A0A0A] border border-white/5 hover:border-zinc-700 transition-all group">
                    <Briefcase size={20} className="text-zinc-500 group-hover:text-white mb-3 transition-colors"/>
                    <span className="text-sm font-bold text-zinc-300">My Gigs</span>
                 </Link>
                 <Link href="/gig/applied" className="flex flex-col justify-center p-5 rounded-3xl bg-[#0A0A0A] border border-white/5 hover:border-zinc-700 transition-all group">
                    <ShieldCheck size={20} className="text-zinc-500 group-hover:text-white mb-3 transition-colors"/>
                    <span className="text-sm font-bold text-zinc-300">Applications</span>
                 </Link>
              </div>
           </div>
        </section>

        {/* --- MARKETPLACE FEED --- */}
        <section>
           {/* Feed Header & Filters */}
           <div className="sticky top-20 z-20 bg-background/95 backdrop-blur-xl py-4 mb-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                 Live Gigs <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              </h2>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                 <div className="relative group w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                    <input 
                      type="text" 
                      placeholder="Search tasks..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearchEnter}
                      className="pl-9 pr-4 py-2 bg-[#0A0A0A] border border-white/10 rounded-full text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-purple/50 w-full sm:w-64 transition-all"
                    />
                 </div>
                 {/* VIEW ALL BUTTON - Redirects to Feed */}
                 <Link href="/feed" className="p-2 px-4 rounded-full border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                    View All
                 </Link>
              </div>
           </div>

           {/* Gig List */}
           <div className="grid grid-cols-1 gap-3">
              {filteredGigs.length > 0 ? (
                filteredGigs.map((gig) => (
                  <Link key={gig.id} href={`/gig/${gig.id}`} className="group block">
                     <div className="relative p-5 rounded-2xl bg-[#0A0A0A] border border-white/5 hover:border-zinc-600 hover:bg-[#0f0f0f] transition-all duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                           
                           {/* Left: Info */}
                           <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-lg font-bold text-zinc-500 group-hover:text-white group-hover:border-brand-purple/30 transition-all shrink-0">
                                 {gig.title[0]}
                              </div>
                              <div>
                                 <h3 className="font-bold text-zinc-200 group-hover:text-white transition-colors text-lg line-clamp-1">{gig.title}</h3>
                                 <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500 font-medium">
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800">
                                       <MapPin size={10} /> {gig.is_physical ? "On-Campus" : "Remote"}
                                    </span>
                                    <span className="flex items-center gap-1">
                                       <Clock size={10} /> {new Date(gig.created_at).toLocaleDateString()}
                                    </span>
                                 </div>
                              </div>
                           </div>

                           {/* Right: Price & Action */}
                           <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pl-16 sm:pl-0">
                              <div className="text-right">
                                 <div className="text-xl font-bold text-white group-hover:text-green-400 transition-colors">₹{gig.price}</div>
                                 <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold">Fixed Price</div>
                              </div>
                              <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-zinc-500 group-hover:bg-white group-hover:text-black group-hover:border-transparent transition-all">
                                 <ArrowUpRight size={18} />
                              </div>
                           </div>

                        </div>
                     </div>
                  </Link>
                ))
              ) : (
                 <div className="py-32 text-center border border-dashed border-zinc-800 rounded-3xl bg-white/5">
                    <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Filter className="w-6 h-6 text-zinc-600" />
                    </div>
                    <h3 className="text-white font-bold text-lg mb-1">No gigs found</h3>
                    <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-6">
                        {searchQuery ? `No results for "${searchQuery}"` : "The marketplace is currently quiet."}
                    </p>
                    <Link href="/post" className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-full hover:scale-105 transition-transform">
                       Post a Task
                    </Link>
                 </div>
              )}
           </div>
        </section>

      </div>
      
      {/* --- FLOATING CHAT --- */}
      {activeChats.length > 0 && (
        <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
          {isChatListOpen && (
            <div className="bg-[#0A0A0A] border border-zinc-800 rounded-2xl shadow-2xl p-4 w-80 mb-2 animate-in slide-in-from-bottom-5 fade-in">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                <h3 className="font-bold text-white text-sm">Active Chats</h3>
                <button onClick={() => setIsChatListOpen(false)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
              </div>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {activeChats.map(gig => (
                  <Link key={gig.id} href={`/gig/${gig.id}/chat`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300">{gig.title[0]}</div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-zinc-200 text-sm font-medium truncate">{gig.title}</p>
                      <p className="text-zinc-500 text-[10px]">Tap to chat</p>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </Link>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setIsChatListOpen(!isChatListOpen)} className="flex items-center justify-center w-14 h-14 bg-brand-purple text-white rounded-full shadow-lg shadow-brand-purple/20 hover:scale-110 transition-transform active:scale-95">
            {isChatListOpen ? <X size={24} /> : <MessageSquare size={24} />}
          </button>
        </div>
      )}

    </main>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-12">
      <div className="h-20 w-1/3 bg-white/5 rounded-xl animate-pulse"></div>
      <div className="grid grid-cols-12 gap-6">
         <div className="col-span-8 h-64 bg-white/5 rounded-3xl animate-pulse"></div>
         <div className="col-span-4 h-64 bg-white/5 rounded-3xl animate-pulse"></div>
      </div>
      <div className="space-y-4">
         {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse"></div>)}
      </div>
    </div>
  );
}