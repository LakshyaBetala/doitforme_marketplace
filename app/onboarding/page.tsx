"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { Loader2, Phone, GraduationCap, Wallet, ArrowRight, AtSign, CheckCircle2, XCircle } from "lucide-react";
import Image from "next/image";
import UniversitySelect, { COLLEGES } from "@/components/UniversitySelect";

export default function OnboardingPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();

    const [phone, setPhone] = useState("");
    const [college, setCollege] = useState(COLLEGES[0]);
    const [customCollege, setCustomCollege] = useState("");
    const [upiId, setUpiId] = useState("");
    const [username, setUsername] = useState("");
    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
    const [usernameReason, setUsernameReason] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Debounced username availability check
    useEffect(() => {
      const u = username.trim().toLowerCase();
      if (!u) {
        setUsernameStatus("idle");
        setUsernameReason(null);
        return;
      }
      setUsernameStatus("checking");
      const t = setTimeout(async () => {
        try {
          const res = await fetch(`/api/auth/check-username?u=${encodeURIComponent(u)}`);
          const data = await res.json();
          if (data.available) {
            setUsernameStatus("available");
            setUsernameReason(null);
          } else {
            setUsernameStatus(data.reason === "Taken" ? "taken" : "invalid");
            setUsernameReason(data.reason || "Unavailable");
          }
        } catch {
          setUsernameStatus("idle");
        }
      }, 350);
      return () => clearTimeout(t);
    }, [username]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const finalCollege = college === "Other" ? customCollege.trim() : college;

        if (!phone.trim()) {
            setLoading(false);
            return setError("Phone number is required.");
        }

        // Username is optional, but if provided must be valid + available
        const cleanUsername = username.trim().toLowerCase();
        if (cleanUsername && (usernameStatus === "taken" || usernameStatus === "invalid")) {
            setLoading(false);
            return setError(usernameReason || "Pick a different username.");
        }

        if (college === "Other" && !finalCollege) {
            setLoading(false);
            return setError("Please enter your university name.");
        }

        if (upiId) {
            const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
            if (!upiRegex.test(upiId)) {
                setLoading(false);
                return setError("Invalid UPI ID format. (e.g., name@oksbi)");
            }
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return router.push("/login");
        }

        // Update profile via the create-user API (handles upsert + wallet)
        try {
            const res = await fetch("/api/auth/create-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: user.id,
                    email: user.email,
                    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0],
                    phone: phone.trim(),
                    college: finalCollege,
                    upi_id: upiId.trim() || undefined,
                    username: cleanUsername || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setLoading(false);
                return setError(data.error || "Something went wrong.");
            }

            router.push("/dashboard");
        } catch {
            setLoading(false);
            setError("Network error. Please try again.");
        }
    };

    const inputStyle = "w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base placeholder:text-white/50 focus:outline-none focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5] transition-all appearance-none";

    return (
        <div className="flex items-center justify-center min-h-[100dvh] p-4 md:p-6 bg-[#0B0B11] text-white relative overflow-hidden">

            {/* Background blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 hidden md:block">
                <div className="absolute w-[40rem] h-[40rem] bg-[#8825F5]/20 blur-[100px] rounded-full -top-40 -left-40 animate-blob will-change-transform" />
                <div className="absolute w-[30rem] h-[30rem] bg-[#0097FF]/20 blur-[100px] rounded-full top-[30%] -right-20 animate-blob animation-delay-2000 will-change-transform" />
            </div>

            <div className="w-full max-w-md bg-[#121217]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-6 md:p-8 relative z-10">

                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="relative w-12 h-12 md:w-14 md:h-14">
                        <Image src="/Doitforme_logo.png" alt="Logo" fill className="object-contain" />
                    </div>
                </div>

                {/* Header */}
                <h1 className="text-2xl md:text-3xl font-black mb-2 text-center text-white tracking-tight">
                    Complete Your Profile
                </h1>
                <p className="text-center text-white/50 text-xs md:text-sm mb-8">
                    We need a few details before you can start.
                </p>

                {/* Progress dots */}
                <div className="flex justify-center gap-2 mb-8">
                    <div className="w-2 h-2 rounded-full bg-[#8825F5]" />
                    <div className="w-2 h-2 rounded-full bg-[#8825F5]" />
                    <div className="w-2 h-2 rounded-full bg-white/20" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Phone */}
                    <div className="relative">
                        <input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="Phone Number"
                            className={inputStyle}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            autoFocus
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
                            <Phone size={18} />
                        </div>
                    </div>

                    {/* College */}
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-white/60 mb-1 ml-1 uppercase tracking-wider">
                            Select University
                        </label>
                        <div className="relative z-50">
                            <UniversitySelect value={college} onChange={setCollege} />
                        </div>
                    </div>

                    {college === "Other" && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <input
                                type="text"
                                placeholder="University Name"
                                className={inputStyle}
                                value={customCollege}
                                onChange={(e) => setCustomCollege(e.target.value)}
                                autoFocus
                            />
                        </div>
                    )}

                    {/* Username (optional but encouraged — claims doitforme.in/u/<name>) */}
                    <div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-base pointer-events-none select-none">@</span>
                            <input
                                type="text"
                                inputMode="text"
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck={false}
                                placeholder="username"
                                className={`${inputStyle} pl-9 pr-11`}
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                                maxLength={20}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                {usernameStatus === "checking" && <Loader2 size={16} className="text-white/40 animate-spin" />}
                                {usernameStatus === "available" && <CheckCircle2 size={16} className="text-emerald-400" />}
                                {(usernameStatus === "taken" || usernameStatus === "invalid") && <XCircle size={16} className="text-red-400" />}
                                {usernameStatus === "idle" && <AtSign size={16} className="text-white/40" />}
                            </div>
                        </div>
                        <p className={`text-[10px] px-1 mt-1.5 leading-tight ${
                            usernameStatus === "available" ? "text-emerald-400" :
                            usernameStatus === "taken" || usernameStatus === "invalid" ? "text-red-400" :
                            "text-white/60"
                        }`}>
                            {usernameStatus === "available" && username
                                ? `doitforme.in/u/${username} — claimed`
                                : usernameStatus === "taken" || usernameStatus === "invalid"
                                ? usernameReason
                                : "Optional — your public profile URL. Permanent once set."}
                        </p>
                    </div>

                    {/* UPI (optional) */}
                    <div className="relative">
                        <input
                            type="text"
                            inputMode="text"
                            autoComplete="off"
                            placeholder="UPI ID (e.g. name@oksbi)"
                            className={inputStyle}
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
                            <Wallet size={18} />
                        </div>
                    </div>
                    <p className="text-[10px] text-white/60 px-1 leading-tight">
                        Optional — needed to receive payouts. You can add it later in Profile.
                    </p>

                    {/* Error */}
                    {error && (
                        <div className="p-4 rounded-xl text-xs md:text-sm text-center border bg-red-500/10 border-red-500/20 text-red-400 animate-in zoom-in-95">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <div className="mt-8">
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-[#8825F5] to-[#7D5FFF] active:scale-[0.98] hover:opacity-90 text-white p-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-[0_0_20px_rgba(136,37,245,0.3)] touch-manipulation flex items-center justify-center gap-2 min-h-[44px]"
                        >
                            {loading ? (
                                <Loader2 className="animate-spin w-5 h-5" />
                            ) : (
                                <>
                                    Let&apos;s Go <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
