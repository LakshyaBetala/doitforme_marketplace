"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Loader2,
  MapPin,
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

  const getStatusDot = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-green-500';
      case 'assigned': return 'bg-blue-500';
      case 'completed': return 'bg-teal-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B1A] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B1A] text-white selection:bg-brand-purple selection:text-white">

      {/* Background glow */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[20%] w-[500px] h-[500px] bg-brand-purple/5 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 p-6 lg:p-12 pb-24 space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <Link href="/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-3 group text-sm font-medium">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">My Hustles</h1>
            <p className="text-sm text-zinc-400 mt-1">Manage your posted gigs and marketplace listings</p>
          </div>
          <Link
            href="/post"
            className="px-6 py-3 bg-gradient-to-r from-brand-purple to-brand-pink text-white font-bold rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(136,37,245,0.3)]"
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

        {/* Feed Section */}
        <section>
          {/* Sticky Header + Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sticky top-0 bg-[#070B1A]/90 backdrop-blur-md py-4 z-20">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2 mb-1">
                Your Listings <span className="text-sm font-bold text-zinc-500">({filteredGigs.length})</span>
              </h2>
              <p className="text-xs text-zinc-400 font-medium">All your posted hustles and marketplace items</p>
            </div>

            <div className="flex items-center gap-2">
              <FilterTab label="All" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
              <FilterTab label="Hustles" active={filter === 'HUSTLE'} onClick={() => setFilter('HUSTLE')} />
              <FilterTab label="Marketplace" active={filter === 'MARKET'} onClick={() => setFilter('MARKET')} />
            </div>
          </div>

          {filteredGigs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredGigs.map((gig: any, index: number) => {
                const isMarket = gig.listing_type === 'MARKET';
                const isRent = gig.market_type === 'RENT';
                const delay = `${index * 50}ms`;

                return (
                  <div
                    key={gig.id}
                    className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 flex flex-col group hover:border-[#334155] hover:-translate-y-1 hover:shadow-xl transition-all h-[170px] relative overflow-hidden"
                    style={{ animationDelay: delay }}
                  >
                    {/* Title + Status */}
                    <div className="flex justify-between items-start mb-2 relative z-10">
                      <h3 className="font-bold text-white text-[15px] leading-snug group-hover:text-brand-purple transition-colors line-clamp-2 pr-4">{gig.title}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`w-2 h-2 rounded-full ${getStatusDot(gig.status)}`}></span>
                        <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold">{gig.status}</span>
                      </div>
                    </div>

                    {/* Price + Type */}
                    <div className="flex items-center gap-2 mb-auto relative z-10">
                      <span className="text-xs font-black text-brand-purple">₹{Number(gig.price).toLocaleString()}</span>
                      {isMarket && isRent && <span className="text-[10px] text-zinc-500">/rental</span>}
                      {isMarket && (
                        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${isRent ? 'text-brand-purple border-brand-purple/20 bg-brand-purple/10' : 'text-green-400 border-green-500/20 bg-green-500/10'}`}>
                          {isRent ? 'RENT' : 'SELL'}
                        </span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-3 border-t border-[#1E293B] flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-1"><MapPin size={10} className="text-zinc-600" /> {gig.location || "Campus"}</span>
                        <span className="flex items-center gap-1"><Clock size={10} className="text-zinc-600" /> {timeAgo(gig.created_at)}</span>
                      </div>
                      <Link href={`/gig/${gig.id}`} className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider hover:bg-brand-purple hover:border-brand-purple transition-colors">
                        Manage
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* EMPTY STATE */
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-[#0F172A] border border-[#1E293B] rounded-3xl">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Briefcase className="w-10 h-10 text-zinc-600" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">No active items found</h2>
              <p className="text-zinc-400 max-w-md mb-8 text-sm">
                Start by posting your first gig or listing an item.
              </p>
              <Link
                href="/post"
                className="px-8 py-4 bg-gradient-to-r from-brand-purple to-brand-pink text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-[0_0_20px_rgba(136,37,245,0.3)] active:scale-95"
              >
                Post New
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* MOBILE FAB */}
      <Link
        href="/post"
        className="md:hidden fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-r from-brand-purple to-brand-pink text-white rounded-full shadow-2xl shadow-brand-purple/30 flex items-center justify-center active:scale-90 transition-transform"
      >
        <Plus size={28} strokeWidth={2.5} />
      </Link>
    </div>
  );
}

function FilterTab({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${active ? 'bg-[#1E293B] text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}>
      {label}
    </button>
  );
}