"use client";

import { toast } from "sonner";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, RefreshCcw, Building2, UserCheck, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

// Interest taxonomy used for "related field" targeting in the broadcast tab.
const BROADCAST_CATEGORIES = [
  "Commerce & Finance", "Design & Creative", "Academics & Gigs", "Tech & Engineering",
  "Writing & Content", "Marketing & PR", "Science & Medical", "Law & Humanities", "Data & Research",
];

export default function AdminDashboardPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    
    // Tabs state
    const [activeTab, setActiveTab] = useState<"PAYOUTS" | "COMPANY_LIST" | "PENDING_COMPANIES" | "PENDING_KYC" | "BROADCAST">("PAYOUTS");

    // Pending student-ID review state
    const [pendingKyc, setPendingKyc] = useState<any[]>([]);

    // Broadcast (new-gig alerts) state
    const [broadcastGigs, setBroadcastGigs] = useState<any[]>([]);
    const [selectedGigId, setSelectedGigId] = useState<string>("");
    const [broadcastPreview, setBroadcastPreview] = useState<any>(null);
    const [broadcastBusy, setBroadcastBusy] = useState(false);
    const [relatedCats, setRelatedCats] = useState<string[]>([]);

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
            fetchPendingUsers(),
            fetchPendingKyc(),
            fetchBroadcastGigs()
        ]);
        setLoading(false);
    };

    const fetchPendingKyc = async () => {
        try {
            const res = await fetch("/api/admin/review-kyc");
            const data = await res.json();
            if (res.ok) setPendingKyc(data.users || []);
        } catch {
            // non-fatal
        }
    };

    const reviewKyc = async (id: string, action: "approve" | "reject") => {
        let reason: string | undefined;
        if (action === "reject") {
            reason = window.prompt("Reason shown to the student (optional):") || undefined;
        }
        setProcessingId(id);
        try {
            const res = await fetch("/api/admin/review-kyc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetUserId: id, action, reason }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to update.");
            } else {
                setPendingKyc(prev => prev.filter(u => u.id !== id));
                toast.success(action === "approve" ? "Student verified" : "ID rejected");
            }
        } catch (err: any) {
            toast.error(err.message || "Network error.");
        }
        setProcessingId(null);
    };

    // --- BROADCAST (new-gig alerts) ---
    const fetchBroadcastGigs = async () => {
        const { data } = await supabase
            .from("gigs")
            .select("id, title, price, category, created_at, status")
            .order("created_at", { ascending: false })
            .limit(25);
        setBroadcastGigs(data || []);
    };

    const loadBroadcastPreview = async (gigId: string, related: string[] = relatedCats) => {
        if (gigId !== selectedGigId) setSelectedGigId(gigId);
        if (!gigId) { setBroadcastPreview(null); return; }
        try {
            const q = related.length ? `&related=${encodeURIComponent(related.join(","))}` : "";
            const res = await fetch(`/api/admin/broadcast-gig?gigId=${gigId}${q}`);
            const data = await res.json();
            if (res.ok) setBroadcastPreview(data);
            else toast.error(data.error || "Failed to load preview.");
        } catch (e: any) {
            toast.error(e.message || "Network error.");
        }
    };

    // Toggle a related-field category and refresh the bucket counts.
    const toggleRelated = (cat: string) => {
        const next = relatedCats.includes(cat) ? relatedCats.filter((c) => c !== cat) : [...relatedCats, cat];
        setRelatedCats(next);
        if (selectedGigId) loadBroadcastPreview(selectedGigId, next);
    };

    const runBroadcast = async (
        opts: { channel: "inapp" | "email"; audienceMode?: "interest" | "related" | "engaged"; test?: boolean }
    ) => {
        const { channel, audienceMode = "interest", test = false } = opts;
        if (!selectedGigId) return;
        if (!test && channel === "email") {
            const who = audienceMode === "interest" ? "students interested in this exact field"
                : audienceMode === "related" ? "students in the related fields you picked"
                : "all engaged students (batched 90/run)";
            if (!confirm(`Send personalized emails to ${who} now? This cannot be undone.`)) return;
        }
        setBroadcastBusy(true);
        try {
            const res = await fetch("/api/admin/broadcast-gig", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ gigId: selectedGigId, channel, test, audienceMode, relatedCategories: relatedCats }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Broadcast failed.");
            } else if (test) {
                toast.success(`Test email sent (${data.emailSent} to you). Check your inbox.`);
            } else {
                toast.success(`Sent — bell: ${data.inappSent}, email: ${data.emailSent}${data.emailRemaining ? ` (${data.emailRemaining} left, run again tomorrow)` : ""}`);
                loadBroadcastPreview(selectedGigId);
            }
        } catch (e: any) {
            toast.error(e.message || "Network error.");
        }
        setBroadcastBusy(false);
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
                <button onClick={() => setActiveTab("PENDING_KYC")} className={getTabClass("PENDING_KYC")}>
                    Student IDs ({pendingKyc.length})
                </button>
                <button onClick={() => setActiveTab("BROADCAST")} className={getTabClass("BROADCAST")}>
                    Broadcast Gig
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

                    {/* STUDENT ID REVIEW VIEW — only AI-flagged (manual_review) IDs land here */}
                    {activeTab === "PENDING_KYC" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#222] border border-[#222]">
                            {pendingKyc.map((u) => (
                                <div key={u.id} className="p-8 bg-[#0a0a0a] space-y-6">
                                    <div className="space-y-1">
                                        <div className="font-black text-xl text-white italic uppercase tracking-tighter">{u.name || "UNNAMED"}</div>
                                        <div className="text-[10px] font-black text-[#444] uppercase tracking-[0.3em]">{u.email}</div>
                                        <div className="text-[10px] text-[#666] uppercase tracking-widest">Claims: {u.college || "—"}</div>
                                        <div className="text-[10px] text-[#666] uppercase tracking-widest">
                                            AI: {u.kyc_institution || "no institution read"} · conf {u.kyc_confidence != null ? Number(u.kyc_confidence).toFixed(2) : "—"}
                                        </div>
                                    </div>
                                    {u.id_image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={u.id_image_url} alt="Student ID" className="w-full max-h-80 object-contain bg-black border border-[#222]" />
                                    ) : (
                                        <div className="py-12 text-center text-[#444] text-[10px] uppercase tracking-widest border border-[#222]">Image unavailable</div>
                                    )}
                                    <div className="flex gap-px bg-[#222] border border-[#222]">
                                        <button
                                            onClick={() => reviewKyc(u.id, "approve")}
                                            disabled={!!processingId}
                                            className="flex-1 px-6 py-4 bg-white text-black text-[9px] font-black uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-20"
                                        >
                                            {processingId === u.id ? "..." : "Approve"}
                                        </button>
                                        <button
                                            onClick={() => reviewKyc(u.id, "reject")}
                                            disabled={!!processingId}
                                            className="flex-1 px-6 py-4 bg-[#0a0a0a] text-red-500 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-red-500 hover:text-white disabled:opacity-20"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {pendingKyc.length === 0 && (
                                <div className="md:col-span-2 border border-[#222] bg-[#0a0a0a] py-40 text-center">
                                    <CheckCircle2 size={32} className="mx-auto text-[#222] mb-6" />
                                    <p className="text-[#444] text-[10px] font-bold uppercase tracking-[0.3em]">No IDs awaiting review.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* BROADCAST: alert engaged students about a new gig */}
                    {activeTab === "BROADCAST" && (
                        <div className="max-w-3xl space-y-8">
                            <div className="border border-[#222] bg-[#0a0a0a] p-8 space-y-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[#444] block mb-3">Select a gig to broadcast</label>
                                    <select
                                        value={selectedGigId}
                                        onChange={(e) => loadBroadcastPreview(e.target.value)}
                                        className="w-full bg-[#0B0B11] border border-[#222] text-white text-sm p-4 font-bold focus:outline-none focus:border-[#444]"
                                    >
                                        <option value="">— Choose a gig —</option>
                                        {broadcastGigs.map((g) => (
                                            <option key={g.id} value={g.id}>
                                                {g.title}{g.price ? ` · ₹${g.price}` : ""}{g.category ? ` · ${g.category}` : ""} ({g.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {broadcastPreview && (
                                    <div className="space-y-6 animate-in fade-in duration-300">
                                        <div className="grid grid-cols-3 gap-px bg-[#222] border border-[#222] text-center">
                                            <div className="bg-[#0a0a0a] py-6">
                                                <div className="text-3xl font-black text-white italic">{broadcastPreview.audienceTotal}</div>
                                                <div className="text-[9px] font-black uppercase tracking-widest text-[#444] mt-2">Engaged audience</div>
                                            </div>
                                            <div className="bg-[#0a0a0a] py-6">
                                                <div className="text-3xl font-black text-white italic">{broadcastPreview.inapp.remaining}</div>
                                                <div className="text-[9px] font-black uppercase tracking-widest text-[#444] mt-2">Bell — to send</div>
                                            </div>
                                            <div className="bg-[#0a0a0a] py-6">
                                                <div className="text-3xl font-black text-white italic">{broadcastPreview.email.remaining}</div>
                                                <div className="text-[9px] font-black uppercase tracking-widest text-[#444] mt-2">Email — to send</div>
                                            </div>
                                        </div>

                                        {/* Bell + push — free, instant, reaches everyone */}
                                        <button onClick={() => runBroadcast({ channel: "inapp" })} disabled={broadcastBusy}
                                            className="w-full px-6 py-5 bg-white text-black text-[9px] font-black uppercase tracking-[0.2em] hover:bg-gray-200 disabled:opacity-20">
                                            {broadcastBusy ? "..." : `Send bell + push — free (${broadcastPreview.inapp.remaining})`}
                                        </button>

                                        {/* Related-field selector: defines who counts as "related" */}
                                        <div className="border border-[#222] bg-[#0B0B11] p-4 space-y-3">
                                            <div className="text-[10px] text-[#888] font-bold uppercase tracking-widest">Include related fields (optional)</div>
                                            <div className="flex flex-wrap gap-2">
                                                {BROADCAST_CATEGORIES.filter((c) => c !== broadcastPreview.gig?.category).map((cat) => (
                                                    <button key={cat} onClick={() => toggleRelated(cat)} disabled={broadcastBusy}
                                                        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${relatedCats.includes(cat) ? "bg-[#8825F5] text-white border-[#8825F5]" : "bg-transparent text-[#888] border-[#333] hover:border-[#555]"}`}>
                                                        {cat}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* The three email designs */}
                                        <div className="space-y-px bg-[#222] border border-[#222]">
                                            {/* 1 · Interested (gig's own field) */}
                                            <div className="bg-[#0a0a0a] p-5 flex items-center justify-between gap-4 flex-wrap">
                                                <div className="min-w-[200px]">
                                                    <div className="text-[11px] font-black text-white uppercase tracking-wider">1 · Interested — {broadcastPreview.email.interestRemaining ?? 0} to send</div>
                                                    <div className="text-[10px] text-[#666] mt-1">Subject: personalized &ldquo;New [your field] gig for you&rdquo;</div>
                                                </div>
                                                <div className="flex gap-px">
                                                    <button onClick={() => runBroadcast({ channel: "email", audienceMode: "interest", test: true })} disabled={broadcastBusy}
                                                        className="px-4 py-3 bg-[#111] text-[#8825F5] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#8825F5] hover:text-white disabled:opacity-20">Test</button>
                                                    <button onClick={() => runBroadcast({ channel: "email", audienceMode: "interest" })} disabled={broadcastBusy || (broadcastPreview.email.interestRemaining ?? 0) === 0}
                                                        className="px-4 py-3 bg-[#8825F5] text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#6f1ed1] disabled:opacity-20">Send</button>
                                                </div>
                                            </div>
                                            {/* 2 · Related fields */}
                                            <div className="bg-[#0a0a0a] p-5 flex items-center justify-between gap-4 flex-wrap">
                                                <div className="min-w-[200px]">
                                                    <div className="text-[11px] font-black text-white uppercase tracking-wider">2 · Related fields — {broadcastPreview.email.relatedRemaining ?? 0} to send</div>
                                                    <div className="text-[10px] text-[#666] mt-1">Subject: &ldquo;New paid gig you might like&rdquo; · pick fields above first</div>
                                                </div>
                                                <div className="flex gap-px">
                                                    <button onClick={() => runBroadcast({ channel: "email", audienceMode: "related", test: true })} disabled={broadcastBusy || relatedCats.length === 0}
                                                        className="px-4 py-3 bg-[#111] text-[#8825F5] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#8825F5] hover:text-white disabled:opacity-20">Test</button>
                                                    <button onClick={() => runBroadcast({ channel: "email", audienceMode: "related" })} disabled={broadcastBusy || (broadcastPreview.email.relatedRemaining ?? 0) === 0}
                                                        className="px-4 py-3 bg-[#8825F5] text-white text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#6f1ed1] disabled:opacity-20">Send</button>
                                                </div>
                                            </div>
                                            {/* 3 · All engaged */}
                                            <div className="bg-[#0a0a0a] p-5 flex items-center justify-between gap-4 flex-wrap">
                                                <div className="min-w-[200px]">
                                                    <div className="text-[11px] font-black text-white uppercase tracking-wider">3 · All engaged — {broadcastPreview.email.remaining ?? 0} to send</div>
                                                    <div className="text-[10px] text-[#666] mt-1">Subject: &ldquo;New paid gig&rdquo; · 90/run across days</div>
                                                </div>
                                                <div className="flex gap-px">
                                                    <button onClick={() => runBroadcast({ channel: "email", audienceMode: "engaged", test: true })} disabled={broadcastBusy}
                                                        className="px-4 py-3 bg-[#111] text-[#8825F5] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#8825F5] hover:text-white disabled:opacity-20">Test</button>
                                                    <button onClick={() => runBroadcast({ channel: "email", audienceMode: "engaged" })} disabled={broadcastBusy || (broadcastPreview.email.remaining ?? 0) === 0}
                                                        className="px-4 py-3 bg-[#0a0a0a] text-[#888] border border-[#333] text-[9px] font-black uppercase tracking-[0.2em] hover:text-white disabled:opacity-20">Send</button>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-[#666] uppercase tracking-widest leading-relaxed">
                                            Each design is personalized per student. Already-emailed students are skipped automatically — re-run on later days to finish any leftovers.
                                        </p>
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
