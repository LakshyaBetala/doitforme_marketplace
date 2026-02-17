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

  // Reset and Load on Filter Change
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchGigs(0, true);
  }, [feedType, campusFilter]);

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
          <button onClick={() => setFeedType("MARKET")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-colors ${feedType === "MARKET" ? "text-pink-400" : "text-white/40 hover:text-white"}`}>
            <ShoppingBagIcon size={16} /> Campus Market
          </button>
          <button onClick={() => setFeedType("HUSTLE")} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-colors ${feedType === "HUSTLE" ? "text-brand-purple" : "text-white/40 hover:text-white"}`}>
            <Briefcase size={16} /> The Hustle
          </button>
        </div>
      </div>

      {/* FEED GRID */}
      <div className="max-w-xl mx-auto space-y-4 pb-24 overflow-hidden">

        {/* CAMPUS FILTER */}
        {!loading && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <button onClick={() => setCampusFilter('ALL')} className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all ${campusFilter === 'ALL' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>All Campuses</button>
            <div className="w-px h-4 bg-white/10"></div>
            <button onClick={() => setCampusFilter('MY_CAMPUS')} className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all flex items-center gap-2 ${campusFilter === 'MY_CAMPUS' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
              <MapPin size={12} /> My Campus
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/40 mb-4" />
            <p className="text-white/40 text-sm">Loading campus vibe...</p>
          </div>
        ) : gigs.length === 0 ? (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20 space-y-4">
            <div className={`w-20 h-20 mx-auto rounded-full ${themeBg} flex items-center justify-center mb-4`}>
              <Search size={32} className={themeColor} />
            </div>
            <h3 className="text-xl font-bold text-white">No {feedType === 'MARKET' ? 'items' : 'gigs'} found</h3>
            <button onClick={() => router.push('/post')} className={`px-6 py-3 rounded-xl font-bold text-white ${feedType === 'MARKET' ? 'bg-pink-500 hover:bg-pink-400' : 'bg-brand-purple hover:bg-brand-purple/90'} transition-colors shadow-lg`}>
              Post Now
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
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-lg border border-white/10 text-xs font-bold text-white shadow-lg">
                          <IndianRupee size={10} className="inline mr-0.5" />{gig.price}
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="text-sm font-bold text-white mb-1 leading-tight line-clamp-2">{gig.title}</h3>
                        <div className="flex items-center justify-between text-[10px] text-white/40 mt-2">
                          <span className="flex items-center gap-1 truncate max-w-[60%]"><MapPin size={10} /> {gig.location || "Campus"}</span>
                          <span>{timeAgo(gig.created_at)}</span>
                        </div>
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