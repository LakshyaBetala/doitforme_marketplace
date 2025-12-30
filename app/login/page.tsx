"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const sendOTP = async () => {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    setLoading(false);

    if (error) return setMessage(error.message);

    // Navigate to verification page
    router.push(`/verify?email=${encodeURIComponent(email)}`);
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md bg-white shadow-lg rounded-xl p-6">
        <div className="flex justify-center mb-6">
          <img src="/logo.svg" alt="Logo" className="h-14" />
        </div>
        <h1 className="text-2xl font-bold mb-4 text-center text-black">Login with OTP</h1>

        <input
          type="email"
          placeholder="Enter your email"
          // ADDED: text-black placeholder:text-gray-400
          className="w-full p-3 border rounded mb-4 text-black bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
          onChange={(e) => setEmail(e.target.value)}
        />

        {message && <p className="text-red-500 text-sm mb-3">{message}</p>}

        <button
          disabled={loading}
          onClick={sendOTP}
          className="w-full bg-purple-600 text-white p-3 rounded-lg disabled:bg-purple-400 hover:bg-purple-700 transition-colors"
        >
          {loading ? "Sending OTP..." : "Send OTP"}
        </button>
      </div>
    </div>
  );
}