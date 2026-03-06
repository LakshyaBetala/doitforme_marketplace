"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { Loader2, Phone, GraduationCap, Wallet, ArrowRight } from "lucide-react";
import Image from "next/image";

const COLLEGES = [
    "SRM (Vadapalani)",
    "SRM (Ramapuram)",
    "SRM (Kattankulathur)",
    "SRM (AP)",
    "VIT Vellore",
    "VIT Chennai",
    "VIT AP",
    "Anna University (CEG/MIT/ACT)",
    "IIT Madras",
    "IIT Bombay",
    "IIT Delhi",
    "IIT Kharagpur",
    "IIT Kanpur",
    "IIT Roorkee",
    "IIT Hyderabad",
    "NIT Trichy",
    "NIT Warangal",
    "NIT Surathkal",
    "NIT Calicut",
    "Delhi University (DU)",
    "Jawaharlal Nehru University (JNU)",
    "Banaras Hindu University (BHU)",
    "Manipal Academy of Higher Education",
    "BITS Pilani",
    "BITS Goa",
    "BITS Hyderabad",
    "Amrita Vishwa Vidyapeetham",
    "Sathyabama Institute",
    "Saveetha University",
    "Hindustan University",
    "MOP Vaishnav",
    "DG Vaishnav",
    "Loyola College",
    "Madras Christian College (MCC)",
    "Madras University",
    "Stella Maris College",
    "Ethiraj College for Women",
    "Presidency College, Chennai",
    "PSG College of Technology",
    "Coimbatore Institute of Technology",
    "SASTRA Deemed University",
    "SSN College of Engineering",
    "Christ University, Bangalore",
    "PES University, Bangalore",
    "RV College of Engineering",
    "Osmania University",
    "Symbiosis International",
    "NMIMS Mumbai",
    "Jadavpur University",
    "Other"
];

export default function OnboardingPage() {
    const supabase = supabaseBrowser();
    const router = useRouter();

    const [phone, setPhone] = useState("");
    const [college, setCollege] = useState(COLLEGES[0]);
    const [customCollege, setCustomCollege] = useState("");
    const [upiId, setUpiId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const finalCollege = college === "Other" ? customCollege.trim() : college;

        if (!phone.trim()) {
            setLoading(false);
            return setError("Phone number is required.");
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

    const inputStyle = "w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base placeholder:text-white/30 focus:outline-none focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5] transition-all appearance-none";

    return (
        <div className="flex items-center justify-center min-h-[100dvh] p-4 md:p-6 bg-[#0B0B11] text-white relative overflow-hidden">

            {/* Background blobs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
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
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
                            <Phone size={18} />
                        </div>
                    </div>

                    {/* College */}
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-white/40 mb-1 ml-1 uppercase tracking-wider">
                            Select University
                        </label>
                        <div className="relative">
                            <select
                                value={college}
                                onChange={(e) => setCollege(e.target.value)}
                                className="w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base focus:outline-none focus:border-[#8825F5] appearance-none cursor-pointer pr-10"
                            >
                                {COLLEGES.map((col) => (
                                    <option key={col} value={col} className="bg-[#0B0B11]">{col}</option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-4 text-white/30">
                                <GraduationCap size={18} />
                            </div>
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
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
                            <Wallet size={18} />
                        </div>
                    </div>
                    <p className="text-[10px] text-white/40 px-1 leading-tight">
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
