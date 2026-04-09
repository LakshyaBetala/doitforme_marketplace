"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight, Building2, CheckCircle, Mail, FileText, Building } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function CompanyOnboardingPage() {
    const router = useRouter();

    const [step, setStep] = useState<"form" | "otp">("form");
    const [companyName, setCompanyName] = useState("");
    const [companyEmail, setCompanyEmail] = useState("");
    const [companyDetails, setCompanyDetails] = useState("");
    const [otp, setOtp] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        if (!companyName.trim() || !companyEmail.trim() || !companyDetails.trim()) {
            return setError("Please fill in all the details to register your company.");
        }

        setLoading(true);
        const supabase = supabaseBrowser();
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

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!otp.trim() || otp.length !== 6) {
            return setError("Please enter the 6-digit code.");
        }

        setLoading(true);
        const supabase = supabaseBrowser();

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
            email: companyEmail.trim(),
            token: otp,
            type: "email"
        });

        if (verifyError || !data.user) {
            setLoading(false);
            return setError(verifyError?.message || "Invalid or expired OTP. Try again.");
        }

        try {
            const res = await fetch("/api/company/onboard", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    companyName: companyName.trim(),
                    companyEmail: companyEmail.trim(),
                    companyDetails: companyDetails.trim()
                }),
            });

            const apiData = await res.json();
            if (!res.ok) {
                setError(apiData.error || "Failed to submit onboarding request.");
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

    return (
        <div className="flex items-center justify-center min-h-[100dvh] p-4 md:p-6 bg-[#0B0B11] text-white relative overflow-hidden">
            {/* Background blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 hidden md:block">
                <div className="absolute w-[40rem] h-[40rem] bg-indigo-500/10 blur-[100px] rounded-full -top-40 -left-40 animate-blob" />
            </div>

            <div className="w-full max-w-md bg-[#121217]/80 backdrop-blur-xl border border-indigo-500/20 shadow-2xl rounded-3xl p-6 md:p-8 relative z-10 text-center">
                
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
                    <Building2 className="w-8 h-8 text-white" />
                </div>

                <h1 className="text-2xl md:text-3xl font-black mb-2 text-white tracking-tight">
                    Register Company
                </h1>
                <p className="text-white/60 text-sm mb-8 leading-relaxed">
                    Convert your account to a Company Account to post multi-worker tasks.
                </p>

                {step === "form" && (
                    <form onSubmit={handleSubmit} className="space-y-5 text-left">
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-indigo-400 ml-1 uppercase tracking-wider">
                                Company / Org Name
                            </label>
                            <div className="relative">
                                <Building size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type="text"
                                    placeholder="e.g. Acme Corp"
                                    className="w-full p-4 pl-12 rounded-xl bg-[#0B0B11] border border-white/10 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-indigo-400 ml-1 uppercase tracking-wider">
                                Work Email Address
                            </label>
                            <div className="relative">
                                <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                                <input
                                    type="email"
                                    placeholder="e.g. contact@acme.com"
                                    className="w-full p-4 pl-12 rounded-xl bg-[#0B0B11] border border-white/10 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                                    value={companyEmail}
                                    onChange={(e) => setCompanyEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-indigo-400 ml-1 uppercase tracking-wider">
                                Company Details / Description
                            </label>
                            <div className="relative">
                                <FileText size={20} className="absolute left-4 top-4 text-white/40" />
                                <textarea
                                    placeholder="Describe your company and the types of tasks you typically need help with..."
                                    className="w-full p-4 pl-12 rounded-xl bg-[#0B0B11] border border-white/10 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all h-28 resize-none font-medium text-sm leading-relaxed"
                                    value={companyDetails}
                                    onChange={(e) => setCompanyDetails(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl text-xs md:text-sm text-center border bg-red-500/10 border-red-500/20 text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="mt-8 pt-4 border-t border-white/5">
                            <button
                                type="submit"
                                disabled={loading || !companyName.trim() || !companyEmail.trim() || !companyDetails.trim()}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 active:scale-[0.98] hover:opacity-90 text-white p-4 rounded-xl disabled:opacity-50 transition-all font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Send Verification Code <ArrowRight size={18} /></>}
                            </button>
                        </div>
                    </form>
                )}

                {step === "otp" && (
                    <form onSubmit={handleVerifyOtp} className="space-y-5 text-left">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold mb-2">Verify Email</h2>
                            <p className="text-white/60 text-sm">We sent a 6-digit code to <br /><span className="text-white font-bold">{companyEmail}</span></p>
                        </div>
                        
                        <div className="space-y-3">
                            <label className="block text-xs font-bold text-indigo-400 ml-1 uppercase tracking-wider text-center">
                                6-Digit Code
                            </label>
                            <input
                                type="text"
                                placeholder="000000"
                                maxLength={6}
                                className="w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-indigo-500 font-bold"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                disabled={loading || success}
                            />
                        </div>

                        {error && (
                            <div className="p-4 rounded-xl text-xs md:text-sm text-center border bg-red-500/10 border-red-500/20 text-red-400">
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="p-4 rounded-xl text-xs md:text-sm text-center border bg-green-500/10 border-green-500/20 text-green-400 flex items-center justify-center gap-2 font-medium">
                                <CheckCircle size={18} /> Verified! Redirecting...
                            </div>
                        )}

                        <div className="mt-8 pt-4 border-t border-white/5">
                            <button
                                type="submit"
                                disabled={loading || success || otp.length !== 6}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 active:scale-[0.98] hover:opacity-90 text-white p-4 rounded-xl disabled:opacity-50 transition-all font-bold shadow-[0_0_20px_rgba(79,70,229,0.3)] flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <>Complete Onboarding <ArrowRight size={18} /></>}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setStep("form");
                                    setOtp("");
                                    setError("");
                                }}
                                className="w-full mt-3 text-sm text-zinc-400 hover:text-white transition-colors"
                                disabled={loading || success}
                            >
                                Change Email Address
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
