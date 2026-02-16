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
  const [campusFilter, setCampusFilter] = useState<'ALL' | 'MY_CAMPUS'>('ALL');
  const [loading, setLoading] = useState(true);
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  // --- SEARCH STATE ---
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const loadUserAndChats = async () => {
      // OPTIMIZATION: Check session directly to prevent race conditions on redirect
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return router.push("/login");
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        const { data: dbUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", authUser.id)
          .single();

        setUser({ ...authUser, user_metadata: { ...authUser.user_metadata, ...dbUser } });

        // Fetch Chats
        const { data: activeGigs } = await supabase
          .from("gigs")
          .select("*")
          .eq("status", "ASSIGNED")
          .or(`poster_id.eq.${authUser.id},assigned_worker_id.eq.${authUser.id}`)
          .order("created_at", { ascending: false });
        setActiveChats(activeGigs || []);
      }
      // Note: We don't set loading false here, we wait for gigs
    };
    loadUserAndChats();
  }, [router, supabase]);

  // Separate Effect for Gigs to support Campus Filter Re-fetching
  useEffect(() => {
    const loadGigs = async () => {
      if (!user) return; // Wait for user

      setLoading(true);
      const nowIso = new Date().toISOString();

      let query = supabase
        .from("gigs")
        .select("*, applications(count), users:poster_id!inner(college)") // Join poster for college
        .neq("poster_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20);

      // Apply Deadline Logic
      query = query.or(`deadline.is.null,deadline.gt.${nowIso}`);

      if (campusFilter === 'MY_CAMPUS' && user?.user_metadata?.college) {
        query = query.eq("users.college", user.user_metadata.college);
      }

      const { data: gigsData, error } = await query;
      if (error) console.error("Gig Fetch Error:", error);

      setGigs(gigsData || []);
      setLoading(false);
    };

    if (user) loadGigs();
  }, [user, campusFilter, supabase]);

  // --- SEARCH & FILTER LOGIC ---
  const [feedType, setFeedType] = useState<'ALL' | 'HUSTLE' | 'MARKET'>('ALL');

  // --- FILTERING LOGIC ---
  const filteredGigs = gigs.filter(gig => {
    // 1. Search Query
    const matchesSearch = gig.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gig.description?.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Tab Filter
    let matchesType = true;
    if (feedType === 'HUSTLE') {
      matchesType = gig.listing_type === 'HUSTLE';
    } else if (feedType === 'MARKET') {
      matchesType = gig.listing_type === 'MARKET'; // Includes RENT, SELL, etc.
    }

    return matchesSearch && matchesType;
  });

  const handleSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // router.push(`/feed?search=${searchQuery}`);
    }
  }

  if (loading) return <DashboardSkeleton />;

  const username = user?.user_metadata?.name || user?.email?.split("@")[0] || "Partner";
  const isKycVerified = user?.user_metadata?.kyc_verified === true;

  return (
    <main className="min-h-[100dvh] bg-[#0B0B11] text-foreground pb-20 font-sans selection:bg-brand-purple selection:text-white overflow-x-hidden">

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 w-full bg-[#0B0B11]/80 backdrop-blur-md border-b border-white/5 md:border-none md:bg-transparent transition-all">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 md:h-28 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group active:scale-95 transition-transform touch-manipulation">
              <div className="relative w-20 h-20 md:w-28 md:h-28">
                <Image src="/sloth.png" alt="Logo" fill className="object-contain opacity-80 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {!isKycVerified && (
              <Link href="/verify-id" className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold uppercase tracking-wider hover:bg-yellow-500/20 transition-all active:scale-95 touch-manipulation">
                <User size={12} /> Verify ID
              </Link>
            )}

            {/* MESSAGES ICON (Header) */}
            <button
              onClick={() => router.push('/messages')}
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors relative"
            >
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-purple animate-pulse"></div>
              <MessageSquare size={20} />
            </button>

            <div className="h-6 w-px bg-zinc-800 mx-2 hidden sm:block"></div>
            <Link href="/profile" className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors active:scale-95 touch-manipulation">
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center">
                <User size={14} />
              </div>
              <span className="hidden sm:inline-block">{username}</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-6 md:pt-10">
        {/* UPI MISSING BANNER */}
        {!user?.user_metadata?.upi_id && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="px-4 py-3 rounded-xl bg-red-600/90 text-white text-xs md:text-sm font-bold text-center shadow-lg">
              Please add your UPI ID in your <Link href="/profile" className="underline">Profile</Link> to start receiving work. You won't be able to post or apply for gigs without it.
            </div>
          </div>
        )}

        {/* --- CONTROL DECK (Stats & Actions) --- */}
        <section className="mb-8 md:mb-12 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">

          {/* Welcome & Stats */}
          <div className="md:col-span-8 p-6 md:p-8 rounded-[32px] bg-[#121217] border border-white/5 relative overflow-hidden group">
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">Marketplace Overview</h1>
                <p className="text-zinc-500 text-sm md:text-base max-w-md">Track active gigs {user?.user_metadata?.college && `at ${user.user_metadata.college}`}, manage applications, and find new opportunities.</p>
              </div>
              <div className="flex gap-6 md:gap-8 mt-8 border-t border-white/5 pt-6">
                <div>
                  <div className="text-xl md:text-2xl font-bold text-white">{user?.user_metadata?.jobs_completed || 0}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Jobs Done</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-white">{Number(user?.user_metadata?.rating || 5).toFixed(1)}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Rating</div>
                </div>
                <div>
                  <div className="text-xl md:text-2xl font-bold text-white">₹{user?.user_metadata?.total_earned || 0}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Earned</div>
                </div>
              </div>
            </div>
            <div className="absolute right-0 top-0 w-64 h-64 bg-brand-purple/5 rounded-full blur-[80px] group-hover:bg-brand-purple/10 transition-colors duration-500 will-change-transform" />
          </div>

          {/* Quick Actions */}
          <div className="md:col-span-4 flex flex-col gap-3">
            <Link href="/post" className="flex-1 flex items-center justify-between p-6 rounded-[24px] bg-white text-black hover:bg-zinc-200 active:scale-[0.98] transition-all touch-manipulation group">
              <span className="font-black text-lg">Post Hustle / Item</span>
              <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center group-hover:scale-110 transition-transform"><Plus size={20} /></div>
            </Link>
            <div className="flex-1 grid grid-cols-2 gap-3">
              <Link href="/gig/my-gigs" className="flex flex-col justify-center p-5 rounded-[24px] bg-[#121217] border border-white/5 hover:border-zinc-700 active:scale-[0.95] transition-all touch-manipulation group">
                <Briefcase size={20} className="text-zinc-500 group-hover:text-white mb-2 transition-colors" />
                <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">My Hustles</span>
              </Link>
              <Link href="/gig/applied" className="flex flex-col justify-center p-5 rounded-[24px] bg-[#121217] border border-white/5 hover:border-zinc-700 active:scale-[0.95] transition-all touch-manipulation group">
                <ShieldCheck size={20} className="text-zinc-500 group-hover:text-white mb-2 transition-colors" />
                <span className="text-xs font-black text-zinc-400 uppercase tracking-wider">Applications</span>
              </Link>
            </div>
          </div>
        </section>

        {/* --- MARKETPLACE FEED --- */}
        <section className="relative">
          {/* Feed Header & Filters */}
          <div className="sticky top-[64px] z-20 bg-background/95 backdrop-blur-xl py-4 mb-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            <div className="flex items-center gap-4">
              <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                active feed <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              </h2>

              {/* TABS */}
              <div className="flex items-center bg-[#121217] rounded-full p-1 border border-white/5">
                <button
                  onClick={() => setFeedType('ALL')}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${feedType === 'ALL' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-white'
                    }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFeedType('HUSTLE')}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${feedType === 'HUSTLE' ? 'bg-brand-purple text-white shadow-lg' : 'text-zinc-500 hover:text-white'
                    }`}
                >
                  Hustle
                </button>
                <button
                  onClick={() => setFeedType('MARKET')}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${feedType === 'MARKET' ? 'bg-brand-pink text-white shadow-lg' : 'text-zinc-500 hover:text-white'
                    }`}
                >
                  Market
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative group w-full sm:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchEnter}
                  className="pl-9 pr-4 py-2 bg-[#121217] border border-white/10 rounded-full text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-brand-purple/50 w-full sm:w-40 transition-all"
                />
              </div>
              {/* FILTER DROPDOWN ICON */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`p-2 rounded-full border transition-all ${campusFilter === 'MY_CAMPUS' ? 'bg-brand-purple text-white border-brand-purple' : 'border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white'}`}
                >
                  <Filter size={16} />
                </button>

                {/* Dropdown Menu */}
                {isFilterOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 space-y-1">
                      <button
                        onClick={() => { setCampusFilter('ALL'); setIsFilterOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between ${campusFilter === 'ALL' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                      >
                        All Campuses
                        {campusFilter === 'ALL' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                      </button>
                      <button
                        onClick={() => { setCampusFilter('MY_CAMPUS'); setIsFilterOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between ${campusFilter === 'MY_CAMPUS' ? 'bg-brand-purple/20 text-brand-purple' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                      >
                        My Campus
                        {campusFilter === 'MY_CAMPUS' && <div className="w-1.5 h-1.5 rounded-full bg-brand-purple"></div>}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* VIEW ALL BUTTON - Redirects to Feed */}
              <Link href="/feed" className="p-2 px-4 rounded-full border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest whitespace-nowrap active:scale-95 touch-manipulation">
                View Full Feed
              </Link>
            </div>
          </div>
        </section>

        {/* --- FEED CONTENT --- */}
        <div className="mb-12">

          {/* EMPTY STATE */}
          {filteredGigs.length === 0 && (
            <div className="py-20 md:py-32 text-center border border-dashed border-zinc-800 rounded-[32px] bg-white/5 px-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="w-6 h-6 text-zinc-600" />
              </div>
              <h3 className="text-white font-bold text-lg mb-1">No items found</h3>
              <p className="text-zinc-500 text-sm max-w-xs mx-auto mb-6">
                {searchQuery ? `No results for "${searchQuery}"` : "The marketplace is for the bold."}
              </p>
              <Link href="/post" className="px-6 py-2.5 bg-white text-black text-xs font-black rounded-full hover:scale-105 transition-transform uppercase tracking-widest active:scale-95 touch-manipulation">
                Post Opportunity
              </Link>
            </div>
          )}

          {/* UNIFIED FEED GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredGigs.map((gig: any) => {
              const isMarket = gig.listing_type === 'MARKET';
              const isRent = gig.market_type === 'RENT';

              if (isMarket) {
                // --- MARKET CARD (Visual, Gallery Style) ---
                return (
                  <Link key={gig.id} href={`/gig/${gig.id}`} className="group block relative bg-[#121217] rounded-[28px] overflow-hidden border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl flex flex-col h-full">
                    {/* Image Area */}
                    <div className="relative w-full aspect-[4/3] overflow-hidden bg-zinc-900">
                      {gig.images && gig.images.length > 0 ? (
                        <Image
                          src={supabase.storage.from("gig-images").getPublicUrl(gig.images[0]).data.publicUrl}
                          alt={gig.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center relative bg-zinc-900">
                          <span className="text-4xl">📦</span>
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-4 left-4 flex gap-2 z-20">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider backdrop-blur-md border shadow-lg ${isRent
                          ? 'bg-brand-purple/90 text-white border-brand-purple/20'
                          : 'bg-green-500/90 text-black border-green-500/20'
                          }`}>
                          {isRent ? 'RENT' : 'BUY'}
                        </span>
                      </div>

                      {/* Floating Price */}
                      <div className="absolute bottom-4 right-4 z-20">
                        <div className="bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full border border-white/10 shadow-xl flex items-center gap-1">
                          <span className="text-sm font-black font-mono">₹{gig.price}</span>
                          {isRent && <span className="text-[10px] text-zinc-400 font-medium">/day</span>}
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-white font-bold text-lg leading-tight group-hover:text-brand-purple transition-colors line-clamp-1 mb-1">
                        {gig.title}
                      </h3>
                      <div className="flex items-center justify-between text-xs text-zinc-500 font-medium mt-auto">
                        <span className="flex items-center gap-1"><MapPin size={10} /> {gig.users?.college || gig.location || "Online"}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(gig.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                );
              } else {
                // --- HUSTLE CARD (Compact, Tech Style) ---
                return (
                  <Link key={gig.id} href={`/gig/${gig.id}`} className="group block relative bg-[#121217] rounded-[20px] overflow-hidden border border-white/5 hover:border-brand-purple/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(136,37,245,0.1)] flex flex-col h-full">
                    <div className="p-5 flex flex-col h-full relative overflow-hidden">

                      {/* Decorative Gradient Blob */}
                      <div className="absolute -right-4 -top-4 w-24 h-24 bg-brand-purple/5 rounded-full blur-2xl group-hover:bg-brand-purple/10 transition-colors"></div>

                      {/* Top Row: Icon & Badge */}
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-lg font-black text-brand-purple group-hover:scale-110 transition-transform shadow-inner">
                          {gig.title[0]}
                        </div>
                        <span className="px-2 py-1 rounded-md bg-zinc-900 border border-white/5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                          {gig.is_physical ? <><MapPin size={10} /> {gig.users?.college || "Campus"}</> : <><Zap size={10} /> Remote</>}
                        </span>
                      </div>

                      {/* Title & Price */}
                      <div className="mb-4 relative z-10">
                        <h3 className="text-white font-bold text-lg leading-tight mb-2 group-hover:text-brand-purple transition-colors line-clamp-2">
                          {gig.title}
                        </h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-white tracking-tight">₹{gig.price}</span>
                          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Budget</span>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider relative z-10">
                        <span>{timeAgo(gig.created_at)}</span>
                        <span className="group-hover:translate-x-1 transition-transform text-zinc-400 group-hover:text-white flex items-center gap-1">
                          Apply Now <ArrowUpRight size={10} />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              }
            })}
          </div>

        </div>

      </div >

      {/* --- FLOATING CHAT --- */}
      {
        activeChats.length > 0 && (
          <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex flex-col items-end gap-4">
            {isChatListOpen && (
              <div className="bg-[#121217] border border-zinc-800 rounded-2xl shadow-2xl p-4 w-[calc(100vw-48px)] max-w-[320px] mb-2 animate-in slide-in-from-bottom-5 fade-in duration-200">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5">
                  <h3 className="font-black text-white text-xs uppercase tracking-widest">Active Chats</h3>
                  <button onClick={() => setIsChatListOpen(false)} className="text-zinc-500 hover:text-white p-1 touch-manipulation"><X size={14} /></button>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {activeChats.map(gig => (
                    <Link key={gig.id} href={`/gig/${gig.id}/chat`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 active:bg-white/5 transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-black text-zinc-300">{gig.title[0]}</div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-zinc-200 text-sm font-bold truncate">{gig.title}</p>
                        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-tighter">Tap to chat</p>
                      </div>
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setIsChatListOpen(!isChatListOpen)} className="flex items-center justify-center w-14 h-14 bg-brand-purple text-white rounded-full shadow-lg shadow-brand-purple/20 hover:scale-110 active:scale-90 transition-all touch-manipulation">
              {isChatListOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </button>
          </div>
        )
      }

      {/* MOBILE FAB (Sweet Spot) */}
      <Link
        href="/post"
        className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-white text-black rounded-full shadow-2xl shadow-white/20 flex items-center justify-center active:scale-90 transition-transform touch-manipulation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Plus size={28} strokeWidth={2.5} />
      </Link>

    </main >
  );
}

function timeAgo(dateString: string) {
  if (!dateString) return "";
  const safeDateString = dateString.endsWith("Z") || dateString.includes("+")
    ? dateString
    : `${dateString}Z`;
  const seconds = Math.floor((Date.now() - new Date(safeDateString).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      <div className="h-10 w-32 bg-white/5 rounded-full animate-pulse"></div>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="col-span-1 md:col-span-8 h-64 bg-white/5 rounded-[32px] animate-pulse"></div>
        <div className="col-span-1 md:col-span-4 h-64 bg-white/5 rounded-[32px] animate-pulse"></div>
      </div>
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-[24px] animate-pulse"></div>)}
      </div>
    </div>
  );
}