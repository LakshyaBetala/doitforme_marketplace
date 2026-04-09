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
        <div className="h-[100dvh] bg-[#070B1A] text-white flex flex-col font-sans overflow-hidden">
            {/* Header */}
            <header className="h-[70px] md:h-[80px] bg-[#0B1021] border-b border-[#1E293B] flex items-center justify-between px-4 md:px-6 shrink-0 z-50">
                <div className="flex items-center gap-6">
                    <Link href="/company/dashboard" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                            <Building2 size={18} className="text-indigo-400" />
                        </div>
                        <span className="font-black text-xl tracking-tighter hidden md:block text-indigo-400">DoItForMe Business</span>
                    </Link>

                    <div className="hidden lg:flex relative w-80">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Search your tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#0F172A] border border-[#1E293B] rounded-full py-2 pl-9 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 relative">
                    <button onClick={() => router.push('/messages')} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors">
                        <MessageSquare size={18} />
                    </button>

                    <div className="relative">
                        <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-[#1E293B] bg-white/10 hover:bg-white/10 transition-colors">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-inner uppercase">
                                {companyName[0]}
                            </div>
                            <span className="text-sm font-medium hidden md:block">{companyName}</span>
                            <ChevronDown size={14} className="text-zinc-500" />
                        </button>

                        {isProfileDropdownOpen && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl overflow-hidden py-1 z-50">
                                <Link href="/profile" className="flex items-center px-4 py-3 hover:bg-white/10 text-sm text-zinc-300 hover:text-white transition-colors">
                                    <User size={16} className="mr-3 shrink-0" />
                                    <span className="font-medium">Company Profile</span>
                                </Link>
                                <div className="h-px bg-[#1E293B] my-1"></div>
                                <button onClick={handleLogout} className="w-full flex items-center px-4 py-3 hover:bg-red-500/10 text-sm text-red-400 transition-colors">
                                    <LogOut size={16} className="mr-3 shrink-0" />
                                    <span className="font-medium">Logout</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-[#070B1A] scrollbar-hide relative p-4 md:p-8">
                <div className="max-w-5xl mx-auto space-y-8 pb-24 md:pb-8">

                    {!isVerifiedCompany && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                            <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-bold text-amber-300">Pending Verification</h3>
                                <p className="text-xs text-amber-300/70 mt-1">
                                    Your company profile is under review by admins. Once verified, you can post premium tasks to multiple workers.
                                </p>
                            </div>
                        </div>
                    )}

                    <section className="bg-[#0F172A] border border-[#1E293B] rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                        <div className="relative z-10 w-full mb-4 md:mb-0">
                            <h1 className="text-2xl font-black text-white tracking-tight mb-2">Welcome, {companyName}</h1>
                            <p className="text-zinc-400 text-xs md:text-sm">Manage your multi-worker tasks and applications from a single unified view.</p>
                        </div>
                        <div className="relative z-10 shrink-0 self-stretch flex items-center">
                            <Link href={isVerifiedCompany ? "/company/post" : "#"} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${isVerifiedCompany ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-white/10 text-white/40 cursor-not-allowed border border-white/5'}`}>
                                <Plus size={18} /> Post a Task
                            </Link>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-white mb-4">Your Postings</h2>
                        {filteredGigs.length === 0 ? (
                            <div className="text-center py-20 bg-[#0F172A] border border-[#1E293B] rounded-3xl">
                                <Building2 size={32} className="mx-auto text-zinc-600 mb-4" />
                                <p className="text-zinc-400 font-medium">You haven't posted any tasks yet.</p>
                                {isVerifiedCompany && (
                                    <Link href="/company/post" className="inline-block mt-4 px-6 py-2 bg-indigo-600/20 text-indigo-400 text-sm font-bold rounded-full hover:bg-indigo-600/30">
                                        Create New Task
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredGigs.map(gig => (
                                    <Link href={`/gig/${gig.id}`} key={gig.id} className="bg-[#0F172A] border border-[#1E293B] hover:border-indigo-500/50 rounded-2xl p-5 hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] transition-all flex flex-col group">
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] uppercase font-bold tracking-wider rounded border border-indigo-500/20">
                                                {gig.listing_type}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 font-bold">{new Date(gig.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 pr-4">{gig.title}</h3>
                                        <div className="mt-auto pt-4 border-t border-[#1E293B] flex items-center justify-between">
                                            <span className="text-indigo-400 font-black">₹{gig.price} / worker</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs bg-white/10 px-2 py-1 rounded-md text-zinc-300 font-bold">
                                                    Workers: {gig.max_workers || 1}
                                                </span>
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
