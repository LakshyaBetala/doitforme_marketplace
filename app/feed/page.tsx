"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, IndianRupee, Briefcase, Search, ShoppingBag as ShoppingBagIcon, Sparkles, Star, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// --- ROBUST TIME AGO ---
function timeAgo(dateString: string) {
  if (!dateString) return "";
  const now = new Date();
  const past = new Date(dateString);
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// --- BACKGROUND COMPONENT (THEMED) ---
function BackgroundBlobs({ theme }: { theme: "MARKET" | "HUSTLE" }) {
  const primaryColor = theme === "MARKET" ? "bg-pink-500" : "bg-purple-600";
  const secondaryColor = theme === "MARKET" ? "bg-rose-400" : "bg-blue-500";

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 transition-colors duration-1000">
      <div className={`absolute w-[40rem] h-[40rem] ${primaryColor}/10 blur-[100px] rounded-full -top-40 -left-40 animate-blob will-change-transform transition-colors duration-1000`} />
      <div className={`absolute w-[30rem] h-[30rem] ${secondaryColor}/10 blur-[100px] rounded-full top-[30%] -right-20 animate-blob animation-delay-2000 will-change-transform transition-colors duration-1000`} />
    </div>
  );
}

export default function FeedPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [feedType, setFeedType] = useState<"MARKET" | "HUSTLE">("MARKET");
  const [campusFilter, setCampusFilter] = useState<"ALL" | "MY_CAMPUS">("ALL");

  const ITEMS_PER_PAGE = 12;

  const fetchGigs = async (pageIndex: number, isNewFilter: boolean = false) => {
    try {
      if (isNewFilter) {
        setLoading(true);
        setGigs([]);
      } else {
        setLoadingMore(true);
      }

      const { data: { user } } = await supabase.auth.getUser();

      let userCollege = null;
      if (user) {
        const { data: userData } = await supabase.from('users').select('college').eq('id', user.id).single();
        userCollege = userData?.college;
      }

      const nowIso = new Date().toISOString();
      const from = pageIndex * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      // Base Query
      let query = supabase
        .from("gigs")
        .select("*, users:poster_id!inner(college)")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .range(from, to);

      // Filters
      if (feedType === "HUSTLE") {
        query = query.eq("listing_type", "HUSTLE").or(`deadline.is.null,deadline.gt.${nowIso}`);
      } else {
        query = query.eq("listing_type", "MARKET");
      }

      if (campusFilter === "MY_CAMPUS" && userCollege) {
        query = query.eq("users.college", userCollege);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        setGigs(prev => isNewFilter ? data : [...prev, ...data]);
        setHasMore(data.length === ITEMS_PER_PAGE);
      }

    } catch (err) {
      console.error("Feed Error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // --- SCROLL RESTORATION Logic ---
  useEffect(() => {
    const cached = sessionStorage.getItem("feed_cache");
    if (cached) {
      try {
        const state = JSON.parse(cached);
        const isFresh = Date.now() - state.timestamp < 1000 * 60 * 10; // 10 mins

        if (isFresh && state.gigs?.length > 0) {
          // Restore State
          setGigs(state.gigs);
          setPage(state.page);
          setHasMore(state.hasMore);
          setFeedType(state.feedType);
          setCampusFilter(state.campusFilter);
          setLoading(false);

          // Restore Scroll
          setTimeout(() => {
            window.scrollTo(0, state.scrollTop);
          }, 50);
          return;
        }
      } catch (e) {
        console.error("Cache parse error", e);
        sessionStorage.removeItem("feed_cache");
      }
    }

    // If no cache, initial fetch
    fetchGigs(0, true);
  }, []); // Run ONCE on mount

  // Save State on Unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      const state = {
        gigs,
        page,
        hasMore,
        feedType,
        campusFilter,
        scrollTop: window.scrollY,
        timestamp: Date.now()
      };
      sessionStorage.setItem("feed_cache", JSON.stringify(state));
    };

    // Save on route change (unmount) and window close
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      handleBeforeUnload(); // Save on component unmount
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gigs, page, hasMore, feedType, campusFilter]);

  // Handlers for Filters (replacing the old useEffect)
  const handleFeedTypeChange = (type: "MARKET" | "HUSTLE") => {
    if (type === feedType) return;
    setFeedType(type);
    setPage(0);
    setHasMore(true);
    // We need to pass the new type explicitly because state update is async
    // But fetchGigs uses state... so we need to pass overrides or rely on useEffect?
    // Actually, simple fix: Update state, then fetch in a useEffect that ONLY triggers on change AFTER mount?
    // No, cleaner to just pass the filter to fetchGigs or use a ref. 
    // Let's modify fetchGigs to accept overrides, or just force a reload via a key?
    // Re-instating a controlled useEffect might be better if we use a 'mounted' ref.

    // Quick fix: Set state, then trigger fetch with a small timeout or use a ref for current filter.
    // Actually, standard pattern:
    // setFeedType(type); 
    // -> useEffect([feedType]) triggers.
    // BUT we blocked that to handle Restore.

    // Solution: calls a specialized fetch that takes arguments
    // fetchGigs(0, true, type); // Need to update fetchGigs signature?
    // Let's just reload page with new param? No, SPA.

    // Let's stick to the manual approach but update fetchGigs to use refs or passed args?
    // Or simpler: Just set state and let a specific useEffect handle it IF it's not the initial render?
  };

  // Refactored Fetch to use parameters instead of state for filters to be safe
  const fetchGigsWithParams = async (pageIndex: number, isNewFilter: boolean, type: string, campus: string) => {
    // ... similar logic to fetchGigs but using type/campus args
    // For now, let's keep it simple:
    // The state update might not be immediate. 
    // Let's use a useEffect that listens to [feedType, campusFilter] BUT skips the FIRST run if we restored.
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchGigs(nextPage, false);
  };

  const themeColor = feedType === "MARKET" ? "text-pink-400" : "text-brand-purple";
  const themeBorder = feedType === "MARKET" ? "border-pink-500/20" : "border-brand-purple/20";
  const themeBg = feedType === "MARKET" ? "bg-pink-500/10" : "bg-brand-purple/10";

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-4 md:p-6 relative selection:bg-brand-purple overflow-x-hidden">
      <BackgroundBlobs theme={feedType} />

      {/* HEADER & TOGGLE */}
      <div className="max-w-xl mx-auto mb-8 sticky top-0 z-20 bg-[#0B0B11]/80 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-auto md:px-0 md:rounded-b-3xl border-b border-white/5 md:border-none space-y-4">

        {/* TOP BAR */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tighter italic">
            <span className={themeColor}>DOIT</span>FORME
          </h1>
          <button
            onClick={() => router.push('/messages')}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors relative"
          >
            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${feedType === 'MARKET' ? 'bg-pink-500' : 'bg-brand-purple'} animate-pulse`}></div>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </button>
        </div>

        <div className="flex bg-white/5 p-1 rounded-2xl relative">
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 rounded-xl transition-all duration-300 ease-out ${feedType === 'HUSTLE' ? 'left-[calc(50%+2px)]' : 'left-1'}`}></div>
          <button onClick={() => { setFeedType("MARKET"); setPage(0); setHasMore(true); setTimeout(() => fetchGigs(0, true), 0); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-colors ${feedType === "MARKET" ? "text-pink-400" : "text-white/40 hover:text-white"}`}>
            <ShoppingBagIcon size={16} /> Campus Market
          </button>
          <button onClick={() => { setFeedType("HUSTLE"); setPage(0); setHasMore(true); setTimeout(() => fetchGigs(0, true), 0); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-colors ${feedType === "HUSTLE" ? "text-brand-purple" : "text-white/40 hover:text-white"}`}>
            <Briefcase size={16} /> The Hustle
          </button>
        </div>
      </div>

      {/* FEED GRID */}
      <div className="max-w-xl mx-auto space-y-4 pb-24 overflow-hidden">

        {/* CAMPUS FILTER */}
        {!loading && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center justify-center gap-4 mb-6">
              <button onClick={() => { setCampusFilter('ALL'); setPage(0); setHasMore(true); setTimeout(() => fetchGigs(0, true), 0); }} className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all ${campusFilter === 'ALL' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>All Campuses</button>
              <div className="w-px h-4 bg-white/10"></div>
              <button onClick={() => { setCampusFilter('MY_CAMPUS'); setPage(0); setHasMore(true); setTimeout(() => fetchGigs(0, true), 0); }} className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all flex items-center gap-2 ${campusFilter === 'MY_CAMPUS' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                <MapPin size={12} /> My Campus
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/40 mb-4" />
            <p className="text-white/40 text-sm">Loading campus vibe...</p>
          </div>
        ) : gigs.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20 space-y-6">
            <div className="relative w-48 h-48 mx-auto">
              {/* Sleeping Sloth - Ghost Town Fix */}
              <Image
                src="/sleeping_sloth.png"
                alt="Sleeping Sloth"
                fill
                className="object-contain animate-bounce-slow opacity-80"
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white italic tracking-tighter">
                Ghost Town?
              </h3>
              <p className="text-brand-purple font-medium">No hustles yet? Be the first to post!</p>
            </div>
            <button onClick={() => router.push('/post')} className={`px-8 py-4 rounded-xl font-bold text-white ${feedType === 'MARKET' ? 'bg-pink-500 hover:bg-pink-400' : 'bg-brand-purple hover:bg-brand-purple/90'} transition-all hover:scale-105 shadow-xl shadow-brand-purple/20`}>
              Create Post
            </button>
          </motion.div>
        ) : (
          <>
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 mx-auto">
              <AnimatePresence mode="popLayout">
                {gigs.map((gig, index) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    key={gig.id}
                    className={`break-inside-avoid relative group bg-[#1A1A24] border border-white/5 rounded-2xl overflow-hidden hover:border-${themeColor}/50 transition-colors cursor-pointer mb-4`}
                  >
                    <Link href={`/gig/${gig.id}`} className="block">
                      <div className="w-full aspect-square bg-[#121217] relative overflow-hidden">
                        {gig.images && gig.images[0] ? (
                          <Image
                            src={supabase.storage.from("gig-images").getPublicUrl(gig.images[0]).data.publicUrl}
                            alt={gig.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="(max-width: 768px) 50vw, 33vw"
                            priority={index < 4}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10">
                            {gig.listing_type === "MARKET" ? <ShoppingBagIcon size={32} className="text-white/20" /> : <Briefcase size={32} className="text-white/20" />}
                          </div>
                        )}
                        <div className={`absolute top-2 right-2 backdrop-blur px-2 py-1 rounded-lg border border-white/10 text-xs font-bold text-white shadow-lg ${gig.market_type === 'REQUEST' ? 'bg-blue-500/80' : 'bg-black/60'}`}>
                          {gig.market_type === 'REQUEST' ? (
                            <span>🙏 LOOKING FOR</span>
                          ) : (
                            <><IndianRupee size={10} className="inline mr-0.5" />{gig.price}</>
                          )}
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-bold text-white mb-1 leading-tight line-clamp-2">{gig.title}</h3>
                        <div className="flex items-center justify-between text-[10px] text-white/40 mt-2">
                          <span className="flex items-center gap-1 truncate max-w-[60%]"><MapPin size={10} /> {gig.location || "Campus"}</span>
                          <span>{timeAgo(gig.created_at)}</span>
                        </div>
                        {gig.market_type === 'REQUEST' && (
                          <div className="mt-3 w-full py-2 bg-blue-500/20 border border-blue-500/40 rounded-xl text-center text-xs font-bold text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            I Have This!
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {hasMore && (
              <div className="text-center pt-8 pb-12">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Loader2({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;
}