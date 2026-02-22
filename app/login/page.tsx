"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Wallet } from "lucide-react";

// --- COLLEGES LIST ---
const COLLEGES = [
  "SRM (Vadapalani)",
  "SRM (Ramapuram)",
  "SRM (Kattankulathur)",
  "VIT Vellore",
  "VIT Chennai",
  "Anna University (CEG/MIT/ACT)",
  "IIT Madras",
  "IIT Bombay",
  "IIT Delhi",
  "IIT Kharagpur",
  "IIT Kanpur",
  "NIT Trichy",
  "NIT Warangal",
  "NIT Surathkal",
  "Delhi University (DU)",
  "Jawaharlal Nehru University (JNU)",
  "Banaras Hindu University (BHU)",
  "Manipal Academy of Higher Education",
  "BITS Pilani",
  "Amrita Vishwa Vidyapeetham",
  "Sathyabama Institute",
  "Saveetha University",
  "Hindustan University",
  "MOP Vaishnav",
  "DG Vaishnav",
  "Loyola College",
  "Madras Christian College (MCC)",
  "Other"
];

// --- BACKGROUND COMPONENT ---
function BackgroundBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      <div className="absolute w-[40rem] h-[40rem] bg-[#8825F5]/20 blur-[100px] rounded-full -top-40 -left-40 animate-blob will-change-transform" />
      <div className="absolute w-[30rem] h-[30rem] bg-[#0097FF]/20 blur-[100px] rounded-full top-[30%] -right-20 animate-blob animation-delay-2000 will-change-transform" />
      <div className="absolute w-[26rem] h-[26rem] bg-[#D31CE7]/10 blur-[100px] rounded-full bottom-0 left-1/2 transform -translate-x-1/2 animate-blob animation-delay-4000 will-change-transform" />
    </div>
  );
}

