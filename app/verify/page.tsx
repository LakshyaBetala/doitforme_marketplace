"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

function VerifyContent() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);

  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Restart timer when email changes
  useEffect(() => {
    if (!email) return;
    setTimer(60);
  }, [email]);

  // Countdown
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Auto-focus first input
  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const focusInput = (index: number) => {
    const el = inputsRef.current[index];
    if (el) {
      el.focus();
      el.select();
    }
  };

  const handleChange = (value: string, idx: number) => {
    if (!/^[0-9]*$/.test(value)) return;

    const v = value.slice(-1);

    setDigits((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });

    if (v && idx < 5) {
      focusInput(idx + 1);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();

      setDigits((prev) => {
        const next = [...prev];

        if (next[idx] !== "") {
          next[idx] = "";
        } else if (idx > 0) {
          next[idx - 1] = "";
          focusInput(idx - 1);
        }

        return next;
      });

      if (idx > 0 && digits[idx] === "") {
        focusInput(idx - 1);
      }
    }

    if (e.key === "ArrowLeft" && idx > 0) focusInput(idx - 1);
    if (e.key === "ArrowRight" && idx < 5) focusInput(idx + 1);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const paste = e.clipboardData.getData("text");
    if (!/^[0-9]+$/.test(paste)) return;

    const chars = paste.split("").slice(0, 6);

    setDigits((prev) => {
      const next = [...prev];
      for (let i = 0; i < chars.length; i++) next[i] = chars[i];
      return next;
    });

    const last = Math.min(chars.length - 1, 5);
    focusInput(last);
  };

  // Auto submit when all digits filled
  useEffect(() => {
    if (digits.every((d) => d !== "")) verifyOTP();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const verifyOTP = async () => {
    if (loading) return;

    const otp = digits.join("");
    if (otp.length !== 6) return setError("Please enter the 6-digit code.");

    setLoading(true);
    setError("");

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (verifyError || !data.user) {
      setLoading(false);
      return setError(
        verifyError?.message || "Invalid or expired OTP. Try again."
      );
    }

    // Sync user in DB
    await fetch("/api/auth/create-user", {
      method: "POST",
      body: JSON.stringify({
        id: data.user.id,
        email: data.user.email,
      }),
    });

    router.push("/dashboard");
  };

  const resendOTP = async () => {
    if (!email) return setError("Missing email.");

    setError("");
    setLoading(true);

    const { error: resendError } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    setLoading(false);

    if (resendError) return setError(resendError.message);

    setDigits(Array(6).fill(""));
    inputsRef.current[0]?.focus();
    setTimer(60);
  };

  const resendDisabled = timer > 0;

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-[#0B0B11] text-white">
      <div className="w-full max-w-md bg-[#1A1A24] border border-white/10 shadow-2xl rounded-3xl p-8 relative">
        
        {/* Back Button */}
        <Link href="/login" className="absolute top-6 left-6 text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-2 tracking-tight text-white">Verify Email</h1>
          <p className="text-sm text-white/50">
            Enter the 6-digit code sent to <br/>
            <span className="text-white font-bold">{email || "your email"}</span>
          </p>
        </div>

        {/* Input Grid */}
        <div className="flex justify-center gap-3 mb-8">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              className="w-12 h-14 rounded-xl border border-white/10 bg-[#0B0B11] text-center text-2xl font-bold text-white focus:outline-none focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5] transition-all caret-[#8825F5]"
              value={digit}
              onChange={(e) => handleChange(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center mb-6">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <button
            onClick={verifyOTP}
            disabled={loading}
            className="w-full bg-[#8825F5] hover:bg-[#7a1fe0] text-white font-bold py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(136,37,245,0.3)] hover:shadow-[0_0_30px_rgba(136,37,245,0.5)] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Verify & Continue"}
          </button>

          <div className="text-center">
            {resendDisabled ? (
              <p className="text-sm text-white/40">
                Resend code in <span className="text-white font-mono font-bold">{timer}s</span>
              </p>
            ) : (
              <button
                onClick={resendOTP}
                className="text-sm text-[#8825F5] hover:text-white transition-colors font-medium hover:underline underline-offset-4"
              >
                Resend Verification Code
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// THIS WRAPPER FIXES THE BUILD ERROR
export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#8825F5] animate-spin" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}