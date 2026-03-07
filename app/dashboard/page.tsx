"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Plus, Briefcase, Search, MapPin, MessageSquare, User,
  Home, ShoppingBag, Inbox, Star, Settings, LogOut, Bell, ChevronDown, CheckCircle2,
  DollarSign, ArrowRight, Zap, ShieldCheck, AlertTriangle, X, Gift, Copy, Clock, Filter, Tags
} from "lucide-react";

export default function Dashboard() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedType, setFeedType] = useState<'ALL' | 'HUSTLE' | 'MARKET'>('ALL');
  const [campusFilter, setCampusFilter] = useState<'ALL' | 'MY_CAMPUS'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // User Preferences Onboarding
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

  // Referral state
  const [referralCode, setReferralCode] = useState("");
  const [pointsBalance, setPointsBalance] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [activePoints, setActivePoints] = useState<any[]>([]);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    const loadUserAndGigs = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: dbUser } = await supabase.from("users").select("*").eq("id", authUser.id).single();
        setUser({ ...authUser, user_metadata: { ...authUser.user_metadata, ...dbUser } });

        // Show preferences modal if KYC verified but no preferences
        if (dbUser?.kyc_verified && (!dbUser?.preferences || dbUser.preferences.length === 0)) {
          setShowPreferencesModal(true);
        }

        // Load Feed
        const nowIso = new Date().toISOString();
        let query = supabase
          .from("gigs")
          .select("*, users:poster_id(college, name, rating, rating_count)")
          .neq("poster_id", authUser.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(20);

        query = query.or(`deadline.is.null,deadline.gt.${nowIso}`);
        const { data: gigsData } = await query;
        setGigs(gigsData || []);

        // Fetch referral data
        if (dbUser?.referral_code) {
          setReferralCode(dbUser.referral_code);
        }
        setPointsBalance(dbUser?.points_balance || 0);

        // Fetch referral count
        const { data: refs } = await supabase
          .from("referrals")
          .select("id")
          .eq("referrer_id", authUser.id);
        setReferralCount(refs?.length || 0);

        // Fetch active (non-expired) points
        const { data: pts } = await supabase
          .from("points_transactions")
          .select("amount, expires_at, reason")
          .eq("user_id", authUser.id)
          .eq("type", "EARN")
          .eq("redeemed", false)
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: true });
        setActivePoints(pts || []);
      }
      setLoading(false);
    };
    loadUserAndGigs();
  }, [router, supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const filteredGigs = gigs.filter(gig => {
    const matchesSearch = gig.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      gig.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = feedType === 'ALL' || gig.listing_type === feedType;
    const matchesCampus = campusFilter === 'ALL'
      ? true
      : (!gig.is_physical || gig.users?.college === user?.user_metadata?.college);
    const matchesCategory = categoryFilter === 'ALL' || gig.category === categoryFilter;
    return matchesSearch && matchesType && matchesCampus && matchesCategory;
  }).sort((a, b) => {
    const aHighlighted = a.is_highlighted && a.highlight_expires_at && new Date(a.highlight_expires_at) > new Date();
    const bHighlighted = b.is_highlighted && b.highlight_expires_at && new Date(b.highlight_expires_at) > new Date();
    if (aHighlighted && !bHighlighted) return -1;
    if (!aHighlighted && bHighlighted) return 1;
    return 0;
  });

  // Dynamic opportunity counts (computed from ALL gigs, ignoring search/type filters)
  const hustleCount = gigs.filter(g => g.listing_type === 'HUSTLE').length;
  const marketCount = gigs.filter(g => g.listing_type === 'MARKET').length;

  const handleFeedTypeChange = (type: 'ALL' | 'HUSTLE' | 'MARKET') => {
    setFeedType(type);
    setCategoryFilter('ALL'); // Reset category filter when switching tabs
  };

  const activeCategories = Array.from(new Set([
    ...(feedType === 'ALL' || feedType === 'HUSTLE' ? ["Tech & Engineering", "Design & Creative", "Science & Medical", "Law & Humanities", "Commerce & Finance", "Academics & Projects", "Errands & Manual Labor", "Writing & Content", "Tutoring", "Other"] : []),
    ...(feedType === 'ALL' || feedType === 'MARKET' ? ["Electronics", "Furniture", "Books & Study Material", "Vehicles", "Fashion & Clothing", "Appliances", "Accessories", "Sports & Fitness", "Subscriptions & Tickets", "Other"] : [])
  ]));

  const username = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Partner";
  const [profileAlertDismissed, setProfileAlertDismissed] = useState(false);

  // Detect missing profile fields
  const missingFields: string[] = [];
  if (user) {
    const meta = user.user_metadata || {};
    if (!meta.name && !meta.full_name) missingFields.push("Name");
    if (!meta.phone) missingFields.push("Phone");
    if (!meta.college) missingFields.push("College");
    if (!meta.upi_id) missingFields.push("UPI ID");
  }
  const showProfileAlert = missingFields.length > 0 && !profileAlertDismissed;

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="h-[100dvh] bg-[#070B1A] text-white flex flex-col font-sans overflow-hidden">
      {/* --------------------------------------------------
          1. TOP BAR (Global Navigation)
      -------------------------------------------------- */}
      <header className="h-[70px] md:h-[80px] bg-gradient-to-r from-[#0B1021] to-[#070B1A] border-b border-[#1E293B] flex items-center justify-between px-4 md:px-6 shrink-0 z-50">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-lg overflow-hidden flex items-center justify-center">
              <Image src="/Doitforme_logo.png" alt="DoItForMe" fill className="object-contain" />
            </div>
            <span className="font-black text-xl italic tracking-tighter hidden md:block group-hover:text-brand-purple transition-colors">DoItForMe</span>
          </Link>

          {/* Search Bar */}
          <div className="hidden lg:flex relative w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search tasks, items, or students"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0F172A] border border-[#1E293B] rounded-full py-2 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-brand-purple/50 focus:outline-none transition-colors shadow-inner"
            />
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-3 md:gap-4 relative">

          <Link href="/profile#refer" className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-brand-purple/20 border border-brand-purple/30 rounded-lg shadow-sm hover:bg-brand-purple/30 transition-colors">
            <Gift size={14} className="text-brand-purple" />
            <span className="text-xs font-bold text-brand-purple uppercase tracking-widest mt-0.5">Refer & Earn</span>
          </Link>

          <button onClick={() => router.push('/messages')} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors relative group">
            <MessageSquare size={18} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-brand-purple rounded-full"></div>
          </button>

          <div className="h-6 w-px bg-[#1E293B] mx-1 md:mx-2"></div>

          {/* Profile Dropdown */}
          <div className="relative">
            <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-[#1E293B] bg-white/5 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8825F5] to-[#EC4899] flex items-center justify-center text-sm font-bold shadow-inner">
                {username[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium hidden md:block">{username}</span>
              <ChevronDown size={14} className="text-zinc-500" />
            </button>

            {isProfileDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden py-1 z-50">
                <Link href="/profile" className="flex items-center px-4 py-2 hover:bg-white/5 text-sm text-zinc-300 hover:text-white"><User size={14} className="mr-3" /> Profile</Link>
                <div className="h-px bg-[#1E293B] my-1"></div>
                <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 hover:bg-red-500/10 text-sm text-red-400 transition-colors">
                  <LogOut size={14} className="mr-3" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">



        {/* --------------------------------------------------
            3. MAIN CONTENT AREA (Core Zone)
        -------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto bg-[#070B1A] scrollbar-hide relative">
          <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24 md:pb-8">

            {/* Profile Completion Alert */}
            {showProfileAlert && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 relative animate-in fade-in slide-in-from-top-4 duration-500">
                <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-300 mb-1">Complete your profile</p>
                  <p className="text-xs text-amber-300/70">Missing: {missingFields.join(", ")}. Add these details to start posting and applying.</p>
                </div>
                <Link href="/profile" className="shrink-0 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl hover:bg-amber-500/30 transition-all active:scale-95">
                  Complete Profile
                </Link>
                <button onClick={() => setProfileAlertDismissed(true)} className="shrink-0 p-1 text-amber-400/50 hover:text-amber-300 transition-colors">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* KYC Verification Prompt */}
            {user && !user.user_metadata?.kyc_verified && (
              <Link href="/verify-id" className="block bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex items-center gap-3 relative animate-in fade-in slide-in-from-top-4 duration-500 group hover:bg-yellow-500/15 transition-all active:scale-[0.99]">
                <div className="p-2 bg-yellow-500/20 rounded-xl shrink-0">
                  <ShieldCheck size={20} className="text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-yellow-300 mb-0.5">Verify your Student ID</p>
                  <p className="text-xs text-yellow-300/60">Upload your college ID to unlock all features and build trust.</p>
                </div>
                <span className="shrink-0 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 text-xs font-bold rounded-xl group-hover:bg-yellow-500/30 transition-all">
                  Verify Now
                </span>
              </Link>
            )}

            {/* Layer 1: Welcome + Identity */}
            <section className="bg-[#0F172A] border border-[#1E293B] rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between relative overflow-hidden group mb-4">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-purple/10 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="relative z-10 w-full md:w-auto mb-4 md:mb-0">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-tight mb-1">Good afternoon, {username.split(' ')[0]}.</h1>
                <p className="text-zinc-400 text-xs md:text-sm">Here’s what’s happening on your campus today.</p>
              </div>
              <div className="hidden md:flex relative z-10 items-center justify-end">
                <div className="bg-[#1E293B]/30 border border-[#334155] rounded-2xl px-5 py-3 backdrop-blur-md flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-brand-purple font-black uppercase tracking-widest mb-1 shadow-sm flex items-center gap-1.5"><Zap size={10} className="fill-brand-purple" /> Opportunities</p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-xl font-black text-white">{hustleCount}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase ml-1.5">Hustles</span>
                    </div>
                    <div className="w-px h-6 bg-[#334155] self-center"></div>
                    <div>
                      <span className="text-xl font-black text-white">{marketCount}</span>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase ml-1.5">Items</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Layer 2: Quick Action Bar */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/post" className="flex flex-col items-center justify-center py-6 px-4 bg-[#0F172A] border border-[#1E293B] text-white rounded-2xl hover:bg-[#1E293B]/50 hover:border-brand-purple/50 active:scale-95 group hover:-translate-y-1 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(136,37,245,0.15)]">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-brand-purple/20 transition-all">
                  <Plus size={24} className="text-zinc-400 group-hover:text-brand-purple transition-colors" />
                </div>
                <span className="font-black tracking-wide text-zinc-300 group-hover:text-white transition-colors">Post Hustle</span>
              </Link>
              <Link href="/post?type=market" className="flex flex-col items-center justify-center py-6 px-4 bg-gradient-to-r from-brand-purple to-brand-pink text-white rounded-2xl hover:opacity-95 active:scale-95 group hover:-translate-y-1 transition-all shadow-[0_0_20px_rgba(136,37,245,0.2)] hover:shadow-[0_0_30px_rgba(136,37,245,0.6)]">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><ShoppingBag size={24} /></div>
                <span className="font-black tracking-wide">Sell Item</span>
              </Link>
              <Link href="/gig/my-gigs" className="flex flex-col items-center justify-center py-6 px-4 bg-[#0F172A] border border-[#1E293B] text-white rounded-2xl hover:bg-[#1E293B]/50 hover:border-brand-purple/50 active:scale-95 group hover:-translate-y-1 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(136,37,245,0.15)]">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-brand-purple/20 transition-all">
                  <Briefcase size={24} className="text-zinc-400 group-hover:text-brand-purple transition-colors" />
                </div>
                <span className="font-black tracking-wide text-zinc-300 group-hover:text-white transition-colors">My Hustles</span>
              </Link>
            </section>

            {/* Layer 3 removed. Refer & Earn relocated to Profile Page. */}

            {/* Layer 4: Live Feed Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sticky top-0 bg-[#070B1A]/90 backdrop-blur-md py-4 z-20">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2 mb-1">
                    Live Campus Feed <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse hidden sm:inline-block"></span>
                  </h2>
                  <p className="text-xs text-zinc-400 font-medium">See what students need right now</p>
                </div>

                <div className="flex items-center gap-3">
                  {/* Type Filters */}
                  <div className="flex items-center bg-[#0F172A] rounded-full p-1 border border-[#1E293B]">
                    <FeedTab label="All" active={feedType === 'ALL'} onClick={() => handleFeedTypeChange('ALL')} />
                    <FeedTab label="Hustles" active={feedType === 'HUSTLE'} onClick={() => handleFeedTypeChange('HUSTLE')} />
                    <FeedTab label="Marketplace" active={feedType === 'MARKET'} onClick={() => handleFeedTypeChange('MARKET')} />
                  </div>

                  {/* Campus Filter */}
                  <div className="relative">
                    <button
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`p-2 rounded-full border transition-all ${campusFilter === 'MY_CAMPUS' ? 'bg-brand-purple text-white border-brand-purple' : 'border-[#1E293B] hover:bg-white/5 text-zinc-400 hover:text-white'}`}
                    >
                      <Filter size={16} />
                    </button>
                    {isFilterOpen && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
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

                  {/* Category Filter - only visible when a specific feed type is selected */}
                  {feedType !== 'ALL' && (
                    <div className="relative">
                      <button
                        onClick={() => setIsCategoryFilterOpen(!isCategoryFilterOpen)}
                        className={`p-2 rounded-full border transition-all ${categoryFilter !== 'ALL' ? 'bg-brand-pink text-white border-brand-pink' : 'border-[#1E293B] hover:bg-white/5 text-zinc-400 hover:text-white'}`}
                        title="Filter by Category"
                      >
                        <Tags size={16} />
                      </button>
                      {isCategoryFilterOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 max-h-[300px] overflow-y-auto">
                          <div className="p-2 space-y-1">
                            <button
                              onClick={() => { setCategoryFilter('ALL'); setIsCategoryFilterOpen(false); }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between ${categoryFilter === 'ALL' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                            >
                              All Categories
                              {categoryFilter === 'ALL' && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
                            </button>
                            {activeCategories.map(cat => (
                              <button
                                key={cat}
                                onClick={() => { setCategoryFilter(cat); setIsCategoryFilterOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-between ${categoryFilter === cat ? 'bg-brand-pink/20 text-brand-pink' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}
                              >
                                {cat}
                                {categoryFilter === cat && <div className="w-1.5 h-1.5 rounded-full bg-brand-pink"></div>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {filteredGigs.length === 0 ? (
                <div className="text-center py-20 bg-[#0F172A] border border-[#1E293B] rounded-3xl">
                  <Search size={32} className="mx-auto text-zinc-600 mb-4" />
                  <p className="text-zinc-400 font-medium">No live items found right now.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredGigs.map((gig: any, index: number) => (
                    <FeedCard key={gig.id} gig={gig} index={index} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>

        {/* Right panel removed */}
        {false && (
          <aside className="hidden xl:flex flex-col w-[300px] shrink-0 bg-[#0A0F1A] border-l border-[#1E293B] overflow-y-auto p-6">

            {/* Section A: Earnings & Escrow Summary */}
            <div className="mb-8">
              <h3 className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-3 px-1">Vault</h3>
              <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 hover:border-brand-purple/30 transition-colors mb-3 group hover:-translate-y-1 hover:shadow-xl transition-all">
                <span className="text-xs text-zinc-400 font-bold block mb-1">Total Earned</span>
                <div className="text-3xl font-black text-white mb-4 tracking-tight">₹{user?.user_metadata?.total_earned || 0}</div>
                <button className="w-full py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-all active:scale-95 border border-white/10 flex items-center justify-center gap-2 group-hover:bg-brand-purple/10 group-hover:text-brand-purple group-hover:border-brand-purple/30">
                  Withdraw <ArrowRight size={14} />
                </button>
              </div>

              {/* Added Escrow to Right panel to maximize trust */}
              <div className="bg-gradient-to-r from-brand-purple/10 to-transparent border border-brand-purple/20 rounded-2xl p-4 flex items-center justify-between group hover:-translate-y-0.5 transition-all cursor-default">
                <div>
                  <span className="text-[10px] text-brand-purple font-black uppercase tracking-widest block mb-0.5">Escrow Balance</span>
                  <div className="text-xl font-black text-white">₹0</div>
                </div>
                <ShieldCheck size={24} className="text-brand-purple opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Section B: Active Tasks */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[10px] font-black tracking-widest text-zinc-500 uppercase">Active Tasks</h3>
                <Link href="/gig/my-gigs" className="text-[10px] text-brand-purple uppercase font-bold hover:underline">View All</Link>
              </div>
              <div className="space-y-2">
                <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-3 flex justify-between items-center group cursor-pointer hover:border-brand-purple/50 transition-colors hover:-translate-y-0.5">
                  <div className="flex-1 overflow-hidden pr-2">
                    <h4 className="text-sm text-white font-bold truncate">Logo design</h4>
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> In progress
                    </span>
                  </div>
                </div>
                <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-3 flex justify-between items-center group cursor-pointer hover:border-brand-purple/50 transition-colors hover:-translate-y-0.5">
                  <div className="flex-1 overflow-hidden pr-2">
                    <h4 className="text-sm text-white font-bold truncate">Engineering Math Tutor</h4>
                    <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold flex items-center gap-1.5 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-purple"></span> Assigned
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section C: Latest Notification */}
            <div className="mt-auto">
              <h3 className="text-[10px] font-black tracking-widest text-zinc-500 uppercase mb-3 px-1">Notifications</h3>
              <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-4 relative overflow-hidden group hover:border-blue-500/50 transition-all hover:shadow-lg hover:-translate-y-1">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bell size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-0.5 leading-tight group-hover:text-blue-400 transition-colors">KYC Verification pending</p>
                    <p className="text-xs text-zinc-400">Complete verification via Settings to withdraw your safe earnings.</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        )}

      </div>

      {/* Preferences Modal Component */}
      {showPreferencesModal && (
        <PreferencesModal
          user={user}
          supabase={supabase}
          onClose={() => setShowPreferencesModal(false)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// HELPER COMPONENTS
// ----------------------------------------------------------------------

function SidebarLink({ href, icon: Icon, label, active, badge }: any) {
  return (
    <Link href={href} className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${active ? 'bg-brand-purple/10 text-brand-purple' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>
      <div className="flex items-center gap-3 text-sm font-bold">
        <Icon size={18} className={active ? 'text-brand-purple' : 'text-zinc-500 group-hover:text-white transition-colors'} />
        {label}
      </div>
      {badge && (
        <span className="px-2 py-0.5 rounded-md bg-brand-purple text-white text-[10px] font-black">{badge}</span>
      )}
    </Link>
  );
}

function StatCard({ title, value, icon: Icon, color, bg, subtext, progress }: any) {
  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all h-[150px] flex flex-col justify-between">
      <div className="flex justify-between items-start relative z-10 mb-2">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center ${color} shadow-inner group-hover:scale-110 transition-transform`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="relative z-10 flex-1 flex flex-col justify-end">
        <div className="text-2xl md:text-3xl font-black text-white tracking-tight mb-0.5">{value}</div>
        <div className="text-[10px] md:text-xs uppercase tracking-widest text-zinc-400 font-bold mb-1.5">{title}</div>

        {progress ? (
          <div className="w-full mt-1">
            <div className="flex justify-between items-end mb-1">
              <span className="text-[9px] text-zinc-500 font-medium">Goal: ₹{progress.target.toLocaleString()}</span>
              <span className="text-[9px] text-brand-purple font-bold">₹{progress.current.toLocaleString()} / ₹{progress.target.toLocaleString()}</span>
            </div>
            <div className="w-full h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
              <div className="h-full bg-brand-purple rounded-full" style={{ width: `${Math.min(100, Math.max(0, (progress.current / progress.target) * 100))}%` }}></div>
            </div>
          </div>
        ) : (
          <div className="text-[10px] text-zinc-500 font-medium group-hover:text-zinc-300 transition-colors">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedTab({ label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${active ? 'bg-[#1E293B] text-white shadow-sm' : 'text-zinc-500 hover:text-white'}`}>
      {label}
    </button>
  );
}

function FeedCard({ gig, index }: { gig: any, index?: number }) {
  const isMarket = gig.listing_type === 'MARKET';
  const isHighlighted = gig.is_highlighted && gig.highlight_expires_at && new Date(gig.highlight_expires_at) > new Date();
  const delay = index !== undefined ? `${index * 50}ms` : '0ms';
  return (
    <Link href={`/gig/${gig.id}`} className="block">
      <div
        className={`bg-[#0F172A] border rounded-2xl p-6 flex flex-col group hover:-translate-y-1 hover:shadow-xl transition-all min-h-[170px] h-full relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both ${isHighlighted
          ? 'border-brand-purple/50 shadow-[0_0_25px_rgba(136,37,245,0.15)] hover:shadow-[0_0_35px_rgba(136,37,245,0.3)]'
          : 'border-[#1E293B] hover:border-[#334155]'
          }`}
        style={{ animationDelay: delay }}
      >
        {isHighlighted && (
          <div className="absolute top-3 right-3 px-2 py-0.5 bg-brand-purple/20 border border-brand-purple/30 rounded-md text-[8px] font-bold text-brand-purple uppercase tracking-widest z-20">
            Featured
          </div>
        )}
        <div className="flex justify-between items-start mb-3 relative z-10">
          <h3 className="font-bold text-white text-[17px] leading-snug group-hover:text-brand-purple transition-colors line-clamp-2 pr-4">{gig.title}</h3>
        </div>

        <div className="flex items-center gap-2 mb-auto relative z-10">
          <span className="text-lg font-black text-brand-purple">₹{gig.price}</span>
          {isMarket && gig.market_type === 'RENT' && <span className="text-[11px] text-zinc-500">/day</span>}
        </div>

        <div className="mt-6 pt-4 border-t border-[#1E293B] flex items-center justify-between relative z-10">
          <div className="flex flex-col gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
            <span className="flex items-center gap-1"><MapPin size={10} className="text-zinc-600" /> {gig.is_physical ? "Physical" : "Online"} • {gig.users?.college || "Global"}</span>
          </div>
          <span className="text-[9px] text-zinc-400 font-bold uppercase">{timeAgo(gig.created_at)}</span>
        </div>
      </div>
    </Link>
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
    <div className="min-h-screen bg-[#070B1A] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function PreferencesModal({ user, supabase, onClose }: { user: any, supabase: any, onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const categories = [
    "Tech & Engineering", "Design & Creative", "Science & Medical", "Law & Humanities",
    "Commerce & Finance", "Academics & Projects", "Errands & Manual Labor", "Writing & Content",
    "Tutoring", "Other"
  ];

  const handleToggle = (cat: string) => {
    if (selected.includes(cat)) {
      setSelected(selected.filter(c => c !== cat));
    } else {
      if (selected.length < 5) {
        setSelected([...selected, cat]);
      }
    }
  };

  const handleSave = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    await supabase.from("users").update({ preferences: selected }).eq("id", user.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-[#0F172A] border border-[#1E293B] rounded-[24px] md:rounded-3xl p-5 md:p-8 pt-8 relative shadow-2xl overflow-y-auto scrollbar-hide">
        <button onClick={onClose} className="absolute top-3 right-3 md:top-4 md:right-4 p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <div className="flex justify-center mb-5 md:mb-6 shrink-0">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-brand-purple/20 flex items-center justify-center border border-brand-purple/30">
            <Star size={28} className="text-brand-purple md:w-8 md:h-8" />
          </div>
        </div>
        <h2 className="text-xl md:text-2xl font-black text-white text-center mb-2 shrink-0">Your Interests?</h2>
        <p className="text-xs md:text-sm text-zinc-400 text-center mb-5 md:mb-6 shrink-0">
          Select 1 to 5 categories to get personalized opportunities and stand out to buyers. Highly recommended!
        </p>
        <div className="flex flex-wrap gap-2 mb-6 md:mb-8 justify-center overflow-y-auto no-scrollbar pb-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => handleToggle(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${selected.includes(cat) ? 'bg-brand-purple text-white border-brand-purple shadow-[0_0_15px_rgba(136,37,245,0.4)]' : 'bg-[#1E293B]/50 border-[#1E293B] text-zinc-400 hover:text-white hover:border-zinc-600'}`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          onClick={handleSave}
          disabled={loading || selected.length === 0}
          className="w-full bg-brand-purple hover:bg-[#7D5FFF] text-white py-3.5 md:py-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(136,37,245,0.3)] flex items-center justify-center shrink-0"
        >
          {loading ? "Saving..." : `Save Preferences (${selected.length}/5)`}
        </button>
      </div>
    </div>
  );
}