export default function AuthPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  // Mode Toggles
  const [view, setView] = useState<"LOGIN" | "SIGNUP">("LOGIN");
  const [loginMethod, setLoginMethod] = useState<"PASSWORD" | "OTP">("PASSWORD");

  // Form State
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState(COLLEGES[0]);
  const [customCollege, setCustomCollege] = useState("");

  // NEW: UPI ID State
  const [upiId, setUpiId] = useState("");

  // --- HELPER: SYNC USER TO DB ---
  const syncUser = async (id: string, email: string) => {
    try {
      await fetch("/api/auth/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, email }),
      });
    } catch (e) {
      console.error("Sync failed", e);
    }
  };

  // --- SUBMIT HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (view === "LOGIN") {
      await handleLogin();
    } else {
      await handleSignup();
    }
  };

  const handleLogin = async () => {
    const { data: userExists } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (!userExists) {
      setLoading(false);
      setMessage("Account not found. Please Sign Up below.");
      return;
    }

    let error = null;

    if (loginMethod === "OTP") {
      const res = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      error = res.error;
      if (!error) {
        setLoading(false);
        return router.push(`/verify?email=${encodeURIComponent(email)}&mode=login`);
      }
    } else {
      const res = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      error = res.error;

      if (!error) {
        await syncUser(res.data.user?.id!, email);
        router.push("/dashboard");
        return;
      }
    }

    setLoading(false);
    if (error) setMessage(error.message);
  };

  const handleSignup = async () => {
    const finalCollege = college === "Other" ? customCollege.trim() : college;

    if (!email || !password || !name || !phone) {
      setLoading(false);
      return setMessage("Please fill in all required fields. UPI is optional and can be added later in your profile.");
    }

    if (college === "Other" && !finalCollege) {
      setLoading(false);
      return setMessage("Please enter your university name.");
    }

    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (upiId && !upiRegex.test(upiId)) {
      setLoading(false);
      return setMessage("Invalid UPI ID format. (e.g., name@oksbi)");
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone,
          college: finalCollege,
          upi_id: upiId || undefined
        },
      },
    });

    if (error) {
      setLoading(false);
      return setMessage(error.message);
    }

    if (data.user) {
      await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      setLoading(false);
      router.push(`/verify?email=${encodeURIComponent(email)}&mode=signup`);
    }
  };

  // --- STYLES ---
  const inputStyle = "w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base placeholder:text-white/30 focus:outline-none focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5] transition-all appearance-none";
  const buttonStyle = "w-full bg-gradient-to-r from-[#8825F5] to-[#7D5FFF] active:scale-[0.98] hover:opacity-90 text-white p-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-[0_0_20px_rgba(136,37,245,0.3)] touch-manipulation";

  return (
    <div className="flex items-center justify-center min-h-[100dvh] p-4 md:p-6 bg-[#0B0B11] text-white relative overflow-hidden">
      <BackgroundBlobs />

      <div className="w-full max-w-md bg-[#121217]/80 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl p-6 md:p-8 relative z-10">

        <div className="flex justify-center mb-6">
          <div className="relative w-12 h-12 md:w-14 md:h-14">
            <Image src="/Doitforme_logo.png" alt="Logo" fill className="object-contain" />
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-black mb-2 text-center text-white tracking-tight">
          {view === "LOGIN" ? "Welcome Back" : "Join the Squad"}
        </h1>
        <p className="text-center text-white/50 text-xs md:text-sm mb-8">
          {view === "LOGIN" ? "Login to continue your hustle." : "Sign up to start earning or outsourcing."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {view === "LOGIN" && (
            <div className="space-y-4">
              <div className="flex bg-white/5 p-1 rounded-xl mb-6 border border-white/5">
                <button
                  type="button"
                  onClick={() => setLoginMethod("PASSWORD")}
                  className={`flex-1 text-[10px] md:text-xs py-2.5 rounded-lg font-bold transition-all active:scale-95 touch-manipulation ${loginMethod === "PASSWORD" ? "bg-[#8825F5] text-white shadow-lg" : "text-white/50 hover:text-white"
                    }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMethod("OTP")}
                  className={`flex-1 text-[10px] md:text-xs py-2.5 rounded-lg font-bold transition-all active:scale-95 touch-manipulation ${loginMethod === "OTP" ? "bg-[#8825F5] text-white shadow-lg" : "text-white/50 hover:text-white"
                    }`}
                >
                  OTP / Magic Link
                </button>
              </div>

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Enter your email"
                className={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              {loginMethod === "PASSWORD" && (
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    className={inputStyle}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-2 touch-manipulation"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              )}
            </div>
          )}

          {view === "SIGNUP" && (
            <div className="space-y-4">
              <input
                type="text"
                autoComplete="name"
                placeholder="Full Name"
                className={inputStyle}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Email Address"
                className={inputStyle}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Phone Number"
                className={inputStyle}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

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
              <p className="text-[10px] text-white/40 px-1 leading-tight">Optional — add later in Profile. Required to post/apply.</p>

              <div className="relative">
                <label className="block text-[10px] font-bold text-white/40 mb-1 ml-1 uppercase tracking-wider">Select University</label>
                <select
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  className="w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base focus:outline-none focus:border-[#8825F5] appearance-none cursor-pointer"
                >
                  {COLLEGES.map((col) => (
                    <option key={col} value={col} className="bg-[#0B0B11]">{col}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute bottom-4 right-4 text-white/30">
                  <ChevronDown size={18} />
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

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Create Password"
                  className={inputStyle}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-2 touch-manipulation"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className={`mt-6 p-4 rounded-xl text-xs md:text-sm text-center border animate-in zoom-in-95 ${message.includes("successful") ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
              {message}
            </div>
          )}

          <div className="mt-8">
            <button
              type="submit"
              disabled={loading}
              className={buttonStyle}
            >
              {loading ? "Processing..." : view === "LOGIN" ? "Login" : "Join Now"}
            </button>
          </div>

        </form>

        <div className="mt-8 text-center text-xs md:text-sm">
          {view === "LOGIN" ? (
            <p className="text-white/40">
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => { setView("SIGNUP"); setMessage(""); }}
                className="text-[#8825F5] font-bold hover:text-white transition-colors active:scale-95 touch-manipulation ml-1"
              >
                Sign Up
              </button>
            </p>
          ) : (
            <p className="text-white/40">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setView("LOGIN"); setMessage(""); }}
                className="text-[#8825F5] font-bold hover:text-white transition-colors active:scale-95 touch-manipulation ml-1"
              >
                Login
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}

function ChevronDown({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
  );
}