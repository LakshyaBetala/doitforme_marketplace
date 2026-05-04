"use client";

import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, RefreshCcw, Building2, UserCheck, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function AdminDashboardPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Tabs state
    const [activeTab, setActiveTab] = useState<"PAYOUTS" | "COMPANY_LIST" | "PENDING_COMPANIES">("PAYOUTS");

    // Payouts state
    const [payouts, setPayouts] = useState<any[]>([]);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Companies list state
    const [companies, setCompanies] = useState<any[]>([]);
    const [newCompanyName, setNewCompanyName] = useState("");
    const [addingCompany, setAddingCompany] = useState(false);

    // Pending verified users state
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);

    useEffect(() => {
        checkAdmin();
    }, []);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return router.push("/login");

        const ADMINS = ["betala911@gmail.com", "doitforme.in@gmail.com"];
        if (ADMINS.includes(user.email || "")) {
            setIsAdmin(true);
            fetchAllData();
        } else {
            router.push("/dashboard");
        }
    };

    const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([
            fetchPayouts(),
            fetchCompanies(),
            fetchPendingUsers()
        ]);
        setLoading(false);
    };

    const fetchPayouts = async () => {
        const { data, error } = await supabase
            .from("payout_queue")
            .select("*, users:worker_id(full_name, email, phone)")
            .eq("status", "PENDING")
            .order("created_at", { ascending: true });
        if (!error) setPayouts(data || []);
    };

    const fetchCompanies = async () => {
        const { data, error } = await supabase
            .from("companies")
            .select("*")
            .order("created_at", { ascending: true });
        if (!error) setCompanies(data || []);
    };

    const fetchPendingUsers = async () => {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("role", "COMPANY")
            .is("is_verified_company", false);
        if (!error) setPendingUsers(data || []);
    };

    // --- PAYOUT ACTIONS ---
    const markAsPaid = async (id: string) => {
        if (!confirm("Confirm that you have manually transferred the funds?")) return;
        setProcessingId(id);
        const { error } = await supabase
            .from("payout_queue")
            .update({ status: "COMPLETED", processed_at: new Date().toISOString() })
            .eq("id", id);

        if (error) {
            toast.error("Error updating status: " + error.message);
        } else {
            setPayouts(prev => prev.filter(p => p.id !== id));
            toast.success("Marked as paid");
        }
        setProcessingId(null);
    };

    // --- COMPANY LIST ACTIONS ---
    const addCompany = async () => {
        if (!newCompanyName.trim()) return;
        setAddingCompany(true);
        const { error } = await supabase
            .from("companies")
            .insert([{ name: newCompanyName.trim() }]);
        
        if (error) {
            toast.error(error.message);
        } else {
            setNewCompanyName("");
            fetchCompanies();
            toast.success("Company added");
        }
        setAddingCompany(false);
    };

    const toggleCompanyActive = async (id: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from("companies")
            .update({ is_active: !currentStatus })
            .eq("id", id);
        if (!error) {
            fetchCompanies();
        } else {
            toast.error(error.message);
        }
    };

    const deleteCompany = async (id: string) => {
        if (!confirm("Are you sure you want to delete this company?")) return;
        const { error } = await supabase
            .from("companies")
            .delete()
            .eq("id", id);
        if (!error) {
            fetchCompanies();
            toast.success("Company deleted");
        } else {
            toast.error(error.message);
        }
    };

    const verifyUser = async (id: string) => {
        if (!confirm("Verify this company user?")) return;
        setProcessingId(id);
        
        try {
            const res = await fetch("/api/admin/verify-company", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetUserId: id }),
            });
            const data = await res.json();
            
            if (!res.ok) {
                toast.error(data.error || "Failed to verify company.");
            } else {
                setPendingUsers(prev => prev.filter(u => u.id !== id));
                toast.success("User verified!");
            }
        } catch (err: any) {
            toast.error(err.message || "Network error. Please try again.");
        }
        
        setProcessingId(null);
    };

  if (!isAdmin) return <div className="h-screen bg-[#0B0B11] flex items-center justify-center text-white font-black uppercase tracking-[0.4em]">Unauthorized Access // Terminal Locked</div>;

  const getTabClass = (tab: typeof activeTab) => `
    px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-r border-[#222]
    ${activeTab === tab ? "bg-white text-black" : "bg-transparent text-[#444] hover:text-white hover:bg-[#111]"}
  `;

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12 font-sans selection:bg-white selection:text-black">
        
        {/* Corner Decals */}
        <div className="fixed top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-[#111] pointer-events-none"></div>
        <div className="fixed bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-[#111] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto space-y-16">
            
            {/* TERMINAL HEADER */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between border-b border-[#222] pb-12 gap-8">
                <div className="space-y-4">
                    <span className="text-[10px] font-bold text-[#444] uppercase tracking-[0.5em] block">Central Command // Dashboard [R-01]</span>
                    <h1 className="text-5xl md:text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
                        Administrative Hub
                    </h1>
                </div>
                <div className="flex items-center gap-px bg-[#222] border border-[#222]">
                    <button onClick={fetchAllData} className="p-4 bg-[#0a0a0a] hover:bg-white hover:text-black transition-all">
                        <RefreshCcw size={20} />
                    </button>
                    <Link href="/dashboard" className="px-8 py-4 bg-[#0a0a0a] hover:bg-white hover:text-black text-[10px] font-black uppercase tracking-widest transition-all">
                        Exit to Client Node
                    </Link>
                </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex flex-wrap items-center bg-[#0a0a0a] border border-[#222] overflow-hidden">
                <button onClick={() => setActiveTab("PAYOUTS")} className={getTabClass("PAYOUTS")}>
                    Pipeline: Payouts ({payouts.length})
                </button>
                <button onClick={() => setActiveTab("COMPANY_LIST")} className={getTabClass("COMPANY_LIST")}>
                    Operational Units ({companies.length})
                </button>
                <button onClick={() => setActiveTab("PENDING_COMPANIES")} className={getTabClass("PENDING_COMPANIES")}>
                    Verification Queue ({pendingUsers.length})
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-40">
                    <div className="flex flex-col items-center gap-6">
                        <Loader2 className="animate-spin text-white w-12 h-12" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#444] animate-pulse">Syncing Operational Data...</span>
                    </div>
                </div>
            ) : (
                <div className="min-h-[600px] animate-in fade-in duration-500">
                    
                    {/* PAYOUTS VIEWS */}
                    {activeTab === "PAYOUTS" && (
                        <div className="space-y-12">
                            {payouts.length === 0 ? (
                                <div className="border border-[#222] bg-[#0a0a0a] py-40 text-center">
                                    <CheckCircle2 size={32} className="mx-auto text-[#222] mb-6" />
                                    <p className="text-[#444] text-[10px] font-bold uppercase tracking-[0.3em]">All Financial Pipelines Cleared.</p>
                                </div>
                            ) : (
                                <div className="border border-[#222] bg-[#0a0a0a] overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[900px]">
                                        <thead>
                                            <tr className="border-b border-[#222]">
                                                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-[#444]">Deployment Date</th>
                                                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-[#444]">Worker Identity</th>
                                                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-[#444]">Financial Vector (UPI)</th>
                                                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-[#444]">Authorization</th>
                                                <th className="p-8 text-[10px] font-black uppercase tracking-widest text-[#444] text-right">Execute</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#222]">
                                            {payouts.map((p) => (
                                                <tr key={p.id} className="hover:bg-[#0d0d0d] transition-colors group">
                                                    <td className="p-8 text-[10px] font-bold text-[#666] uppercase whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</td>
                                                    <td className="p-8">
                                                        <div className="font-black text-white italic uppercase tracking-tight">{p.users?.full_name || "ANON-UNIT"}</div>
                                                        <div className="text-[10px] text-[#444] font-bold uppercase tracking-widest">{p.users?.email}</div>
                                                    </td>
                                                    <td className="p-8">
                                                        <span className="font-black text-sm text-white border border-[#222] px-3 py-1 bg-[#0B0B11]">{p.upi_id || "NULL_VECTOR"}</span>
                                                    </td>
                                                    <td className="p-8">
                                                       <span className="font-black text-2xl text-white italic">₹{p.amount}</span>
                                                    </td>
                                                    <td className="p-8 text-right">
                                                        <button
                                                            onClick={() => markAsPaid(p.id)}
                                                            disabled={!!processingId}
                                                            className="px-8 py-4 bg-white text-black text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:bg-gray-200 disabled:opacity-20 active:scale-95"
                                                        >
                                                            {processingId === p.id ? "Processing..." : "Authorize Payout"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* COMPANY LIST VIEW */}
                    {activeTab === "COMPANY_LIST" && (
                        <div className="space-y-12">
                            <div className="flex flex-col md:flex-row gap-px bg-[#222] border border-[#222] max-w-2xl">
                                <input
                                    type="text"
                                    placeholder="Enter Organizational Identity..."
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    className="flex-1 bg-[#0a0a0a] p-6 text-[10px] font-black uppercase tracking-widest text-white outline-none placeholder:text-[#222] focus:bg-[#111]"
                                />
                                <button
                                    onClick={addCompany}
                                    disabled={addingCompany || !newCompanyName.trim()}
                                    className="bg-white text-black px-10 py-6 text-[9px] font-black uppercase tracking-[0.2em] transition-all hover:bg-gray-200 disabled:opacity-20 flex items-center gap-2"
                                >
                                    <Plus size={16} /> Deploy Unit
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#222] border border-[#222]">
                                {companies.map((company) => (
                                    <div key={company.id} className="p-8 bg-[#0a0a0a] space-y-6 hover:bg-[#0d0d0d] transition-colors relative group">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="font-black text-xl text-white italic uppercase tracking-tighter">{company.name}</div>
                                                <div className="text-[9px] font-bold text-[#444] uppercase tracking-widest">Reg: {new Date(company.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <button onClick={() => deleteCompany(company.id)} className="text-[#222] hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-px bg-[#222] border border-[#222]">
                                            <button
                                                onClick={() => toggleCompanyActive(company.id, company.is_active)}
                                                className={`flex-1 px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${
                                                    company.is_active ? "bg-white text-black" : "bg-transparent text-[#444] hover:text-white"
                                                }`}
                                            >
                                                {company.is_active ? "Authorized" : "Halted"}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {companies.length === 0 && <div className="p-20 text-center md:col-span-3 text-[#222] text-[10px] font-black uppercase tracking-[0.5em]">No Units Found in Repository.</div>}
                            </div>
                        </div>
                    )}

                    {/* PENDING COMPANY USERS APPROVAL VIEW */}
                    {activeTab === "PENDING_COMPANIES" && (
                        <div className="space-y-12">
                            <div className="grid gap-px bg-[#222] border border-[#222]">
                                {pendingUsers.map((user) => (
                                    <div key={user.id} className="flex flex-col lg:flex-row items-center justify-between p-12 bg-[#0a0a0a] gap-12 group hover:bg-[#0d0d0d] transition-colors relative">
                                        <div className="flex-1 space-y-8 w-full">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-6">
                                                    <h3 className="font-black text-3xl text-white italic uppercase tracking-tighter leading-none">{user.name || "UNNAMED_ENTITY"}</h3>
                                                    <span className="px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-[0.2em]">
                                                        {user.role}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-black text-[#444] uppercase tracking-[0.3em]">{user.email}</div>
                                            </div>
                                            {user.experience && (
                                                <div className="text-[10px] text-[#888] bg-[#0B0B11] p-8 border border-[#222] italic leading-relaxed whitespace-pre-wrap font-medium">
                                                    <span className="text-[8px] font-black text-[#222] uppercase tracking-[0.5em] block mb-4">Transmission Trace // Data Summary</span>
                                                    {user.experience}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 w-full lg:w-auto">
                                            <button
                                                onClick={() => verifyUser(user.id)}
                                                disabled={!!processingId}
                                                className="w-full lg:w-auto px-12 py-6 bg-white text-black text-[10px] font-black uppercase tracking-[0.3em] transition-all hover:bg-gray-200 disabled:opacity-20 flex items-center justify-center gap-3"
                                            >
                                                {processingId === user.id ? <Loader2 className="animate-spin w-4 h-4" /> : <UserCheck size={18} />}
                                                Grant Clearance
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {pendingUsers.length === 0 && (
                                     <div className="border border-[#222] bg-[#0a0a0a] py-40 text-center">
                                     <CheckCircle2 size={32} className="mx-auto text-[#222] mb-6" />
                                     <p className="text-[#444] text-[10px] font-bold uppercase tracking-[0.3em]">Verification Queue Clean.</p>
                                 </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}
