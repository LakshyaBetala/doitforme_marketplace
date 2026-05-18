"use client";

import { Suspense, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
    Plus, Search, MessageSquare, User,
    LogOut, ChevronDown, Building2, AlertTriangle, Sparkles
} from "lucide-react";

export default function CompanyDashboardPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#8825F5] border-t-transparent rounded-full animate-spin" />
            </div>
        }>
            <CompanyDashboard />
        </Suspense>
    );
}

function CompanyDashboard() {
    const supabase = supabaseBrowser();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [user, setUser] = useState<any>(null);
    const [company, setCompany] = useState<any>(null);
    const [myGigs, setMyGigs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [upgrading, setUpgrading] = useState(false);

    useEffect(() => {
        const loadDashboard = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return router.push("/login");

            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) { setLoading(false); return; }

            const [dbUserRes, gigsRes, companyRes] = await Promise.all([
                supabase.from("users").select("*").eq("id", authUser.id).single(),
                supabase.from("gigs")
                    .select("*")
                    .eq("poster_id", authUser.id)
                    .order("created_at", { ascending: false }),
                supabase.from("companies").select("pro_until, lifetime_gigs_posted").eq("user_id", authUser.id).single(),
            ]);

            const dbUser = dbUserRes.data;
            if (dbUser?.role !== 'COMPANY') {
                return router.push('/dashboard');
            }

            setUser({ ...authUser, user_metadata: { ...authUser.user_metadata, ...dbUser } });
            setCompany(companyRes.data || null);
            setMyGigs(gigsRes.data || []);
            setLoading(false);
        };
        loadDashboard();
    }, [router, supabase]);

    // Handle Pro return-URL verification
    useEffect(() => {
        const proParam = searchParams.get("pro");
        const orderId = searchParams.get("order_id");
        if (proParam !== "verify" || !orderId) return;
        let cancelled = false;
        (async () => {
            const t = toast.loading("Activating Pro…");
            try {
                const res = await fetch("/api/company/pro/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orderId }),
                });
                const data = await res.json();
                if (cancelled) return;
                if (res.ok) {
                    toast.success("Pro is active.", { id: t });
                    // Refresh company row
                    const { data: { user: u } } = await supabase.auth.getUser();
                    if (u) {
                        const { data } = await supabase.from("companies").select("pro_until, lifetime_gigs_posted").eq("user_id", u.id).single();
                        setCompany(data || null);
                    }
                } else {
                    toast.error(data.error || "Could not verify payment.", { id: t });
                }
            } catch (e: any) {
                if (!cancelled) toast.error(e.message || "Verify failed", { id: t });
            }
            // Clean URL
            const url = new URL(window.location.href);
            url.searchParams.delete("pro");
            url.searchParams.delete("order_id");
            window.history.replaceState({}, "", url.toString());
        })();
        return () => { cancelled = true; };
    }, [searchParams, supabase]);

    const isPro = !!(company?.pro_until && new Date(company.pro_until) > new Date());

    const handleGetPro = async () => {
        setUpgrading(true);
        const t = toast.loading("Opening checkout…");
        try {
            const res = await fetch("/api/company/pro/create-order", { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Could not start checkout.", { id: t });
                return;
            }
            toast.dismiss(t);
            const cashfreeMode = process.env.NEXT_PUBLIC_CASHFREE_MODE === "production" ? "production" : "sandbox";
            // @ts-expect-error - Cashfree global
            if (typeof window.Cashfree === "undefined") {
                await new Promise<void>((resolve, reject) => {
                    const s = document.createElement("script");
                    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
                    s.onload = () => resolve();
                    s.onerror = () => reject(new Error("Failed to load Cashfree SDK"));
                    document.body.appendChild(s);
                });
            }
            // @ts-expect-error - Cashfree global
            const cashfree = window.Cashfree({ mode: cashfreeMode });
            cashfree.checkout({ paymentSessionId: data.paymentSessionId, redirectTarget: "_self" });
        } catch (e: any) {
            toast.error(e.message || "Upgrade failed", { id: t });
        } finally {
            setUpgrading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    const isVerifiedCompany = user?.user_metadata?.is_verified_company === true;
    const companyName = user?.user_metadata?.company_name || user?.user_metadata?.name || "Company";

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#8825F5] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const filteredGigs = myGigs.filter(gig => 
        gig.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gig.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-[100dvh] bg-[var(--background)] text-white flex flex-col font-sans overflow-hidden selection:bg-[#8825F5]/30 selection:text-white relative">
            {/* Background Atmosphere */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#4F46E5]/10 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#C9A9FF]/10 rounded-full blur-[150px] pointer-events-none" />

            {/* Header */}
            <header className="h-[70px] md:h-[80px] bg-white/[0.02] backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 md:px-10 shrink-0 z-50">
                <div className="flex items-center gap-8">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
                            <Image src="/Doitforme_logo.png" alt="DoItForMe" width={24} height={24} className="object-contain" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-lg tracking-tight text-white leading-none">DoItForMe</span>
                            <span className="text-[11px] font-medium text-zinc-400 mt-0.5">Enterprise Hub</span>
                        </div>
                    </Link>

                    <div className="hidden lg:flex relative w-80">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search deployments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-[#8825F5]/50 focus:ring-1 focus:ring-[#8825F5]/50 focus:outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-4 relative">
                    <button onClick={() => router.push('/messages')} className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all">
                        <MessageSquare size={18} />
                    </button>

                    <div className="relative">
                        <button onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)} className="flex items-center gap-3 pl-2 pr-4 py-1.5 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all">
                            <div className="w-7 h-7 bg-[#0B0B11] rounded-full flex items-center justify-center overflow-hidden border border-white/10">
                                {user?.user_metadata?.avatar_url ? (
                                    <Image src={user.user_metadata.avatar_url} alt="Logo" width={28} height={28} className="object-cover w-full h-full" />
                                ) : (
                                    <span className="text-xs font-bold text-zinc-400">{companyName[0]}</span>
                                )}
                            </div>
                            <span className="text-sm font-medium hidden md:block text-zinc-200">{companyName}</span>
                            <ChevronDown size={14} className="text-zinc-400" />
                        </button>

                        {isProfileDropdownOpen && (
                            <div className="absolute top-full right-0 mt-3 w-56 bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                <Link href="/company/profile" className="flex items-center px-4 py-3 hover:bg-white/5 text-sm font-medium text-zinc-300 hover:text-white transition-colors">
                                    <User size={16} className="mr-3 shrink-0" />
                                    <span>Settings</span>
                                </Link>
                                <div className="h-px bg-white/10 w-full" />
                                <button onClick={handleLogout} className="w-full flex items-center px-4 py-3 hover:bg-red-500/10 text-sm font-medium text-red-400 transition-colors">
                                    <LogOut size={16} className="mr-3 shrink-0" />
                                    <span>Terminate Session</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-transparent scrollbar-hide relative p-4 md:p-12 z-10">
                <div className="max-w-6xl mx-auto space-y-12 pb-24 md:pb-8">

                    {!isVerifiedCompany && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex items-start gap-4 shadow-lg shadow-amber-500/5">
                            <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-1" />
                            <div>
                                <h3 className="text-[15px] font-semibold text-amber-500 mb-1">Awaiting Enterprise Clearance</h3>
                                <p className="text-sm text-amber-500/80 font-medium leading-relaxed">
                                    Your organizational credentials are currently undergoing manual verification. Authorization to deploy multi-worker tasks is pending administrator approval.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row items-end justify-between gap-6 border-b border-white/10 pb-8">
                        <div>
                            <span className="text-xs font-medium text-[#C9A9FF] mb-2 block">Dashboard Overview</span>
                            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">
                                {companyName}
                            </h1>
                        </div>
                        <div className="shrink-0 w-full md:w-auto flex items-center gap-3 flex-wrap">
                            {isPro ? (
                                <span className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full bg-[#8825F5]/15 border border-[#8825F5]/40 text-[#C9A9FF]">
                                    <Sparkles size={14} /> Pro · until {new Date(company.pro_until).toLocaleDateString()}
                                </span>
                            ) : (
                                <button
                                    onClick={handleGetPro}
                                    disabled={upgrading}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-full bg-[#8825F5] hover:bg-[#7a1de0] text-white transition-all disabled:opacity-60"
                                >
                                    <Sparkles size={16} /> {upgrading ? "Opening…" : "Get Pro · ₹299/mo"}
                                </button>
                            )}
                            <Link href={isVerifiedCompany ? "/company/post" : "#"} className={`flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-full transition-all ${isVerifiedCompany ? 'bg-white text-black hover:bg-zinc-200' : 'bg-white/5 text-zinc-500 cursor-not-allowed border border-white/10'}`}>
                                <Plus size={18} /> Deploy Task
                            </Link>
                        </div>
                    </div>

                    <section className="space-y-8">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white flex items-center gap-3">
                                <span className="w-1.5 h-6 rounded-full bg-[#8825F5]"></span>
                                Active Postings
                            </h2>
                            <div className="bg-white/10 border border-white/20 px-3 py-1 rounded-full text-xs font-medium text-zinc-300">
                                {filteredGigs.length} UNITS
                            </div>
                        </div>
                        
                        {filteredGigs.length === 0 ? (
                            <div className="py-24 border border-white/10 rounded-3xl bg-white/[0.02] backdrop-blur-md text-center shadow-inner shadow-black/20">
                                <Building2 size={32} className="mx-auto text-zinc-600 mb-6" />
                                <p className="text-zinc-400 text-sm font-medium">No active deployments detected.</p>
                                {isVerifiedCompany && (
                                    <Link href="/company/post" className="inline-block mt-4 text-[#C9A9FF] hover:text-white text-sm font-semibold hover:underline decoration-indigo-400/30 underline-offset-4 transition-colors">
                                        Initialize New Task →
                                    </Link>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredGigs.map(gig => (
                                    <Link href={`/company/task/${gig.id}`} key={gig.id} className="group relative border border-white/10 bg-white/[0.03] backdrop-blur-md rounded-2xl p-8 hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)]">
                                        
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

                                        <div className="relative z-10 flex justify-between items-start mb-6">
                                            <span className="text-xs font-medium text-zinc-500 transition-colors uppercase font-mono bg-black/40 px-2 py-1 rounded border border-white/5">
                                                ID: {gig.id.split('-')[0]}
                                            </span>
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"></div>
                                        </div>
                                        
                                        <h3 className="relative z-10 font-bold text-white text-xl tracking-tight mb-8 line-clamp-2 leading-tight transition-colors">
                                            {gig.title}
                                        </h3>
                                        
                                        <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-zinc-500 mb-1">Budget / Node</span>
                                                <span className="text-lg font-bold text-white">₹{gig.price}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-medium text-zinc-500 mb-1">Scale Units</span>
                                                <span className="text-sm font-bold text-white bg-white/10 px-3 py-1 rounded-full border border-white/5 inline-block">x{gig.max_workers || 1}</span>
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
