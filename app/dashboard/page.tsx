"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Plus, Briefcase, Search, MapPin, MessageSquare, User,
  Home, ShoppingBag, Inbox, Star, Settings, LogOut, Bell, ChevronDown, CheckCircle2,
  DollarSign, ArrowRight, Zap, ShieldCheck
} from "lucide-react";

export default function Dashboard() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedType, setFeedType] = useState<'ALL' | 'HUSTLE' | 'MARKET'>('ALL');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  useEffect(() => {
    const loadUserAndGigs = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push("/login");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: dbUser } = await supabase.from("users").select("*").eq("id", authUser.id).single();
        setUser({ ...authUser, user_metadata: { ...authUser.user_metadata, ...dbUser } });

        // Load Feed
        const nowIso = new Date().toISOString();
        let query = supabase
          .from("gigs")
          .select("*, users:poster_id(college)")
          .neq("poster_id", authUser.id)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(20);

        query = query.or(`deadline.is.null,deadline.gt.${nowIso}`);
        const { data: gigsData } = await query;
        setGigs(gigsData || []);
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
    return matchesSearch && matchesType;
  });

  const username = user?.user_metadata?.name || user?.email?.split("@")[0] || "Partner";

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
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors relative group">
            <Bell size={18} />
            <div className="absolute top-2 right-2 w-2 h-2 bg-pink-500 rounded-full"></div>
          </button>
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
                <Link href="/earnings" className="flex items-center px-4 py-2 hover:bg-white/5 text-sm text-zinc-300 hover:text-white"><DollarSign size={14} className="mr-3" /> Earnings</Link>
                <Link href="/settings" className="flex items-center px-4 py-2 hover:bg-white/5 text-sm text-zinc-300 hover:text-white"><Settings size={14} className="mr-3" /> Settings</Link>
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
            2. LEFT SIDEBAR (Navigation Spine)
        -------------------------------------------------- */}
        <aside className="hidden lg:flex flex-col w-[240px] bg-[#070B1A] border-r border-[#1E293B] overflow-y-auto shrink-0 pt-6 px-4">
          <div className="mb-8">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-3 mb-3">Primary</h4>
            <nav className="flex flex-col gap-1">
              <SidebarLink href="/dashboard" icon={Home} label="Dashboard" active />
              <SidebarLink href="/gig/my-gigs" icon={Briefcase} label="My Hustles" />
              <SidebarLink href="/feed" icon={ShoppingBag} label="Marketplace" />
              <SidebarLink href="/gig/applied" icon={Inbox} label="Applications" badge={3} />
              <SidebarLink href="/messages" icon={MessageSquare} label="Messages" />
            </nav>
          </div>

          <div className="mb-8">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-3 mb-3">Secondary</h4>
            <nav className="flex flex-col gap-1">
              <SidebarLink href="/earnings" icon={DollarSign} label="Earnings" />
              <SidebarLink href="/ratings" icon={Star} label="Ratings" />
              <SidebarLink href="/profile" icon={User} label="Profile" />
            </nav>
          </div>

          <div className="mb-8">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-3 mb-3">System</h4>
            <nav className="flex flex-col gap-1">
              <SidebarLink href="/settings" icon={Settings} label="Settings" />
              <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors w-full text-left text-sm font-bold group">
                <LogOut size={18} className="text-zinc-500 group-hover:text-red-400 transition-colors" /> Logout
              </button>
            </nav>
          </div>
        </aside>

        {/* --------------------------------------------------
            3. MAIN CONTENT AREA (Core Zone)
        -------------------------------------------------- */}
        <main className="flex-1 overflow-y-auto bg-[#070B1A] scrollbar-hide relative">
          <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-8 pb-24 md:pb-8">

            {/* Layer 1: Welcome + Identity */}
            <section className="bg-[#0F172A] border border-[#1E293B] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-purple/10 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="relative z-10 w-full md:w-1/2 mb-6 md:mb-0">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-2">Good afternoon, {username.split(' ')[0]}.</h1>
                <p className="text-zinc-400 text-sm">Here’s what’s happening on your campus today.</p>
              </div>
              <div className="hidden md:flex relative z-10 w-full md:w-1/2 justify-end items-center gap-6">
                <div className="bg-[#1E293B]/30 border border-[#334155] rounded-2xl p-4 text-right backdrop-blur-md">
                  <p className="text-[10px] text-brand-purple font-black uppercase tracking-widest mb-1.5 flex justify-end items-center gap-1.5"><Zap size={10} className="fill-brand-purple" /> Today's Opportunities</p>
                  <p className="text-xl font-black text-white">12 <span className="text-xs font-bold text-zinc-500 uppercase">new hustles</span></p>
                  <p className="text-xl font-black text-white mt-0.5">4 <span className="text-xs font-bold text-zinc-500 uppercase">marketplace items</span></p>
                </div>
              </div>
            </section>

            {/* Layer 2: Financial Status Cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Earned"
                value={`₹${user?.user_metadata?.total_earned || 0}`}
                icon={DollarSign} color="text-green-400" bg="bg-green-500/10"
                subtext={(user?.user_metadata?.total_earned || 0) > 0 ? "Great progress this week" : "Start earning today"}
                progress={{ current: user?.user_metadata?.total_earned || 0, target: 10000 }}
              />
              <StatCard
                title="Escrow Balance"
                value="₹0"
                icon={ShieldCheck} color="text-brand-purple" bg="bg-brand-purple/10"
                subtext="Secured holding"
              />
              <StatCard
                title="Active Apps"
                value="3"
                icon={Inbox} color="text-blue-400" bg="bg-blue-500/10"
                subtext="Awaiting response"
              />
              <StatCard
                title="Rating"
                value={`${Number(user?.user_metadata?.rating || 5).toFixed(1)} ⭐`}
                icon={Star} color="text-yellow-400" bg="bg-yellow-500/10"
                subtext="Top 10% on campus"
              />
            </section>

            {/* Layer 3: Quick Action Bar (Refined for Focus) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/post" className="flex flex-col items-center justify-center py-6 px-4 bg-gradient-to-r from-brand-purple to-brand-pink text-white rounded-2xl hover:opacity-95 active:scale-95 group hover:-translate-y-1 transition-all shadow-[0_0_20px_rgba(136,37,245,0.2)] hover:shadow-[0_0_30px_rgba(136,37,245,0.6)]">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"><Plus size={24} /></div>
                <span className="font-black tracking-wide">Post Hustle</span>
              </Link>
              <Link href="/post?type=market" className="flex flex-col items-center justify-center py-6 px-4 bg-[#0F172A] border border-[#1E293B] text-white rounded-2xl hover:bg-[#1E293B]/50 hover:border-brand-purple/50 active:scale-95 group hover:-translate-y-1 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(136,37,245,0.15)]">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-brand-purple/20 transition-all">
                  <ShoppingBag size={24} className="text-zinc-400 group-hover:text-brand-purple transition-colors" />
                </div>
                <span className="font-black tracking-wide text-zinc-300 group-hover:text-white transition-colors">Sell Item</span>
              </Link>
            </section>

            {/* Layer 4: Live Feed Section */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sticky top-0 bg-[#070B1A]/90 backdrop-blur-md py-4 z-20">
                <div>
                  <h2 className="text-xl font-black text-white flex items-center gap-2 mb-1">
                    Live Campus Feed <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse hidden sm:inline-block"></span>
                  </h2>
                  <p className="text-xs text-zinc-400 font-medium">See what students need right now</p>
                </div>

                <div className="flex items-center gap-4">
                  {/* Filters */}
                  <div className="flex items-center bg-[#0F172A] rounded-full p-1 border border-[#1E293B]">
                    <FeedTab label="All" active={feedType === 'ALL'} onClick={() => setFeedType('ALL')} />
                    <FeedTab label="Hustles" active={feedType === 'HUSTLE'} onClick={() => setFeedType('HUSTLE')} />
                    <FeedTab label="Marketplace" active={feedType === 'MARKET'} onClick={() => setFeedType('MARKET')} />
                  </div>
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

        {/* --------------------------------------------------
            4. RIGHT PANEL (High-Value Panel)
        -------------------------------------------------- */}
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

      </div>
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
  const delay = index !== undefined ? `${index * 50}ms` : '0ms';
  return (
    <div
      className="bg-[#0F172A] border border-[#1E293B] rounded-2xl p-5 flex flex-col group hover:border-[#334155] hover:-translate-y-1 hover:shadow-xl transition-all h-[150px] relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
      style={{ animationDelay: delay }}
    >
      <div className="flex justify-between items-start mb-2 relative z-10">
        <h3 className="font-bold text-white text-[15px] leading-snug group-hover:text-brand-purple transition-colors line-clamp-2 pr-4">{gig.title}</h3>
      </div>

      <div className="flex items-center gap-2 mb-auto relative z-10">
        <span className="text-xs font-black text-brand-purple">₹{gig.price}</span>
        {isMarket && gig.market_type === 'RENT' && <span className="text-[10px] text-zinc-500">/day</span>}
      </div>

      <div className="mt-auto pt-3 border-t border-[#1E293B] flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3 text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
          <span className="flex items-center gap-1"><MapPin size={10} className="text-zinc-600" /> {gig.users?.college || "Campus"}</span>
          <span>{timeAgo(gig.created_at)}</span>
        </div>
        <Link href={`/gig/${gig.id}`} className="px-3 py-1.5 bg-white/5 border border-white/5 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider hover:bg-brand-purple hover:border-brand-purple transition-colors">
          Apply
        </Link>
      </div>
    </div>
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