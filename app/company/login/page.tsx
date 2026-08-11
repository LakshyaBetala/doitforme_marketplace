"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Building2, ExternalLink, ArrowRight, ArrowLeft, ShieldCheck, ListChecks, Network } from "lucide-react";
import Link from "next/link";

export default function CompanyLoginPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    await supabase.auth.signOut();

    if (!email || !password) {
      setLoading(false);
      setMessageType("error");
      setMessage("Enter both your work email and password.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !authData?.user) {
      setLoading(false);
      setMessageType("error");
      setMessage(authError?.message || "Invalid email or password.");
      return;
    }

    const { data: dbUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (dbUser?.role !== "COMPANY") {
      setMessageType("error");
      setMessage("This is not a business account. Taking you to the student app...");
      setTimeout(() => router.push("/dashboard"), 3000);
      return;
    }

    setMessageType("success");
    setMessage("Verified. Opening your dashboard...");
    setTimeout(() => router.push("/company/dashboard"), 1000);
  };

  const inputClass = "w-full p-4 bg-[var(--card)] border border-white/[0.08] text-white focus:outline-none focus:border-[var(--brand-purple)] focus:ring-1 focus:ring-[var(--brand-purple)]/30 transition text-sm font-medium rounded-xl placeholder:text-white/30";
  const labelClass = "block text-[11px] font-medium text-white/55 uppercase tracking-[0.1em] mb-2";

  const FEATURES = [
    [ShieldCheck, "Protected payments", "Every task is escrow-backed. Students are paid only when you approve the work."],
    [ListChecks, "One to fifty workers", "Post a single task or scale it across many students, with delivery tracked per worker."],
    [Network, "Campus reach", "Your task reaches verified students across campuses the moment you post."],
  ] as const;

  return (
    <div className="flex min-h-[100dvh] bg-[var(--background)] text-white font-sans selection:bg-[var(--brand-purple)] selection:text-white">

      {/* Left Side: Editorial Pitch */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-16 border-r border-white/[0.08] bg-[var(--card)] relative overflow-hidden">
        <div aria-hidden className="absolute -top-24 -left-16 w-96 h-96 rounded-full bg-[var(--brand-purple)]/[0.14] blur-[120px] pointer-events-none" />

        <div className="z-10 relative">
            <div className="flex items-center gap-3 mb-12">
              <div className="relative w-10 h-10"><Image src="/logo.png" alt="DoItForMe" fill className="object-contain" /></div>
              <span className="text-xl font-semibold tracking-tight text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>DoItForMe <span className="text-white/45">for business</span></span>
            </div>

            <h1 className="text-5xl xl:text-6xl font-semibold leading-[1.08] tracking-tight text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
               Real work,<br />done by students.
            </h1>
        </div>

        <div className="space-y-6 z-10 relative border-t border-white/[0.08] pt-10">
            {FEATURES.map(([Icon, title, desc]) => (
              <div key={title} className="flex items-start gap-4">
                <div className="mt-0.5"><Icon size={20} className="text-[var(--brand-purple-soft)]" /></div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-white/50 text-sm mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Right Side: Login Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-0 relative">
        <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-white/45 hover:text-white transition-colors text-xs font-medium">
           <ArrowLeft size={16} /> Home
        </Link>
        <div className="w-full max-w-md mx-auto">

          <div className="lg:hidden flex items-center gap-3 mb-12 justify-center mt-8">
             <div className="relative w-9 h-9"><Image src="/logo.png" alt="Logo" fill className="object-contain" /></div>
             <span className="text-xl font-semibold tracking-tight text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>DoItForMe <span className="text-white/45">for business</span></span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-semibold mb-2 tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Business log in</h2>
            <p className="text-white/55 text-sm">Sign in to post tasks and manage your hires.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
               <label className={labelClass}>Work email</label>
               <input
                 type="email"
                 placeholder="you@company.com"
                 className={inputClass}
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 autoComplete="email"
               />
            </div>

            <div>
               <label className={labelClass}>Password</label>
               <div className="relative">
                 <input
                   type={showPassword ? "text" : "password"}
                   placeholder="Enter your password"
                   className={inputClass}
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   autoComplete="current-password"
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword(!showPassword)}
                   className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45 hover:text-white p-2 transition-colors"
                 >
                   {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>
               </div>
            </div>

            {message && (
              <div className={`p-4 rounded-xl border text-sm font-medium text-center ${messageType === "success" ? "bg-[var(--brand-purple)]/10 border-[var(--brand-purple)]/30 text-[var(--brand-purple-soft)]" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--brand-purple)] text-white hover:brightness-110 active:scale-[0.99] p-4 rounded-xl disabled:opacity-50 transition font-semibold text-sm flex items-center justify-center gap-2"
            >
              {loading ? "Signing in..." : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-white/[0.08] text-center lg:text-left">
            <p className="text-white/45 text-sm">
               New to DoItForMe for business?
            </p>
            <Link href="/company/onboarding" className="text-white hover:text-[var(--brand-purple-soft)] text-sm font-semibold inline-flex items-center mt-3 transition-colors">
                Register your company <ExternalLink size={14} className="ml-2" />
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}
