"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import { MapPin, Clock, IndianRupee, Briefcase, Search, ShoppingBag as ShoppingBagIcon, Sparkles } from "lucide-react";
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

  useEffect(() => {
    const loadGigs = async () => {
      try {
        setLoading(true);

        const nowIso = new Date().toISOString();
        let query = supabase
          .from("gigs")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false });

        if (feedType === "HUSTLE") {
          query = query.eq("listing_type", "HUSTLE").or(`deadline.is.null,deadline.gt.${nowIso}`);
        } else {
          query = query.eq("listing_type", "MARKET");
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
  }, [supabase, feedType]);

  const themeColor = feedType === "MARKET" ? "text-pink-400" : "text-brand-purple";
  const themeBorder = feedType === "MARKET" ? "border-pink-500/20" : "border-brand-purple/20";
  const themeBg = feedType === "MARKET" ? "bg-pink-500/10" : "bg-brand-purple/10";

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-4 md:p-6 relative selection:bg-brand-purple overflow-x-hidden">
      <BackgroundBlobs theme={feedType} />

      {/* HEADER & TOGGLE */}
      <div className="max-w-xl mx-auto mb-8 sticky top-0 z-20 bg-[#0B0B11]/80 backdrop-blur-xl py-4 -mx-4 px-4 md:mx-auto md:px-0 md:rounded-b-3xl border-b border-white/5 md:border-none">
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
            <h3 className="text-xl font-bold text-white">No {feedType === 'MARKET' ? 'items' : 'gigs'} found</h3>
            <p className="text-white/40 text-sm max-w-xs mx-auto">Be the first to post! Students are waiting for something cool.</p>
            <button
              onClick={() => router.push('/post')}
              className={`px-6 py-3 rounded-xl font-bold text-white ${feedType === 'MARKET' ? 'bg-pink-500 hover:bg-pink-400' : 'bg-brand-purple hover:bg-brand-purple/90'} transition-colors shadow-lg`}
            >
              Post Now
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {gigs.map((gig, index) => (
              <motion.div
                key={gig.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                layout
                onClick={() => router.push(`/gig/${gig.id}`)}
                className="bg-[#1A1A24] border border-white/5 rounded-3xl p-4 active:scale-[0.98] transition-transform cursor-pointer hover:border-white/10 group relative overflow-hidden"
              >
                {/* Card Glow */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 ${feedType === 'MARKET' ? 'bg-gradient-to-tr from-pink-500/20 to-transparent' : 'bg-gradient-to-tr from-brand-purple/20 to-transparent'}`}></div>

                <div className="flex gap-4">
                  {/* Image Thumbnail */}
                  <div className="w-24 h-24 rounded-2xl bg-zinc-800 flex-shrink-0 relative overflow-hidden">
                    {imageUrls[gig.id] ? (
                      <Image src={imageUrls[gig.id]} alt={gig.title} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        {feedType === 'MARKET' ? <ShoppingBagIcon size={24} /> : <Briefcase size={24} />}
                      </div>
                    )}
                    {feedType === 'MARKET' && gig.market_type === 'RENT' && (
                      <div className="absolute top-0 left-0 bg-blue-500 text-[9px] font-bold px-1.5 py-0.5 rounded-br-lg text-white">RENT</div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <h3 className="font-bold text-white leading-tight mb-1 line-clamp-2 group-hover:text-blue-200 transition-colors">{gig.title}</h3>
                      <div className="flex items-center gap-3 text-[11px] text-white/40">
                        <div className="flex items-center gap-1">
                          <MapPin size={10} />
                          <span>Campus</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          <span>{timeAgo(gig.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className={`text-lg font-mono font-bold flex items-center ${feedType === 'MARKET' ? 'text-pink-400' : 'text-brand-purple'}`}>
                        <IndianRupee size={14} className="mt-0.5" />
                        {gig.price}
                        {feedType === 'MARKET' && gig.market_type === 'RENT' && <span className="text-[10px] text-white/40 ml-1 font-sans font-normal">/ day</span>}
                      </div>

                      <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors text-white/40 group-hover:text-white">
                        <Sparkles size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

    </div>
  );
}