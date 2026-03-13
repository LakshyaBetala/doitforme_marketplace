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
  Clock,
  CheckCircle2,
  XCircle,
  Hourglass,
  IndianRupee,
  ArrowUpRight,
  Send,
  ShoppingBag
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

export default function ActivityHubPage() {
  const supabase = supabaseBrowser();

  // States
  const [activeTab, setActiveMainTab] = useState<'POSTS' | 'APPLICATIONS'>('POSTS');
  const [subFilter, setSubFilter] = useState<'ALL' | 'HUSTLE' | 'MARKET'>('ALL');

  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch Posts created by User
        const { data: postsData, error: postsError } = await supabase
          .from("gigs")
          .select("*")
          .eq("poster_id", user.id)
          .order("created_at", { ascending: false });

        if (postsError) throw postsError;
        setMyPosts(postsData || []);

        // 2. Fetch Applications made by User
        const { data: appsData, error: appsError } = await supabase
          .from("applications")
          .select(`*, gigs (id, title, price, location, status, created_at, listing_type, market_type)`)
          .eq("worker_id", user.id)
          .order("created_at", { ascending: false });

        if (appsError) throw appsError;
        setMyApplications(appsData || []);

      } catch (err: any) {
        console.error("Error loading activity:", err);
        setError(err.message || "Failed to load activity data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  // Derived Data
  const filteredPosts = myPosts.filter(gig => {
    if (subFilter === 'ALL') return true;
    if (subFilter === 'HUSTLE') return gig.listing_type !== 'MARKET';
    if (subFilter === 'MARKET') return gig.listing_type === 'MARKET';
    return true;
  });

  // Helpers
  const getStatusDot = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]';
      case 'assigned': return 'bg-brand-purple shadow-[0_0_10px_rgba(136,37,245,0.6)]';
      case 'delivered': return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)]';
      case 'completed': return 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.6)]';
      case 'cancelled': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]';
      default: return 'bg-zinc-500';
    }
  };

  const getAppStatusBadge = (status: string, gigStatus?: string) => {
    if (gigStatus?.toLowerCase() === 'completed') {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-black uppercase tracking-widest">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </span>
      );
    }
    switch (status) {
      case "accepted":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest">
            <CheckCircle2 className="w-3 h-3" /> Hired / Accepted
          </span>
        );
      case "rejected":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-widest">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-black uppercase tracking-widest">
            <Hourglass className="w-3 h-3 animate-pulse" /> Pending
          </span>
        );
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
    <div className="min-h-screen bg-[#070B1A] text-white selection:bg-brand-purple selection:text-white pb-24">
      {/* Antigravity Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 flex justify-center">
        <div className="absolute top-[-10%] w-[800px] h-[500px] bg-brand-purple/5 blur-[150px] rounded-full"></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10 p-4 md:p-8 lg:p-12 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <Link href="/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-3 group text-sm font-medium">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Activity Hub</h1>
            <p className="text-sm text-zinc-400 mt-2">Manage everything you post and everywhere you apply.</p>
          </div>
          <Link
            href="/post"
            className="px-6 py-3.5 bg-white hover:bg-zinc-200 text-black font-black rounded-2xl active:scale-95 transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)]"
          >
            <Plus className="w-5 h-5" /> Post New
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 flex items-center gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Floating Toggle Tabs */}
        <div className="bg-[#0F172A]/80 backdrop-blur-xl border border-[#1E293B] p-1.5 rounded-2xl inline-flex w-full md:w-auto relative shadow-2xl">
          <button
            onClick={() => setActiveMainTab('POSTS')}
            className={`flex-1 md:w-48 py-2.5 text-sm font-bold rounded-xl transition-all z-10 ${activeTab === 'POSTS' ? 'text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            My Posts ({myPosts.length})
          </button>
          <button
            onClick={() => setActiveMainTab('APPLICATIONS')}
            className={`flex-1 md:w-48 py-2.5 text-sm font-bold rounded-xl transition-all z-10 ${activeTab === 'APPLICATIONS' ? 'text-white shadow-md' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Applications ({myApplications.length})
          </button>

          {/* Animated Tab Background */}
          <div
            className="absolute top-1.5 bottom-1.5 w-[calc(50%-0.375rem)] md:w-48 bg-[#1E293B] rounded-xl transition-transform duration-300 ease-out border border-white/5 shadow-inner"
            style={{ transform: `translateX(${activeTab === 'POSTS' ? '0' : '100%'})` }}
          />
        </div>

        {/* -------------------- TAB 1: MY POSTS -------------------- */}
        {activeTab === 'POSTS' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Sub Filters */}
            <div className="flex gap-2 mb-6">
              <FilterTab label="All" active={subFilter === 'ALL'} onClick={() => setSubFilter('ALL')} />
              <FilterTab label="Hustles" active={subFilter === 'HUSTLE'} onClick={() => setSubFilter('HUSTLE')} />
              <FilterTab label="Marketplace" active={subFilter === 'MARKET'} onClick={() => setSubFilter('MARKET')} />
            </div>

            {filteredPosts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredPosts.map((gig, idx) => (
                  <PostCard key={gig.id} gig={gig} getStatusDot={getStatusDot} delay={idx * 50} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Briefcase}
                title="No active posts found"
                desc="Start by posting your first hustle or marketplace item to the campus."
                actionLink="/post"
                actionText="Create Listing"
              />
            )}
          </div>
        )}

        {/* -------------------- TAB 2: MY APPLICATIONS -------------------- */}
        {activeTab === 'APPLICATIONS' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {myApplications.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myApplications.map((app, idx) => {
                  const gig = app.gigs;
                  if (!gig) return null;
                  return (
                    <ApplicationCard
                      key={app.id}
                      app={app}
                      gig={gig}
                      getAppStatusBadge={getAppStatusBadge}
                      delay={idx * 50}
                    />
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Send}
                title="No applications yet"
                desc="You haven't applied to any gigs or made offers on items yet. Explore the feed!"
                actionLink="/feed"
                actionText="Browse Marketplace"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponents

function FilterTab({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${active ? 'bg-brand-purple text-white shadow-[0_0_15px_rgba(136,37,245,0.3)]' : 'bg-[#0F172A] border border-[#1E293B] text-zinc-400 hover:text-white hover:border-zinc-600'}`}>
      {label}
    </button>
  );
}

function PostCard({ gig, getStatusDot, delay }: { gig: any, getStatusDot: any, delay: number }) {
  const isMarket = gig.listing_type === 'MARKET';
  const isRent = gig.market_type === 'RENT';

  return (
    <Link
      href={`/gig/${gig.id}`}
      className="bg-[#0F172A] border border-[#1E293B] rounded-[24px] p-6 flex flex-col group hover:border-brand-purple/50 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(136,37,245,0.2)] transition-all h-[190px] relative overflow-hidden fill-mode-both animate-in fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start mb-3 relative z-10">
        <h3 className="font-bold text-white text-[16px] leading-tight group-hover:text-brand-purple transition-colors line-clamp-2 pr-4">{gig.title}</h3>
        <div className="flex items-center gap-1.5 shrink-0 bg-[#1A2235] px-2 py-1 rounded-full border border-white/5">
          <span className={`w-2 h-2 rounded-full ${getStatusDot(gig.status)}`}></span>
          <span className="text-[9px] text-white/70 uppercase tracking-widest font-bold">{gig.status}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-auto relative z-10 mt-1">
        <span className="text-lg font-black text-brand-purple">₹{Number(gig.price).toLocaleString()}</span>
        {isMarket && isRent && <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">/day</span>}
        {isMarket && (
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${isRent ? 'text-brand-purple border-brand-purple/20 bg-brand-purple/10' : 'text-brand-pink border-brand-pink/20 bg-brand-pink/10'}`}>
            {isRent ? 'RENT' : 'SELL'}
          </span>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-[#1E293B] flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
          <span className="flex items-center gap-1"><Clock size={12} className="text-zinc-600" /> {timeAgo(gig.created_at)}</span>
        </div>
        <span className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-1 group-hover:text-brand-purple transition-colors">
          Manage <ArrowUpRight size={12} />
        </span>
      </div>
    </Link>
  );
}

function ApplicationCard({ app, gig, getAppStatusBadge, delay }: { app: any, gig: any, getAppStatusBadge: any, delay: number }) {
  const isMarket = gig.listing_type === 'MARKET';

  return (
    <Link
      href={`/gig/${gig.id}`}
      className="group bg-[#0F172A] border border-[#1E293B] rounded-[24px] p-6 hover:border-brand-pink/40 transition-all hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(236,72,153,0.15)] overflow-hidden min-h-[190px] flex flex-col fill-mode-both animate-in fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 bg-[#1E293B] rounded-xl border border-white/5 text-brand-pink group-hover:scale-110 transition-transform shadow-inner">
          {isMarket ? <ShoppingBag className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
        </div>
        {getAppStatusBadge(app.status, gig.status)}
      </div>

      <h3 className="text-[16px] font-bold text-white mb-2 line-clamp-2 group-hover:text-brand-pink transition-colors">
        {gig.title}
      </h3>

      <div className="flex items-center gap-2 text-zinc-400 text-sm mt-auto pb-1">
        <IndianRupee className="w-4 h-4" />
        <span className="font-black text-white text-lg">{gig.price?.toLocaleString()}</span>
      </div>

      <div className="pt-4 mt-3 border-t border-[#1E293B] flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {timeAgo(app.created_at)}
        </span>
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white group-hover:text-brand-pink transition-colors">
          View Gig <ArrowUpRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ icon: Icon, title, desc, actionLink, actionText }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-[#0F172A]/50 border border-[#1E293B] rounded-[32px] backdrop-blur-sm">
      <div className="w-24 h-24 bg-[#1E293B] rounded-[24px] rotate-3 flex items-center justify-center mb-6 shadow-inner border border-white/5">
        <Icon className="w-10 h-10 text-brand-purple -rotate-3 drop-shadow-lg" />
      </div>
      <h2 className="text-2xl font-black text-white mb-2">{title}</h2>
      <p className="text-zinc-400 max-w-sm mb-8 text-sm leading-relaxed">{desc}</p>
      <Link
        href={actionLink}
        className="px-8 py-4 bg-white text-black font-black rounded-xl hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95 flex items-center gap-2"
      >
        {actionText} <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
