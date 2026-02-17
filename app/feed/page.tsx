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
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [feedType, setFeedType] = useState<"MARKET" | "HUSTLE">("MARKET");
  const [campusFilter, setCampusFilter] = useState<"ALL" | "MY_CAMPUS">("ALL");

  useEffect(() => {
    const loadGigs = async () => {
      try {
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();

        let userCollege = null;
        if (user) {
          const { data: userData } = await supabase.from('users').select('college').eq('id', user.id).single();
          userCollege = userData?.college;
        }

        const nowIso = new Date().toISOString();

        // Base Query with User Join to get poster's college
        let query = supabase
          .from("gigs")
          .select("*, users:poster_id!inner(college)") // Select poster's college
          .eq("status", "open")
          .order("created_at", { ascending: false });

        // Listing Type Filter
        if (feedType === "HUSTLE") {
          query = query.eq("listing_type", "HUSTLE").or(`deadline.is.null,deadline.gt.${nowIso}`);
        } else {
          query = query.eq("listing_type", "MARKET");
        }

        // Campus Filter
        if (campusFilter === "MY_CAMPUS" && userCollege) {
          // We need to use !inner join to filter by relation, which we did in .select()
          query = query.eq("users.college", userCollege);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setGigs(data || []);

        const urlMap: Record<string, string> = {};
        data?.forEach((gig: any) => {
          if (gig.images?.[0]) {
            const { data: publicData } = supabase.storage
              .from("gig-images")
              .getPublicUrl(gig.images[0]);
            urlMap[gig.id] = publicData?.publicUrl;
          }
        });
        setImageUrls(urlMap);

      } catch (err) {
        console.error("Feed Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadGigs();
  }, [supabase, feedType, campusFilter]);

  const themeColor = feedType === "MARKET" ? "text-pink-400" : "text-brand-purple";
  const themeBorder = feedType === "MARKET" ? "border-pink-500/20" : "border-brand-purple/20";
  const themeBg = feedType === "MARKET" ? "bg-pink-500/10" : "bg-brand-purple/10";

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-4 md:p-6 relative selection:bg-brand-purple overflow-x-hidden">
      <BackgroundBlobs theme={feedType} />

      {/* HEADER & TOGGLE */}
      <div className="max-w-xl mx-auto mb-8 sticky top-0 z-20 bg-[#0B0B11]/80 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-auto md:px-0 md:rounded-b-3xl border-b border-white/5 md:border-none space-y-4">

        {/* TOP BAR: Logo & Messages */}
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
          {/* Sliding Background */}
          <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white/10 rounded-xl transition-all duration-300 ease-out ${feedType === 'HUSTLE' ? 'left-[calc(50%+2px)]' : 'left-1'}`}></div>

          <button
            onClick={() => setFeedType("MARKET")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-colors ${feedType === "MARKET" ? "text-pink-400" : "text-white/40 hover:text-white"}`}
          >
            <ShoppingBagIcon size={16} /> Campus Market
          </button>
          <button
            onClick={() => setFeedType("HUSTLE")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm relative z-10 transition-colors ${feedType === "HUSTLE" ? "text-brand-purple" : "text-white/40 hover:text-white"}`}
          >
            <Briefcase size={16} /> The Hustle
          </button>
        </div>
      </div>

      {/* FEED GRID */}
      <div className="max-w-xl mx-auto space-y-4 pb-24 overflow-hidden">

        {/* CAMPUS FILTER TOGGLE (Sweet Spot) */}
        {!loading && (
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => setCampusFilter('ALL')}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all ${campusFilter === 'ALL' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
            >
              All Campuses
            </button>
            <div className="w-px h-4 bg-white/10"></div>
            <button
              onClick={() => setCampusFilter('MY_CAMPUS')}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all flex items-center gap-2 ${campusFilter === 'MY_CAMPUS' ? 'bg-white text-black' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
            >
              <MapPin size={12} /> My Campus
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mb-4"></div>
            <p className="text-white/40 text-sm">Loading campus vibe...</p>
          </div>
        ) : gigs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 space-y-4"
          >
            <div className={`w-20 h-20 mx-auto rounded-full ${themeBg} flex items-center justify-center mb-4`}>
              <Search size={32} className={themeColor} />
            </div>
            <h3 className="text-xl font-bold text-white">No {feedType === 'MARKET' ? 'items' : 'gigs'} found {campusFilter === 'MY_CAMPUS' && 'at your campus'}</h3>
            <p className="text-white/40 text-sm max-w-xs mx-auto">
              {campusFilter === 'MY_CAMPUS'
                ? "Be the first to post something for your college!"
                : "Students are waiting for something cool."}
            </p>
            <button
              onClick={() => router.push('/post')}
              className={`px-6 py-3 rounded-xl font-bold text-white ${feedType === 'MARKET' ? 'bg-pink-500 hover:bg-pink-400' : 'bg-brand-purple hover:bg-brand-purple/90'} transition-colors shadow-lg`}
            >
              Post Now
            </button>
          </motion.div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 mx-auto pb-20">
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
                    {/* Image Aspect Square */}
                    <div className="w-full aspect-square bg-[#121217] relative overflow-hidden">
                      {gig.images && gig.images[0] ? (
                        <Image
                          src={supabase.storage.from("gig-images").getPublicUrl(gig.images[0]).data.publicUrl}
                          alt={gig.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="(max-width: 768px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10">
                          {gig.listing_type === "MARKET" ? <ShoppingBagIcon size={32} className="text-white/20" /> : <Briefcase size={32} className="text-white/20" />}
                        </div>
                      )}

                      {/* Overlay Badge (Bottom Left) */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 z-10 max-w-[85%]">
                        {gig.poster?.avatar_url ? (
                          <Image src={gig.poster.avatar_url} alt="Poster" width={16} height={16} className="rounded-full" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-brand-purple flex items-center justify-center text-[8px] font-bold text-white">
                            {gig.poster?.name?.[0] || "U"}
                          </div>
                        )}

                        <div className="flex items-center gap-0.5 text-[10px] font-bold text-white">
                          <span className="truncate max-w-[50px]">{gig.poster?.name || "User"}</span>
                          <span className="text-white/40">•</span>
                          <Star size={8} className="text-yellow-500 fill-current" />
                          <span>{gig.poster?.rating?.toFixed(1) || "New"}</span>
                        </div>
                      </div>

                      {/* Price Tag (Top Right) */}
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-lg border border-white/10 text-xs font-bold text-white shadow-lg">
                        <IndianRupee size={10} className="inline mr-0.5" />
                        {gig.price}
                      </div>
                    </div>

                    {/* Compact Content */}
                    <div className="p-3">
                      <h3 className="text-sm font-bold text-white mb-1 leading-tight line-clamp-2 group-hover:text-brand-purple transition-colors">
                        {gig.title}
                      </h3>
                      <div className="flex items-center justify-between text-[10px] text-white/40 mt-2">
                        <span className="flex items-center gap-1 truncate max-w-[60%]">
                          <MapPin size={10} /> {gig.location || "Campus"}
                        </span>
                        <span className="font-mono">
                          {new Date(gig.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

    </div>
  );
}