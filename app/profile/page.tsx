"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import { 
  User, 
  Mail, 
  ShieldCheck, 
  ShieldAlert, 
  Star, 
  Briefcase, 
  UploadCloud, 
  Loader2, 
  Wallet, 
  Calendar, 
  Edit3, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Clock 
} from "lucide-react";

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [stats, setStats] = useState({ completed: 0, earnings: 0 });
  
  const [loading, setLoading] = useState(true);
  const [fixingProfile, setFixingProfile] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // 1. Check Auth Session
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login");
          return;
        }

        // 2. Fetch Public Profile
        let { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        // --- SELF-HEALING LOGIC ---
        if (!userData || userError?.code === 'PGRST116') {
          console.warn("Profile missing. Attempting auto-fix...");
          setFixingProfile(true);
          
          const safeEmail = user.email || `user-${user.id.slice(0,8)}@example.com`;

          await fetch("/api/auth/create-user", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                id: user.id, 
                email: safeEmail 
            }) 
          });
          
          // Retry fetch
          await new Promise(r => setTimeout(r, 1000));
          const retry = await supabase.from("users").select("*").eq("id", user.id).single();
          userData = retry.data;
          
          setFixingProfile(false);
        }
        // ---------------------------

        if (!userData) throw new Error("Could not load profile.");

        // 3. Fetch Wallet
        let { data: walletData } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .single();

        // 4. Fetch Stats & Calculate Earnings
        // FIX: We now fetch the 'price' to calculate earnings manually
        // FIX: We check for 'COMPLETED' (uppercase) which matches the API
        const { data: completedGigs } = await supabase
          .from("gigs")
          .select("price")
          .eq("assigned_worker_id", user.id)
          .eq("status", "COMPLETED");

        const completedCount = completedGigs?.length || 0;
        const totalEarned = completedGigs?.reduce((acc, gig) => acc + gig.price, 0) || 0;

        // Ensure wallet data exists and populate total_earned
        if (!walletData) {
            walletData = { balance: 0, total_earned: totalEarned }; 
        } else {
            // Fallback: If DB column is missing/empty, use calculated value
            walletData.total_earned = walletData.total_earned || totalEarned;
        }

        setProfile(userData);
        setWallet(walletData);
        setStats({ 
          completed: completedCount, 
          earnings: totalEarned 
        });

      } catch (err) {
        console.error("Profile Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, supabase]);

  if (loading || fixingProfile) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-purple animate-spin" />
          <p className="text-white/50 text-sm animate-pulse">
            {fixingProfile ? "Setting up your profile..." : "Loading Profile..."}
          </p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const walletAddress = profile.id ? `0x${profile.id.replace(/-/g, '').slice(0, 16)}...` : "0x0000...";
  const avatarLetter = profile.email ? profile.email[0].toUpperCase() : "U";
  const displayName = profile.name || profile.email.split("@")[0];

  return (
    <main className="min-h-screen bg-[#0B0B11] p-6 lg:p-12 pb-24 text-white selection:bg-brand-purple selection:text-white">
      
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-brand-purple/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-blue/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="max-w-5xl mx-auto space-y-10 relative z-10">

        {/* --- HEADER --- */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-blue rounded-[35px] blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
          
          <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#121217] p-8 md:p-12 shadow-2xl">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-brand-purple/10 blur-[100px] rounded-full pointer-events-none"></div>
            <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
              
              {/* Avatar */}
              <div className="relative">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full p-[3px] bg-gradient-to-tr from-brand-purple via-white to-brand-blue shadow-[0_0_40px_rgba(136,37,245,0.3)]">
                  <div className="w-full h-full rounded-full bg-[#0B0B11] flex items-center justify-center overflow-hidden relative">
                    {profile.avatar_url ? (
                      <Image src={profile.avatar_url} alt="Profile" fill className="object-cover" />
                    ) : (
                      <span className="text-5xl font-black text-white">{avatarLetter}</span>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-1 right-1">
                  {profile.kyc_verified ? (
                    <div className="bg-green-500 text-black p-2.5 rounded-full border-4 border-[#121217] shadow-lg" title="Verified Student">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="bg-yellow-500 text-black p-2.5 rounded-full border-4 border-[#121217] shadow-lg animate-pulse" title="Verification Pending">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left space-y-5">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight capitalize">
                      {displayName}
                    </h1>
                    <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/30 hover:text-white">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-white/60 text-sm font-medium">
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <Mail className="w-4 h-4 text-brand-blue" /> {profile.email}
                    </span>
                    <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                      <Calendar className="w-4 h-4 text-brand-pink" /> Joined {joinDate}
                    </span>
                  </div>
                </div>

                {/* Wallet Chip */}
                <div className="inline-flex items-center gap-4 p-3 pr-6 bg-black/40 rounded-xl border border-white/10 backdrop-blur-md group/wallet cursor-pointer hover:border-brand-purple/50 transition-colors">
                  <div className="p-2.5 bg-brand-purple/20 rounded-lg text-brand-purple">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest mb-0.5">Wallet ID</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono text-white/90 tracking-wide group-hover/wallet:text-brand-purple transition-colors">
                        {walletAddress}
                      </p>
                      <Copy className="w-3 h-3 text-white/30 group-hover/wallet:text-white transition-colors" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Desktop */}
              <div className="hidden md:flex flex-col gap-3 min-w-[140px]">
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 text-center hover:bg-white/10 transition-colors">
                  <div className="text-3xl font-black text-white">{Number(profile.rating || 0).toFixed(1)}</div>
                  <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider flex items-center justify-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Rating
                  </div>
                </div>
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 text-center hover:bg-white/10 transition-colors">
                  <div className="text-3xl font-black text-white">{stats.completed}</div>
                  <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider flex items-center justify-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3 text-brand-green" /> Done
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- KYC VERIFICATION SECTION --- */}
        {!profile.kyc_verified && (
          <div className="relative overflow-hidden rounded-[32px] border border-brand-purple/50 bg-[#1a1a24] p-[1px] shadow-[0_0_50px_rgba(136,37,245,0.15)] group/kyc">
            <div className="absolute inset-0 bg-gradient-to-r from-brand-purple via-brand-pink to-brand-blue opacity-20 group-hover/kyc:opacity-40 transition-opacity duration-500"></div>
            
            <div className="relative bg-[#121217] rounded-[31px] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-start gap-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-brand-purple blur-xl opacity-20 animate-pulse"></div>
                  <div className="relative p-5 bg-brand-purple/10 rounded-2xl border border-brand-purple/30 text-brand-purple">
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                </div>
                
                <div className="space-y-2 max-w-xl">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    Identity Verification Pending
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                  </h2>
                  <p className="text-white/60 leading-relaxed text-sm md:text-base">
                    You are currently an <span className="text-white font-bold">Unverified User</span>. 
                    Upload your valid Student ID to unlock:
                  </p>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm text-white/70">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Instant Gig Approvals</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Higher Acceptance Rate</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Trust Badge on Profile</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500"/> Higher Search Ranking</li>
                  </ul>
                </div>
              </div>

              <Link 
                href="/verify-id" 
                className="w-full md:w-auto px-8 py-4 rounded-xl bg-white text-black font-bold shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all flex items-center justify-center gap-2 group/btn"
              >
                <UploadCloud className="w-5 h-5 group-hover/btn:-translate-y-1 transition-transform" /> 
                <span>Verify Now</span>
              </Link>
            </div>
          </div>
        )}

        {/* --- STATS GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-[32px] border border-white/10 bg-[#121217] p-8 space-y-6 hover:border-white/20 transition-colors group">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-brand-blue group-hover:scale-110 transition-transform" /> Financials
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 bg-white/5 px-2 py-1 rounded">Lifetime</span>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-5 bg-[#0B0B11] border border-white/5 rounded-2xl hover:border-brand-green/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-green/10 flex items-center justify-center border border-brand-green/20">
                    <Wallet className="w-5 h-5 text-brand-green" />
                  </div>
                  <span className="text-white/60 font-medium">Total Earned</span>
                </div>
                <span className="text-2xl font-bold text-white">₹{wallet?.total_earned || 0}</span>
              </div>

              <div className="flex justify-between items-center p-5 bg-[#0B0B11] border border-white/5 rounded-2xl hover:border-brand-pink/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-pink/10 flex items-center justify-center border border-brand-pink/20">
                    <ShieldCheck className="w-5 h-5 text-brand-pink" />
                  </div>
                  <span className="text-white/60 font-medium">Escrow Cleared</span>
                </div>
                <span className="text-2xl font-bold text-white">₹{stats.earnings}</span>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-[#121217] p-8 space-y-6 hover:border-white/20 transition-colors group">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 group-hover:scale-110 transition-transform" /> Reputation
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 bg-white/5 px-2 py-1 rounded">Reviews</span>
            </div>

            {profile.rating_count > 0 ? (
               <div className="flex flex-col items-center justify-center h-[180px] bg-[#0B0B11] border border-white/5 rounded-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[50px] rounded-full"></div>
                 <div className="text-6xl font-black text-white mb-3 tracking-tighter">{profile.rating}</div>
                 <div className="flex justify-center gap-1.5 text-yellow-400 mb-3">
                   {[...Array(5)].map((_, i) => (
                     <Star key={i} className={`w-6 h-6 ${i < Math.round(profile.rating) ? "fill-current drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" : "text-white/10"}`} />
                   ))}
                 </div>
                 <p className="text-white/40 text-sm font-medium">Based on {profile.rating_count} verified reviews</p>
               </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[180px] bg-[#0B0B11] border border-white/5 rounded-2xl text-center p-6 hover:bg-white/5 transition-colors cursor-default">
                <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mb-4">
                  <Star className="w-6 h-6 text-white/20" />
                </div>
                <p className="text-white/40 text-sm leading-relaxed">
                  No reviews yet.<br/>
                  <span className="text-white/20">Complete your first gig to start building your trust score.</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}