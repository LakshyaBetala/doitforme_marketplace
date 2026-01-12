"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { 
  User, Mail, ShieldCheck, ShieldAlert, Star, Briefcase, 
  UploadCloud, Loader2, Wallet, Calendar, CheckCircle2, 
  Phone, GraduationCap, ArrowLeft 
} from "lucide-react";

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [stats, setStats] = useState({ completed: 0, earnings: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push("/login");
          return;
        }

        // 1. Fetch Public Profile
        let { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        // 2. Self-Healing: If profile is missing, create it
        if (!userData) {
          console.warn("Profile missing. Creating default...");
          
          await fetch("/api/auth/create-user", { 
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Only send ID/Email. The API will handle defaults without overwriting if it actually exists.
            body: JSON.stringify({ 
                id: user.id, 
                email: user.email 
            }) 
          });
          
          // Retry fetch
          await new Promise(r => setTimeout(r, 1000));
          const retry = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
          userData = retry.data;
        }

        if (!userData) {
           console.error("Critical: Profile creation failed.");
           setLoading(false);
           return; 
        }

        // 3. Fetch Wallet
        let { data: walletData } = await supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        // 4. Fetch Stats
        const { data: completedGigs } = await supabase
          .from("gigs")
          .select("price")
          .eq("assigned_worker_id", user.id)
          .eq("status", "COMPLETED");

        const completedCount = completedGigs?.length || 0;
        const totalEarned = completedGigs?.reduce((acc, gig) => acc + gig.price, 0) || 0;

        if (!walletData) {
            walletData = { balance: 0, total_earned: totalEarned }; 
        } else {
            walletData.total_earned = walletData.total_earned || totalEarned;
        }

        setProfile(userData);
        setWallet(walletData);
        setStats({ completed: completedCount, earnings: totalEarned });

      } catch (err) {
        console.error("Profile Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#8825F5] animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const joinDate = new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const avatarLetter = profile.email ? profile.email[0].toUpperCase() : "U";
  const displayName = profile.name || profile.email.split("@")[0];

  return (
    <main className="min-h-screen bg-[#0B0B11] p-6 lg:p-12 pb-24 text-white selection:bg-brand-purple selection:text-white">
      
      <div className="max-w-5xl mx-auto space-y-10 relative z-10">

        {/* Back Button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Profile Header */}
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#121217] p-8 md:p-12 shadow-2xl">
            <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
              
              {/* Avatar */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full p-[3px] bg-gradient-to-tr from-[#8825F5] via-white to-[#0097FF]">
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
                    <div className="bg-green-500 text-black p-2.5 rounded-full border-4 border-[#121217]">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="bg-yellow-500 text-black p-2.5 rounded-full border-4 border-[#121217]">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 text-center md:text-left space-y-5">
                <div>
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight capitalize">
                    {displayName}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-white/60 text-sm font-medium">
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                    <Mail className="w-4 h-4 text-[#0097FF]" /> {profile.email}
                  </span>
                  {profile.phone && (
                      <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-green-400">
                          <Phone className="w-4 h-4" /> {profile.phone}
                      </span>
                  )}
                  
                  {/* --- NEW: UPI DISPLAY --- */}
                  {profile.upi_id ? (
                      <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#8825F5]/10 border border-[#8825F5]/30 text-[#8825F5]">
                          <Wallet className="w-4 h-4" /> {profile.upi_id}
                      </span>
                  ) : (
                      <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                          <Wallet className="w-4 h-4" /> No UPI Linked
                      </span>
                  )}

                  {profile.college && (
                      <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-yellow-400">
                          <GraduationCap className="w-4 h-4" /> {profile.college}
                      </span>
                  )}
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white/40">
                    <Calendar className="w-4 h-4" /> Joined {joinDate}
                  </span>
                </div>
              </div>

              {/* Stats Desktop */}
              <div className="hidden md:flex flex-col gap-3 min-w-[140px]">
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 text-center">
                  <div className="text-3xl font-black text-white">{Number(profile.rating || 0).toFixed(1)}</div>
                  <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider flex items-center justify-center gap-1 mt-1">
                    <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Rating
                  </div>
                </div>
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 text-center">
                  <div className="text-3xl font-black text-white">{stats.completed}</div>
                  <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider flex items-center justify-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" /> Done
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* KYC Section */}
        {!profile.kyc_verified && (
          <div className="rounded-[24px] border border-[#8825F5]/50 bg-[#1A1A24] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#8825F5]/10 to-transparent pointer-events-none"></div>
            <div className="flex items-center gap-4 relative z-10">
               <div className="p-3 bg-[#8825F5]/20 text-[#8825F5] rounded-xl">
                 <ShieldAlert className="w-8 h-8" />
               </div>
               <div>
                 <h3 className="text-lg font-bold text-white">Verification Pending</h3>
                 <p className="text-white/60 text-sm">Upload your Student ID to unlock features.</p>
               </div>
            </div>
            <Link href="/verify-id" className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform relative z-10">
               Verify Now
            </Link>
          </div>
        )}

        {/* Financials & Reviews */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-[32px] border border-white/10 bg-[#121217] p-8 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#0097FF]" /> Financials
            </h3>
            <div className="flex justify-between items-center p-5 bg-[#0B0B11] border border-white/5 rounded-2xl">
               <span className="text-white/60">Total Earned</span>
               <span className="text-2xl font-bold text-white">₹{stats.earnings}</span>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-[#121217] p-8 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" /> Reputation
            </h3>
            <div className="flex flex-col items-center justify-center h-[100px] bg-[#0B0B11] border border-white/5 rounded-2xl">
               <div className="text-4xl font-black text-white">{profile.rating || 0}</div>
               <div className="text-white/40 text-xs mt-1">{profile.rating_count || 0} Reviews</div>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="flex justify-center pt-8">
            <div className="w-full md:w-1/3">
                <LogoutButton />
            </div>
        </div>

      </div>
    </main>
  );
}