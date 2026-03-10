"use client";

import { useState, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Wallet, Gift } from "lucide-react";
import UniversitySelect, { COLLEGES } from "@/components/UniversitySelect";

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

import { Suspense } from "react";

function AuthPage() {
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

  // Referral Code State
  const [referralCode, setReferralCode] = useState("");

  // Auto-fill referral code from URL (?ref=CODE)
  const searchParams = useSearchParams();
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode.toUpperCase());
      setView('SIGNUP'); // Auto-switch to sign-up when coming via referral
    }
  }, [searchParams]);

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
    // Clear any corrupted/stale sessions from previous setups
    await supabase.auth.signOut();

    // DO NOT query public.users here — RLS blocks unauthenticated reads.
    // Let Supabase Auth handle "user not found" natively.
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

    // Map native Supabase errors to friendly messages
    if (error) {
      if (error.message.includes("Invalid login credentials") || error.message.includes("Signups not allowed")) {
        setMessage("Account not found or incorrect password. Please Sign Up below.");
      } else {
        setMessage(error.message);
      }
    }
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
      // signUp() already sends a signup OTP — do NOT call signInWithOtp() again
      // (that was causing double emails and tangled OTP states)
      setLoading(false);
      let redirectUrl = `/verify?email=${encodeURIComponent(email)}&mode=signup`;
      if (referralCode.trim()) {
        redirectUrl += `&ref=${encodeURIComponent(referralCode.trim())}`;
      }
      router.push(redirectUrl);
    }
  };

  // --- STYLES ---
  const inputStyle = "w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-base placeholder:text-white/50 focus:outline-none focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5] transition-all appearance-none";
  const buttonStyle = "w-full bg-gradient-to-r from-[#8825F5] to-[#7D5FFF] active:scale-[0.98] hover:opacity-90 text-white p-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold shadow-[0_0_20px_rgba(136,37,245,0.3)] touch-manipulation";

  // --- GOOGLE OAUTH ---
  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage("");

    const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
    if (referralCode.trim()) {
      redirectUrl.searchParams.set("ref", referralCode.trim());
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl.toString(),
      },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  };

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

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-white hover:bg-zinc-100 active:scale-[0.98] transition-all font-bold text-black text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg mb-6"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">or</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {view === "LOGIN" && (
            <div className="space-y-4">
              <div className="flex bg-white/10 p-1 rounded-xl mb-6 border border-white/5">
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 touch-manipulation"
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
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
                  <Wallet size={18} />
                </div>
              </div>
              <p className="text-[10px] text-white/60 px-1 leading-tight">Optional — add later in Profile. Required to post/apply.</p>

              <div className="relative z-50">
                <UniversitySelect value={college} onChange={setCollege} />
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 touch-manipulation"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Referral Code */}
              <div className="relative">
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  placeholder="Referral Code (optional)"
                  className={inputStyle}
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  maxLength={8}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50">
                  <Gift size={18} />
                </div>
              </div>
              <p className="text-[10px] text-white/60 px-1 leading-tight">Got a code from a friend? Enter it, and you BOTH get 25 Reward Points!</p>
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
            <p className="text-white/60">
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
            <p className="text-white/60">
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

export default function AuthPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-[#0B0B11] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-purple border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <AuthPage />
    </Suspense>
  );
}