"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function VerifyPage() {
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
    // Added 'cursor-default' to ensure cursor is visible on this page
    <div className="flex items-center justify-center min-h-screen p-6 cursor-default">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6">
        {/* Added 'text-black' so the title is visible */}
        <h1 className="text-2xl font-bold mb-4 text-center text-black">
          Enter the OTP sent to {email}
        </h1>

        <p className="text-sm text-gray-500 mb-6 text-center">
          Please enter the 6-digit verification code.
        </p>

        <div className="flex justify-center gap-4 mb-4">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              // FIX: Added 'text-black bg-white' here
              className="w-12 h-14 rounded-xl border border-gray-400 text-center text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 text-black bg-white"
              value={digit}
              onChange={(e) => handleChange(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={handlePaste}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 text-center">{error}</p>
        )}

        <div className="flex items-center justify-between">
          {resendDisabled ? (
            <p className="text-sm text-gray-600">
              Resend OTP in <b>{timer}s</b>
            </p>
          ) : (
            <button
              onClick={resendOTP}
              className="text-sm text-purple-600 underline"
            >
              Resend OTP
            </button>
          )}

          <button
            onClick={verifyOTP}
            disabled={loading}
            className="bg-purple-600 text-white py-3 px-5 rounded-lg disabled:bg-purple-300 hover:bg-purple-700 transition-colors"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </div>
      </div>
    </div>
  );
}