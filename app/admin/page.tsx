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

    // --- PENDING USERS ACTIONS ---
    const verifyUser = async (id: string) => {
        if (!confirm("Verify this company user?")) return;
        setProcessingId(id);
        // Note: also update User metadata in auth database if required,
        // but updating the users table is sufficient for the dashboard query check.
        const { error } = await supabase
            .from("users")
            .update({ is_verified_company: true })
            .eq("id", id);

        if (error) {
            toast.error(error.message);
        } else {
            setPendingUsers(prev => prev.filter(u => u.id !== id));
            toast.success("User verified!");
        }
        setProcessingId(null);
    };

    if (!isAdmin) return <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="min-h-screen bg-[#0B0B11] text-white p-6 md:p-12">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 pb-6 border-b border-white/10 gap-4">
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <div className="flex items-center gap-2">
                        <button onClick={fetchAllData} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                            <RefreshCcw size={18} />
                        </button>
                        <Link href="/dashboard" className="px-4 py-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-sm font-bold">
                            Back to Client Dashboard
                        </Link>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                    <button
                        onClick={() => setActiveTab("PAYOUTS")}
                        className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === "PAYOUTS" ? "bg-brand-purple text-white shadow-[0_0_15px_rgba(136,37,245,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
                    >
                        Pending Payouts ({payouts.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("COMPANY_LIST")}
                        className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === "COMPANY_LIST" ? "bg-brand-purple text-white shadow-[0_0_15px_rgba(136,37,245,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
                    >
                        <Building2 size={16} /> Manage Dropdown Companies
                    </button>
                    <button
                        onClick={() => setActiveTab("PENDING_COMPANIES")}
                        className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === "PENDING_COMPANIES" ? "bg-brand-purple text-white shadow-[0_0_15px_rgba(136,37,245,0.4)]" : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"}`}
                    >
                        <UserCheck size={16} /> User Company Approvals ({pendingUsers.length})
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-purple w-8 h-8" /></div>
                ) : (
                    <div className="bg-[#121217] border border-white/5 rounded-3xl overflow-hidden p-6 md:p-8">
                        {/* PAYOUTS VIEWS */}
                        {activeTab === "PAYOUTS" && (
                            <>
                                {payouts.length === 0 ? (
                                    <div className="text-center py-12">
                                        <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                        <h3 className="text-xl font-bold">All caught up!</h3>
                                        <p className="text-white/60">No pending payouts.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[700px]">
                                            <thead>
                                                <tr className="bg-white/5 text-xs uppercase tracking-widest text-white/60">
                                                    <th className="p-4 rounded-tl-xl">Date</th>
                                                    <th className="p-4">Worker</th>
                                                    <th className="p-4">UPI ID</th>
                                                    <th className="p-4">Amount</th>
                                                    <th className="p-4 text-right rounded-tr-xl">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {payouts.map((p) => (
                                                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-4 text-sm text-white/60">{new Date(p.created_at).toLocaleDateString()}</td>
                                                        <td className="p-4">
                                                            <div className="font-bold">{p.users?.full_name || "Unknown"}</div>
                                                            <div className="text-xs text-white/60">{p.users?.email}</div>
                                                        </td>
                                                        <td className="p-4 font-mono text-brand-purple bg-brand-purple/10 rounded px-2 py-1 w-fit text-sm">{p.upi_id || "NOT LINKED"}</td>
                                                        <td className="p-4 font-bold text-xl">₹{p.amount}</td>
                                                        <td className="p-4 text-right">
                                                            <button
                                                                onClick={() => markAsPaid(p.id)}
                                                                disabled={!!processingId}
                                                                className="px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-green-500/20 active:scale-95 disabled:opacity-50"
                                                            >
                                                                {processingId === p.id ? "Saving..." : "Mark Paid"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {/* COMPANY LIST VIEW */}
                        {activeTab === "COMPANY_LIST" && (
                            <div className="space-y-6">
                                <div className="flex gap-2 w-full max-w-md">
                                    <input
                                        type="text"
                                        placeholder="Add new company name..."
                                        value={newCompanyName}
                                        onChange={(e) => setNewCompanyName(e.target.value)}
                                        className="flex-1 bg-[#0B0B11] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-brand-purple"
                                    />
                                    <button
                                        onClick={addCompany}
                                        disabled={addingCompany || !newCompanyName.trim()}
                                        className="bg-brand-purple text-white px-5 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Plus size={18} /> Add
                                    </button>
                                </div>

                                <div className="grid gap-3">
                                    {companies.map((company) => (
                                        <div key={company.id} className="flex items-center justify-between p-4 bg-[#0B0B11] border border-white/5 rounded-2xl">
                                            <div>
                                                <div className="font-bold text-lg">{company.name}</div>
                                                <div className="text-xs text-white/40">Added: {new Date(company.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => toggleCompanyActive(company.id, company.is_active)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                                                        company.is_active ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                                                    }`}
                                                >
                                                    {company.is_active ? "Active" : "Inactive"}
                                                </button>
                                                <button onClick={() => deleteCompany(company.id)} className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {companies.length === 0 && <div className="text-white/40 italic py-4">No companies added yet.</div>}
                                </div>
                            </div>
                        )}

                        {/* PENDING COMPANY USERS APPROVAL VIEW */}
                        {activeTab === "PENDING_COMPANIES" && (
                            <div className="grid gap-4">
                                {pendingUsers.map((user) => (
                                    <div key={user.id} className="flex flex-col sm:flex-row sm:items-start justify-between p-5 bg-[#0B0B11] border border-white/5 rounded-2xl gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-lg">{user.name || "Unnamed"}</span>
                                                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase rounded border border-blue-500/20">
                                                    {user.role}
                                                </span>
                                            </div>
                                            <div className="text-sm text-white/60 mb-2">{user.email}</div>
                                            {user.experience && (
                                                <div className="text-xs text-zinc-400 bg-[#121217] p-3 rounded-xl border border-white/5 whitespace-pre-wrap mt-2">
                                                    {user.experience}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 flex items-center justify-end pt-2 sm:pt-0">
                                            <button
                                                onClick={() => verifyUser(user.id)}
                                                disabled={!!processingId}
                                                className="bg-brand-purple hover:bg-brand-purple/80 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                {processingId === user.id ? <Loader2 className="animate-spin w-4 h-4" /> : <UserCheck size={16} />}
                                                Verify Company
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {pendingUsers.length === 0 && (
                                     <div className="text-center py-12">
                                     <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                     <h3 className="text-xl font-bold">No pending user approvals</h3>
                                 </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
