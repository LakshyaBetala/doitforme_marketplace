"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
    Plus, Search, MapPin, MessageSquare, User,
    LogOut, ChevronDown, Clock, Building2, Bell, AlertTriangle
} from "lucide-react";

export default function CompanyDashboard() {
    const supabase = supabaseBrowser();
    const router = useRouter();

    const [user, setUser] = useState<any>(null);
    const [myGigs, setMyGigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

    useEffect(() => {
        const loadDashboard = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return router.push("/login");

            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) { setLoading(false); return; }

            const [dbUserRes, gigsRes] = await Promise.all([
                supabase.from("users").select("*").eq("id", authUser.id).single(),
                supabase.from("gigs")
                    .select("*")
                    .eq("poster_id", authUser.id)
                    .order("created_at", { ascending: false })
            ]);

            const dbUser = dbUserRes.data;
            if (dbUser?.role !== 'COMPANY') {
                return router.push('/dashboard'); // Regular users go back
            }

            setUser({ ...authUser, user_metadata: { ...authUser.user_metadata, ...dbUser } });
            setMyGigs(gigsRes.data || []);
            setLoading(false);
        };
        loadDashboard();
    }, [router, supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    const isVerifiedCompany = user?.user_metadata?.is_verified_company === true;
    const companyName = user?.user_metadata?.company_name || user?.user_metadata?.name || "Company";

    if (loading) {
        return (
            <div className="min-h-screen bg-[#070B1A] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const filteredGigs = myGigs.filter(gig => 
        gig.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gig.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-[100dvh] bg-[#050505] text-white flex flex-col font-sans overflow-hidden selection:bg-white selection:text-black">
            {/* Header */}
            <header className="h-[70px] md:h-[80px] bg-[#0a0a0a] border-b border-[#222] flex items-center justify-between px-4 md:px-6 shrink-0 z-50">
                <div className="flex items-center gap-8">
                    <Link href="/company/dashboard" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white flex items-center justify-center">
                            <Image src="/Doitforme_logo.png" alt="DoItForMe" width={28} height={28} className="object-contain" />
                        </div>
                        <span className="font-black text-xl tracking-tighter hidden md:block text-white uppercase italic">Enterprise</span>
                    </Link>

                    <div className="hidden lg:flex relative w-80">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
                        <input
                            type="text"
                            placeholder="SEARCH REPOSITORY..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#0a0a0a] border border-[#222] rounded-none py-2 pl-9 pr-4 text-xs font-bold text-white placeholder:text-[#444] focus:border-white focus:outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 relative">
                    <button onClick={() => router.push('/messages')} className="w-10 h-10 flex items-center justify-center bg-[#111] border border-[#222] hover:bg-[#222] text-[#888] hover:text-white transition-colors">
                        <MessageSquare size={18} />
                    </button>

                    <div className="relative">
                        <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-3 pl-1 pr-3 py-1 bg-[#111] border border-[#222] hover:bg-[#222] transition-colors">
                            <div className="w-8 h-8 bg-[#050505] border border-[#222] flex items-center justify-center overflow-hidden">
                                {user?.user_metadata?.avatar_url ? (
                                    <Image src={user.user_metadata.avatar_url} alt="Logo" width={32} height={32} className="object-cover w-full h-full" />
                                ) : (
                                    <span className="text-xs font-bold text-[#666]">{companyName[0]}</span>
                                )}
                            </div>
                            <span className="text-xs font-bold hidden md:block uppercase tracking-widest">{companyName}</span>
                            <ChevronDown size={12} className="text-[#555]" />
                        </button>

                        {isProfileDropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-[#0a0a0a] border border-[#222] shadow-2xl overflow-hidden py-0 z-50 animate-in fade-in zoom-in-95 duration-100">
                                <Link href="/company/profile" className="flex items-center px-4 py-4 hover:bg-[#111] text-xs font-bold uppercase tracking-widest text-[#888] hover:text-white transition-colors border-b border-[#222]">
                                    <User size={14} className="mr-3 shrink-0" />
                                    <span>Settings</span>
                                </Link>
                                <button onClick={handleLogout} className="w-full flex items-center px-4 py-4 hover:bg-red-950/30 text-xs font-bold uppercase tracking-widest text-red-500 transition-colors">
                                    <LogOut size={14} className="mr-3 shrink-0" />
                                    <span>Terminate Session</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-[#050505] scrollbar-hide relative p-4 md:p-12">
                <div className="max-w-6xl mx-auto space-y-12 pb-24 md:pb-8">

                    {!isVerifiedCompany && (
                        <div className="bg-amber-950/20 border border-amber-500/30 p-6 flex items-start gap-4">
                            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-xs font-black text-amber-500 uppercase tracking-widest mb-1">Awaiting Clearance</h3>
                                <p className="text-[10px] text-amber-500/70 font-medium leading-relaxed">
                                    Your organizational credentials are currently undergoing manual verification. Authorization to deploy multi-worker tasks is pending administrator approval.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row items-end justify-between gap-6 border-b border-[#222] pb-8">
                        <div>
                            <span className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] mb-4 block">Dashboard // Overview</span>
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic leading-none">
                                {companyName}
                            </h1>
                        </div>
                        <div className="shrink-0 w-full md:w-auto">
                            <Link href={isVerifiedCompany ? "/company/post" : "#"} className={`flex items-center justify-center gap-2 px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all ${isVerifiedCompany ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#111] text-[#333] cursor-not-allowed border border-[#222]'}`}>
                                <Plus size={16} /> Deploy Task
                            </Link>
                        </div>
                    </div>

                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold text-[#888] uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1 h-3 bg-white"></span> Active Postings
                            </h2>
                            <span className="text-[10px] font-mono text-[#444]">{filteredGigs.length} UNITS</span>
                        </div>
                        
                        {filteredGigs.length === 0 ? (
                            <div className="py-24 border border-[#222] bg-[#0a0a0a] text-center">
                                <Building2 size={24} className="mx-auto text-[#222] mb-4" />
                                <p className="text-[#444] text-[10px] font-bold uppercase tracking-widest">No active deployments detected.</p>
                                {isVerifiedCompany && (
                                    <Link href="/company/post" className="inline-block mt-6 text-white hover:underline text-[10px] font-black uppercase tracking-widest">
                                        Initialize New Task →
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-[#222]">
                                {filteredGigs.map(gig => (
                                    <Link href={`/company/task/${gig.id}`} key={gig.id} className="group border-r border-b border-[#222] bg-[#0a0a0a] p-8 hover:bg-white transition-all duration-300">
                                        <div className="flex justify-between items-start mb-8">
                                            <span className="text-[10px] font-bold text-[#555] group-hover:text-black transition-colors uppercase tracking-widest font-mono">
                                                ID: {gig.id.split('-')[0]}
                                            </span>
                                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                                        </div>
                                        
                                        <h3 className="font-black text-white group-hover:text-black text-xl italic uppercase tracking-tight mb-8 line-clamp-2 leading-none transition-colors">
                                            {gig.title}
                                        </h3>
                                        
                                        <div className="pt-6 border-t border-[#222] group-hover:border-black/10 flex items-center justify-between transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-[#444] group-hover:text-black/40 uppercase tracking-widest mb-1 transition-colors">Budget / Node</span>
                                                <span className="text-lg font-black text-white group-hover:text-black transition-colors">₹{gig.price}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] font-bold text-[#444] group-hover:text-black/40 uppercase tracking-widest mb-1 transition-colors">Units</span>
                                                <span className="text-sm font-black text-white group-hover:text-black transition-colors block">x{gig.max_workers || 1}</span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
