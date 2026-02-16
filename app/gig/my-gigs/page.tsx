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
  AlertCircle,
  Clock
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

export default function MyGigsPage() {
  const supabase = supabaseBrowser();
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'HUSTLE' | 'MARKET'>('ALL');

  const filteredGigs = gigs.filter(gig => {
    if (filter === 'ALL') return true;
    if (filter === 'HUSTLE') return gig.listing_type !== 'MARKET';
    if (filter === 'MARKET') return gig.listing_type === 'MARKET';
    return true;
  });

  useEffect(() => {
    const loadGigs = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch Gigs by Poster ID
        const { data, error: fetchError } = await supabase
          .from("gigs")
          .select("*")
          .eq("poster_id", user.id)
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
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

  // Helper for Status Colors
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-green-500/10 border-green-500/20 text-green-400';
      case 'assigned': return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'completed': return 'bg-teal-500/10 border-teal-500/20 text-teal-400';
      case 'cancelled': return 'bg-red-500/10 border-red-500/20 text-red-400';
      default: return 'bg-white/5 border-white/10 text-white/50';
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
            href="/post"
            className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            <Plus className="w-5 h-5" /> Post Hustle / Item
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
        <div>
          {/* TABS */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filter === 'ALL' ? 'bg-white text-black' : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white'
                }`}
            >
              All Posts
            </button>
            <button
              onClick={() => setFilter('HUSTLE')}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filter === 'HUSTLE' ? 'bg-brand-purple text-white' : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white'
                }`}
            >
              Hustle Gigs
            </button>
            <button
              onClick={() => setFilter('MARKET')}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filter === 'MARKET' ? 'bg-brand-pink text-white' : 'bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-white'
                }`}
            >
              Marketplace
            </button>
          </div>

          {filteredGigs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGigs.map((gig: any) => {
                const isMarket = gig.listing_type === 'MARKET';
                const isRent = gig.market_type === 'RENT';

                return (
                  <Link
                    key={gig.id}
                    href={`/gig/${gig.id}`}
                    className="group relative bg-[#121217] border border-white/10 rounded-3xl p-6 hover:border-brand-purple/30 transition-all hover:-translate-y-1 overflow-hidden"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br from-brand-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity ${isMarket ? 'from-brand-pink/5' : ''}`}></div>

                    <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                      <div>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-2">
                            {isMarket && (
                              <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${isRent ? 'bg-brand-purple/10 border-brand-purple/20 text-brand-purple' : 'bg-green-500/10 border-green-500/20 text-green-500'
                                }`}>
                                {isRent ? 'RENT' : 'SELL'}
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusColor(gig.status)}`}>
                              {gig.status}
                            </span>
                          </div>
                          <span className="text-white/40 text-xs font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {timeAgo(gig.created_at)}
                          </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-brand-purple transition-colors">
                          {gig.title}
                        </h3>

                        <div className="flex flex-col gap-2 text-sm text-white/60">
                          <div className="flex items-center gap-1.5">
                            <IndianRupee className="w-4 h-4 text-white/40" />
                            <span className="text-white font-bold">{Number(gig.price).toLocaleString()}</span>
                            {isRent && <span className="text-[10px] uppercase tracking-widest text-white/40">/ Rental Fee</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-white/40" />
                            <span>{gig.location || "Remote"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs font-medium text-white/40">
                        <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                          <Briefcase className="w-3 h-3" /> Manage {isMarket ? 'Item' : 'Gig'}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[#121217] border border-white/10 rounded-[40px]">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Briefcase className="w-10 h-10 text-white/20" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">No active items found</h2>
              <p className="text-white/50 max-w-md mb-8">
                Start by posting your first gig or listing an item.
              </p>
              <Link
                href="/post"
                className="px-8 py-4 bg-brand-purple text-white font-bold rounded-xl hover:bg-brand-purple/80 transition-colors shadow-lg shadow-brand-purple/20"
              >
                Post New
              </Link>
            </div>
          )}
        </div>
      </div>
      {/* MOBILE FAB */}
      <Link
        href="/post"
        className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-white text-black rounded-full shadow-2xl shadow-white/20 flex items-center justify-center active:scale-90 transition-transform"
      >
        <Plus size={28} strokeWidth={2.5} />
      </Link>
    </div>
  );
}