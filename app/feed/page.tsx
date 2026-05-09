"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Clock, IndianRupee, Briefcase, Search, ShoppingBag as ShoppingBagIcon, Sparkles, Star, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import GigCard from "@/components/ui/GigCard";
import { GigCardCompactSkeleton } from "@/components/ui/Skeleton";

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

// --- BACKGROUND COMPONENT ---
function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 transition-colors duration-1000">
      <div className={`absolute w-[40rem] h-[40rem] bg-[#8825F5]/10 blur-[100px] rounded-full -top-40 -left-40 animate-blob will-change-transform transition-colors duration-1000`} />
      <div className={`absolute w-[30rem] h-[30rem] bg-[#8825F5]/10 blur-[100px] rounded-full top-[30%] -right-20 animate-blob animation-delay-2000 will-change-transform transition-colors duration-1000`} />
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
      // Exclude gigs older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gt("created_at", thirtyDaysAgo);

      // Filter only Hustles and Company Tasks
      query = query.in("listing_type", ["HUSTLE", "COMPANY_TASK"]).or(`deadline.is.null,deadline.gt.${nowIso}`);

      if (campusFilter === "MY_CAMPUS" && userCollege) {
        query = query.eq("users.college", userCollege);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        // Fetch unlimited companies to auto-feature their posts
        const { data: unlimitedCompanies } = await supabase
           .from("companies")
           .select("user_id")
           .gte("free_credits", 999999);
           
        const premiumPosterIds = new Set(unlimitedCompanies?.map((c: any) => c.user_id) || []);
        
        const enhancedData = data.map((gig: any) => ({
           ...gig,
           is_featured: premiumPosterIds.has(gig.poster_id)
        }));
        
        // Sort so featured gigs always appear first within this page's result set
        enhancedData.sort((a: any, b: any) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));

        setGigs(prev => isNewFilter ? enhancedData : [...prev, ...enhancedData]);
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
          setGigs(state.gigs);
          setPage(state.page);
          setHasMore(state.hasMore);
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
    };
  }, [gigs, page, hasMore, campusFilter]);



  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchGigs(nextPage, false);
  };

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-4 md:p-6 relative selection:bg-brand-purple overflow-x-hidden">
      <BackgroundBlobs />

      {/* HEADER & TOGGLE */}
      <div className="max-w-xl mx-auto mb-8 sticky top-0 z-20 bg-[#0B0B11]/80 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-auto md:px-0 md:rounded-b-3xl border-b border-white/5 md:border-none space-y-4">

        {/* TOP BAR */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tighter italic">
            <span className="text-brand-purple">DOIT</span>FORME
          </h1>
          <button
            onClick={() => router.push('/messages')}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/10 text-white/60 hover:text-white transition-colors relative"
          >
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-purple animate-pulse"></div>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </button>
        </div>

        {/* Removed Marketplace Toggle */}
      </div>

      {/* FEED GRID */}
      <div className="max-w-xl mx-auto space-y-4 pb-24 overflow-hidden">

        {/* CAMPUS FILTER */}
        {!loading && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="flex items-center justify-center gap-4 mb-6">
              <button onClick={() => { setCampusFilter('ALL'); setPage(0); setHasMore(true); setTimeout(() => fetchGigs(0, true), 0); }} className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all ${campusFilter === 'ALL' ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/10'}`}>All Campuses</button>
              <div className="w-px h-4 bg-white/10"></div>
              <button onClick={() => { setCampusFilter('MY_CAMPUS'); setPage(0); setHasMore(true); setTimeout(() => fetchGigs(0, true), 0); }} className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all flex items-center gap-2 ${campusFilter === 'MY_CAMPUS' ? 'bg-white text-black' : 'bg-white/10 text-white/60 hover:bg-white/10'}`}>
                <MapPin size={12} /> My Campus
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 mx-auto">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="break-inside-avoid mb-4">
                <GigCardCompactSkeleton />
              </div>
            ))}
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
            <button onClick={() => router.push('/post')} className="px-6 py-3 rounded-xl font-medium text-white tracking-tight bg-[#8825F5] hover:bg-[#7a1fe0] transition-colors">
              Create post
            </button>
          </motion.div>
        ) : (
          <>
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 mx-auto">
              <AnimatePresence mode="popLayout">
                {gigs.map((gig, index) => {
                  const imageUrl = gig.images && gig.images[0]
                    ? supabase.storage.from("gig-images").getPublicUrl(gig.images[0]).data.publicUrl
                    : null;
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3) }}
                      key={gig.id}
                      className="break-inside-avoid mb-4"
                    >
                      <GigCard gig={gig} imageUrl={imageUrl} variant="compact" />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {hasMore && (
              <div className="text-center pt-8 pb-12">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/10 border border-white/5 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
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