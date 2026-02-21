"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Loader2, ArrowLeft, Clock, CheckCircle2, XCircle, AlertTriangle, TrendingUp } from "lucide-react";
import Link from "next/link";

interface PayoutRecord {
    id: string;
    amount: number;
    status: "PENDING" | "COMPLETED" | "FAILED";
    created_at: string;
    gig_id: string;
    gig?: {
        title: string;
    };
}

export default function PayoutsPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
    const [user, setUser] = useState<any>(null);
    const [totalPending, setTotalPending] = useState(0);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login");
                return;
            }
            setUser(user);

            // Fetch Payouts with Gig Title
            // Note: Ensure foreign key relationship exists between payout_queue.gig_id and gigs.id
            const { data, error } = await supabase
                .from("payout_queue")
                .select(`
          *,
          gig:gigs!gig_id (title)
        `)
                .eq("worker_id", user.id)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching payouts:", error);
            } else {
                setPayouts(data || []);

                // Calculate Total Pending
                const pendingSum = (data || [])
                    .filter((p: any) => p.status === "PENDING")
                    .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

                setTotalPending(pendingSum);
            }
            setLoading(false);
        };

        init();
    }, [router, supabase]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0B0B11] text-white font-sans selection:bg-brand-purple p-4 md:p-8">

            {/* HEADER */}
            <div className="max-w-2xl mx-auto mb-8 flex items-center gap-4">
                <Link href="/dashboard" className="p-2 -ml-2 rounded-full hover:bg-white/5 text-white/60 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-2xl font-bold tracking-tight">Financial Dashboard</h1>
            </div>

            <div className="max-w-2xl mx-auto space-y-8">

                {/* HERO CARD: SHADOW WALLET */}
                <div className="bg-gradient-to-br from-[#1A1A24] to-[#121217] border border-white/10 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-brand-purple mb-2">
                            <TrendingUp size={20} />
                            <span className="text-xs font-bold uppercase tracking-widest">Pending Payouts</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl text-white/40 font-light">₹</span>
                            <span className="text-5xl md:text-6xl font-black tracking-tighter text-white">
                                {totalPending.toLocaleString('en-IN')}
                            </span>
                        </div>
                        <p className="mt-4 text-sm text-white/40 leading-relaxed max-w-sm">
                            Money currently held in Escrow or processing. It will be transferred to your UPI once the gig is marked complete.
                        </p>
                    </div>
                </div>

                {/* TRANSACTION HISTORY */}
                <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        Activity History
                        <span className="text-xs font-normal text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{payouts.length}</span>
                    </h2>

                    {payouts.length === 0 ? (
                        <div className="text-center py-12 bg-[#1A1A24] rounded-3xl border border-white/5 border-dashed">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="text-white/20" />
                            </div>
                            <p className="text-white/40 font-medium">No earnings yet.</p>
                            <p className="text-white/30 text-sm mt-1">Start hustling to see activity here!</p>
                            <Link href="/feed" className="inline-block mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider transition-all">
                                Find Work
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {payouts.map((p) => (
                                <div key={p.id} className="bg-[#1A1A24] border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-white/10 transition-colors group">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${p.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                                                p.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                                                    'bg-yellow-500/10 text-yellow-400'
                                            }`}>
                                            {p.status === 'COMPLETED' ? <CheckCircle2 size={18} /> :
                                                p.status === 'FAILED' ? <XCircle size={18} /> :
                                                    <Clock size={18} />}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-sm text-white truncate group-hover:text-brand-purple transition-colors">
                                                {p.gig?.title || "Unknown Gig"}
                                            </h3>
                                            <p className="text-[10px] text-white/40 font-mono mt-0.5">
                                                {new Date(p.created_at).toLocaleDateString()} • ID: {p.id.slice(0, 8)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <p className="font-mono font-bold text-white">₹{p.amount}</p>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${p.status === 'COMPLETED' ? 'text-green-500' :
                                                p.status === 'FAILED' ? 'text-red-500' :
                                                    'text-yellow-500'
                                            }`}>
                                            {p.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
