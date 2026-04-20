"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Building2, ExternalLink, ArrowRight, ShieldCheck, ListChecks, Network } from "lucide-react";
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
      setMessage("Strictly enter both Corporate Email and Password.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError || !authData?.user) {
      setLoading(false);
      setMessageType("error");
      setMessage(authError?.message || "Invalid credentials. Organization not recognized.");
      return;
    }

    const { data: dbUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (dbUser?.role !== "COMPANY") {
      setMessageType("error");
      setMessage("Unverified Corporate Account. Redirecting to general public portal...");
      setTimeout(() => router.push("/dashboard"), 3000);
      return;
    }

    setMessageType("success");
    setMessage("Enterprise verified. Establishing secure dashboard connection...");
    setTimeout(() => router.push("/company/dashboard"), 1000);
  };

  const inputClass = "w-full p-4 bg-[#0a0a0a] border border-[#333] text-white focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all text-sm font-medium rounded-none placeholder:text-[#555]";
  const labelClass = "block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-2";

  return (
    <div className="flex min-h-[100dvh] bg-[#050505] text-white font-sans selection:bg-white selection:text-black">
      
      {/* Left Side: Editorial Pitch */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-16 border-r border-[#222] bg-[#0a0a0a] relative overflow-hidden">
        
        {/* Deep mesh texture for industrial look */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}></div>

        <div className="z-10">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-12 h-12 bg-white flex items-center justify-center">
                <Image src="/Doitforme_logo.png" alt="DoItForMe" width={32} height={32} className="object-contain" />
              </div>
              <span className="text-xl font-black tracking-tighter text-white">DoItForMe<span className="text-[#888]">.Enterprise</span></span>
            </div>
            
            <h1 className="text-5xl xl:text-6xl font-black leading-[1.1] tracking-tighter text-white">
               The B2B<br />Talent Exchange.
            </h1>
        </div>

        <div className="space-y-6 z-10 border-t border-[#333] pt-10">
            <div className="flex items-start gap-4">
              <div className="mt-1"><ShieldCheck size={20} className="text-[#888]" /></div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Guaranteed Payouts</p>
                <p className="text-[#666] text-sm mt-1">100% rigid platform escrow shielding corporate liability.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1"><ListChecks size={20} className="text-[#888]" /></div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Task Auditing</p>
                <p className="text-[#666] text-sm mt-1">Multi-worker scale management & granular deliverable tracking.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1"><Network size={20} className="text-[#888]" /></div>
              <div>
                <p className="text-sm font-bold text-white uppercase tracking-widest">Network Speed</p>
                <p className="text-[#666] text-sm mt-1">Instant campus-wide broadcasting and acquisition.</p>
              </div>
            </div>
        </div>
      </div>

      {/* Right Side: Login Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 lg:p-0 relative">
        <div className="w-full max-w-md mx-auto">
          
          <div className="lg:hidden flex items-center gap-3 mb-12 justify-center">
             <div className="w-10 h-10 bg-white flex items-center justify-center p-1">
                <Image src="/Doitforme_logo.png" alt="Logo" width={24} height={24} className="object-contain" />
             </div>
             <span className="text-xl font-black tracking-tighter text-white">B2B<span className="text-[#888]">.Login</span></span>
          </div>

          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-black mb-2 tracking-tight">Organization Access</h2>
            <p className="text-[#888] text-sm">Strictly for authorized enterprise credentials.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
               <label className={labelClass}>Corporate Email</label>
               <input
                 type="email"
                 placeholder="founder@company.com"
                 className={inputClass}
                 value={email}
                 onChange={(e) => setEmail(e.target.value)}
                 autoComplete="email"
               />
            </div>

            <div>
               <label className={labelClass}>Clearance Password</label>
               <div className="relative">
                 <input
                   type={showPassword ? "text" : "password"}
                   placeholder="Enter encrypted password"
                   className={inputClass}
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   autoComplete="current-password"
                 />
                 <button
                   type="button"
                   onClick={() => setShowPassword(!showPassword)}
                   className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888] hover:text-white p-2 transition-colors"
                 >
                   {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                 </button>
               </div>
            </div>

            {message && (
              <div className={`p-4 border text-xs font-bold uppercase tracking-widest text-center ${messageType === "success" ? "bg-white/10 border-white text-white" : "bg-red-950/30 border-red-500/50 text-red-500"}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-gray-200 active:scale-[0.99] p-4 disabled:opacity-50 transition-all font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2"
            >
              {loading ? "Authenticating..." : <>Initialize Session <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-[#333] text-center lg:text-left">
            <p className="text-[#666] text-xs font-bold uppercase tracking-widest">
               No existing architecture?
            </p>
            <Link href="/company/onboarding" className="text-white hover:underline text-sm font-bold inline-flex items-center mt-3 transition-colors">
                Register New Enterprise Node <ExternalLink size={14} className="ml-2" />
            </Link>
          </div>

        </div>
      </div>

    </div>
  );
}
