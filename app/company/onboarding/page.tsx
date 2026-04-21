"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowRight, ArrowLeft, Building2, CheckCircle, Image as ImageIcon, X, UploadCloud, Users, ShieldCheck, Zap, Clock } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";

export default function CompanyOnboardingPage() {
    const router = useRouter();
    const supabase = supabaseBrowser();

    const [step, setStep] = useState<"form" | "conflict" | "otp">("form");
    const [companyName, setCompanyName] = useState("");
    const [companyEmail, setCompanyEmail] = useState("");
    const [companyDetails, setCompanyDetails] = useState("");
    const [companyPhone, setCompanyPhone] = useState("");
    const [companyInterest, setCompanyInterest] = useState("startup");
    const [otp, setOtp] = useState("");
    const [existingUserName, setExistingUserName] = useState("");

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleLogoSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        if (!file.type.startsWith("image/")) {
            setError("Logo must be an image file.");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setError("Logo must be under 2MB.");
            return;
        }
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        if (!companyName.trim() || !companyEmail.trim() || !companyDetails.trim() || !companyPhone.trim()) {
            return setError("Please fill in all required corporate details.");
        }
        if (!logoFile) {
            return setError("A company logo is required to establish your profile.");
        }

        setLoading(true);

        const { data: existingUser } = await supabase
            .from('users')
            .select('name, email')
            .eq('email', companyEmail.trim())
            .maybeSingle();

        if (existingUser) {
            setExistingUserName(existingUser.name || companyEmail.trim());
            setStep("conflict");
            setLoading(false);
            return;
        }

        await sendOtp();
    };

    const sendOtp = async () => {
        setLoading(true);
        const { error: authError } = await supabase.auth.signInWithOtp({
            email: companyEmail.trim(),
            options: { shouldCreateUser: true }
        });

        setLoading(false);

        if (authError) {
            return setError(authError.message);
        }

        setStep("otp");
    };

    const handleConflictProceed = async () => {
        await sendOtp();
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!otp.trim() || otp.length !== 6) {
            return setError("Please enter the 6-digit verification code.");
        }

        setLoading(true);

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
            email: companyEmail.trim(),
            token: otp,
            type: "email"
        });

        if (verifyError || !data.user) {
            setLoading(false);
            return setError(verifyError?.message || "Invalid or expired authorization code.");
        }

        try {
            // Upload Logo
            let uploadedLogoUrl = null;
            if (logoFile) {
                const fileExt = logoFile.name.split('.').pop();
                const fileName = `logo_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `companies/${fileName}`;
                
                const { error: uploadError } = await supabase.storage
                    .from("gig-images")
                    .upload(filePath, logoFile, { cacheControl: "3600", upsert: false });
                
                if (uploadError) throw new Error("Image upload failed: " + uploadError.message);

                const { data: publicUrlData } = supabase.storage.from("gig-images").getPublicUrl(filePath);
                uploadedLogoUrl = publicUrlData.publicUrl;
            }

            const res = await fetch("/api/company/onboard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    companyName: companyName.trim(),
                    companyEmail: companyEmail.trim(),
                    companyDetails: companyDetails.trim(),
                    companyPhone: companyPhone.trim(),
                    companyInterest: companyInterest,
                    logoUrl: uploadedLogoUrl
                }),
            });

            const apiData = await res.json();
            if (!res.ok) {
                setError(apiData.error || "Failed to finalize corporate registration.");
                setLoading(false);
                return;
            }

            setSuccess(true);
            setTimeout(() => {
                router.push("/company/dashboard");
            }, 3000);

        } catch (err: any) {
            setError(err.message || "Network error. Please try again.");
            setLoading(false);
        }
    };

    const inputClass = "w-full p-4 bg-[#0a0a0a] border border-[#333] text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-sm font-medium rounded-none";
    const labelClass = "block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-2";

    return (
        <div className="flex bg-[#050505] min-h-[100dvh] text-white font-sans selection:bg-white selection:text-black">
            {/* Left Side: Persuasive Value Pitch */}
            <div className="hidden lg:flex flex-col justify-between w-[42%] bg-[#0a0a0a] border-r border-[#222] p-12 relative overflow-hidden">
                {/* Subtle background glow */}
                <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#00f2ff]/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#4F46E5]/5 rounded-full blur-[100px] pointer-events-none" />

                <div className="relative z-10 space-y-10">
                    {/* Brand */}
                    <Link href="/" className="flex items-center gap-4 group">
                        <Image src="/Doitforme_logo.png" alt="DoItForMe" width={44} height={44} className="object-contain transition-transform group-hover:rotate-12" />
                        <div className="flex flex-col">
                            <span className="text-xl font-black tracking-tighter leading-none">DoItForMe</span>
                            <span className="text-[10px] font-bold text-[#555] uppercase tracking-[0.3em]">Enterprise</span>
                        </div>
                    </Link>

                    {/* Headline */}
                    <div>
                        <h2 className="text-[2.5rem] font-black leading-[1.05] tracking-tight mb-5">
                            Access India&apos;s<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#4F46E5]">Largest Student</span><br />
                            Talent Pool.
                        </h2>
                        <p className="text-[#777] text-sm leading-relaxed max-w-sm">
                            Post tasks. Get verified student applications within hours. Pay only for completed work. Zero recruitment overhead.
                        </p>
                    </div>

                    {/* Value Props */}
                    <div className="space-y-5">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-[#00f2ff]/10 border border-[#00f2ff]/20 flex items-center justify-center shrink-0">
                                <Zap size={18} className="text-[#00f2ff]" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white mb-1">Hire in Hours, Not Weeks</h4>
                                <p className="text-[11px] text-[#666] leading-relaxed">Post a task, receive applications from verified students, and deploy talent the same day. No agencies, no job boards.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-[#4F46E5]/10 border border-[#4F46E5]/20 flex items-center justify-center shrink-0">
                                <Users size={18} className="text-[#818CF8]" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white mb-1">Scale: 1 to 50 Workers Per Task</h4>
                                <p className="text-[11px] text-[#666] leading-relaxed">Need 1 developer or 50 campus ambassadors? Deploy at any scale with a single post. Perfect for campaigns and sprints.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                                <ShieldCheck size={18} className="text-green-400" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white mb-1">3% Escrow Protection</h4>
                                <p className="text-[11px] text-[#666] leading-relaxed">Funds are held securely and released only when the work is delivered and accepted. Risk-free hiring with verified students.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trust Footer */}
                <div className="relative z-10 pt-8 border-t border-[#222]">
                    <div className="flex items-center gap-6">
                        <div>
                            <div className="text-2xl font-black text-white">50+</div>
                            <div className="text-[9px] font-bold text-[#555] uppercase tracking-widest">Universities</div>
                        </div>
                        <div className="w-px h-8 bg-[#222]" />
                        <div>
                            <div className="text-2xl font-black text-white">24hr</div>
                            <div className="text-[9px] font-bold text-[#555] uppercase tracking-widest">Avg. First Apply</div>
                        </div>
                        <div className="w-px h-8 bg-[#222]" />
                        <div>
                            <div className="text-2xl font-black text-white">₹0</div>
                            <div className="text-[9px] font-bold text-[#555] uppercase tracking-widest">Signup Fee</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Form Wizard */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-lg">
                    
                    {/* Header */}
                    <div className="mb-10 flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (step === "otp" || step === "conflict") {
                                    setStep("form");
                                } else {
                                    router.push("/");
                                }
                                setError("");
                            }}
                            className="text-[#666] hover:text-white transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
                        >
                            <ArrowLeft size={14} /> Back
                        </button>
                        <div className="flex items-center gap-2">
                            <Image src="/Doitforme_logo.png" alt="DoItForMe" width={20} height={20} className="object-contain opacity-50" />
                            <span className="text-[10px] font-bold text-[#666] uppercase tracking-widest leading-none">DoItForMe</span>
                        </div>
                    </div>

                    {/* Mobile-only value pitch (visible when left panel is hidden) */}
                    <div className="lg:hidden mb-8 p-5 bg-[#0a0a0a] border border-[#222]">
                        <h2 className="text-lg font-black tracking-tight mb-2">Why Register?</h2>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[11px] text-[#888]">
                                <Zap size={12} className="text-[#00f2ff] shrink-0" />
                                <span>Post tasks, get verified student applications in hours</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[#888]">
                                <Users size={12} className="text-[#818CF8] shrink-0" />
                                <span>Deploy 1–50 student workers per task</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-[#888]">
                                <ShieldCheck size={12} className="text-green-400 shrink-0" />
                                <span>3% escrow protection — pay only for completed work</span>
                            </div>
                        </div>
                    </div>

                    <div className="mb-12">
                        <h1 className="text-3xl font-black tracking-tight mb-2">Register Your Company</h1>
                        <p className="text-[#888] text-sm">Start hiring verified student talent. Free to register.</p>
                    </div>

                    {success ? (
                        <div className="bg-[#111] border border-[#333] p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="w-8 h-8 text-black" />
                            </div>
                            <h2 className="text-2xl font-black mb-2 text-white">Application Received</h2>
                            <p className="text-[#888] text-sm mb-6">Your company profile has been submitted for review. Our team will verify your credentials and activate your account within 24 hours.</p>
                            <Loader2 className="w-6 h-6 animate-spin text-white opacity-50" />
                        </div>
                    ) : (
                        <>
                            {step === "form" && (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    {/* Logo Upload Dropzone */}
                                    <div>
                                        <label className={labelClass}>Company Logo</label>
                                        <div className="flex items-center gap-4">
                                            <div className="w-20 h-20 bg-[#111] border border-[#333] flex items-center justify-center overflow-hidden shrink-0">
                                                {logoPreview ? (
                                                    <Image src={logoPreview} alt="Logo" width={80} height={80} className="object-cover w-full h-full" />
                                                ) : (
                                                    <ImageIcon size={24} className="text-[#444]" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoSelect(e.target.files)} />
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-4 py-3 bg-[#111] hover:bg-[#222] border border-[#333] text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 w-full justify-center"
                                                >
                                                    {logoPreview ? "Change Logo" : "Upload Logo"} <UploadCloud size={14} />
                                                </button>
                                                <p className="text-[10px] text-[#666] mt-2">Square format recommended. Max 2MB.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelClass}>Company Name</label>
                                            <input type="text" className={inputClass} value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={loading} placeholder="e.g. Acme Corp" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Industry / Sector</label>
                                            <select className={inputClass} value={companyInterest} onChange={e => setCompanyInterest(e.target.value)} disabled={loading}>
                                                <option value="startup">Tech / Startup</option>
                                                <option value="agency">Agency / Consulting</option>
                                                <option value="enterprise">Corporate Enterprise</option>
                                                <option value="ngo">Non-Profit / NGO</option>
                                                <option value="other">Other Fields</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Business Email</label>
                                        <input type="email" className={inputClass} value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} disabled={loading} placeholder="founder@acme.com" />
                                    </div>

                                    <div>
                                        <label className={labelClass}>Contact Phone</label>
                                        <input type="tel" className={inputClass} value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} disabled={loading} placeholder="+91 9876543210" />
                                    </div>

                                    <div>
                                        <label className={labelClass}>What talent are you looking for?</label>
                                        <textarea className={`${inputClass} resize-none h-24`} value={companyDetails} onChange={e => setCompanyDetails(e.target.value)} disabled={loading} placeholder="E.g. We need campus ambassadors for our app launch across 10 universities..." />
                                    </div>

                                    {error && (
                                        <div className="p-4 bg-red-950/30 border border-red-500/50 text-red-500 text-xs font-bold uppercase tracking-widest text-center">
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full bg-white text-black p-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <>Register & Get Verified <ArrowRight size={16} /></>}
                                    </button>
                                    <p className="text-[10px] text-[#444] text-center">Free registration. No credit card required. Admin approval within 24hrs.</p>
                                </form>
                            )}

                            {step === "conflict" && (
                                <div className="space-y-6 animate-in slide-in-from-right-8 fade-in">
                                    <div className="p-6 bg-[#111] border border-[#333]">
                                        <h3 className="text-xl font-black mb-2 flex items-center gap-2 border-b border-[#333] pb-4">
                                            Account Collision
                                        </h3>
                                        <p className="text-[#888] text-sm mt-4 leading-relaxed">
                                            The email <strong>{companyEmail}</strong> is already connected to the student profile <strong>{existingUserName}</strong>.
                                        </p>
                                        <p className="text-[#888] text-sm mt-2 leading-relaxed">
                                            Proceeding will permanently upgrade this account to a <strong>Company Account</strong>. Student features will be disabled.
                                        </p>
                                    </div>

                                    {error && <p className="text-red-500 text-xs font-bold text-center uppercase">{error}</p>}

                                    <button
                                        onClick={handleConflictProceed}
                                        disabled={loading}
                                        className="w-full bg-white text-black p-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 className="animate-spin" /> : "Acknowledge & Proceed"}
                                    </button>
                                </div>
                            )}

                            {step === "otp" && (
                                <div className="space-y-6 animate-in slide-in-from-right-8 fade-in">
                                    <div className="p-8 bg-[#111] border border-[#333] text-center">
                                        <h2 className="text-2xl font-black tracking-tight mb-2">Verify Your Email</h2>
                                        <p className="text-[#888] text-sm mb-8">
                                            Enter the 6-digit code sent to <strong className="text-white">{companyEmail}</strong>
                                        </p>

                                        <form onSubmit={handleVerifyOtp} className="space-y-6">
                                            <div>
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    placeholder="• • • • • •"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value)}
                                                    className="w-full bg-[#050505] border border-[#333] p-4 text-center text-3xl font-mono tracking-[1em] focus:border-white focus:outline-none transition-colors"
                                                    disabled={loading}
                                                />
                                            </div>

                                            {error && <p className="text-red-500 text-xs font-bold text-center uppercase">{error}</p>}

                                            <button
                                                type="submit"
                                                disabled={loading || otp.length !== 6}
                                                className="w-full bg-white text-black p-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                                            >
                                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Verify & Complete"}
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
