"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";

export default function AdminPayoutsPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [payouts, setPayouts] = useState<any[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        checkAdmin();
    }, []);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.push("/login");

        // Simple Admin Check (Matches RLS policy)
        if (user.email === "lakshya.betala@gmail.com") {
            setIsAdmin(true);
            fetchPayouts();
        } else {
            router.push("/dashboard");
        }
    };

    const fetchPayouts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("payout_queue")
            .select("*, users:worker_id(full_name, email, phone)")
            .eq("status", "PENDING")
            .order("created_at", { ascending: true });

        if (error) console.error("Error fetching payouts:", error);
        setPayouts(data || []);
        setLoading(false);
    };

    const markAsPaid = async (id: string) => {
        if (!confirm("Confirm that you have manually transferred the funds?")) return;

        setProcessingId(id);
        const { error } = await supabase
            .from("payout_queue")
            .update({ status: "COMPLETED", processed_at: new Date().toISOString() })
            .eq("id", id);

        if (error) {
            alert("Error updating status: " + error.message);
        } else {
            setPayouts(prev => prev.filter(p => p.id !== id));
        }
        setProcessingId(null);
    };

    if (!isAdmin) return <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center text-white">Checking Access...</div>;

    return (
        <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">Admin Payout Queue</h1>
                    <button onClick={fetchPayouts} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
                        <RefreshCcw size={20} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center"><Loader2 className="animate-spin text-brand-purple" /></div>
                ) : payouts.length === 0 ? (
                    <div className="text-center py-20 bg-[#121217] rounded-3xl border border-white/5">
                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h3 className="text-xl font-bold">All caught up!</h3>
                        <p className="text-white/40">No pending payouts.</p>
                    </div>
                ) : (
                    <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 text-xs uppercase tracking-widest text-white/40 border-b border-white/5">
                                        <th className="p-6">Date</th>
                                        <th className="p-6">Worker</th>
                                        <th className="p-6">UPI ID</th>
                                        <th className="p-6">Amount</th>
                                        <th className="p-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {payouts.map((p) => (
                                        <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-6 text-sm text-white/60">
                                                {new Date(p.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-6">
                                                <div className="font-bold">{p.users?.full_name || "Unknown"}</div>
                                                <div className="text-xs text-white/40">{p.users?.email}</div>
                                            </td>
                                            <td className="p-6 font-mono text-brand-purple bg-brand-purple/10 rounded px-2 py-1 w-fit">
                                                {p.upi_id || "NOT LINKED"}
                                            </td>
                                            <td className="p-6 font-bold text-xl">
                                                ₹{p.amount}
                                            </td>
                                            <td className="p-6 text-right">
                                                <button
                                                    onClick={() => markAsPaid(p.id)}
                                                    disabled={!!processingId}
                                                    className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-green-500/20 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    {processingId === p.id ? "Saving..." : "Mark Paid"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
