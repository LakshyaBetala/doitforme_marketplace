"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import {
  User, Mail, ShieldCheck, ShieldAlert, Star, Briefcase,
  Loader2, Wallet, Calendar, CheckCircle2,
  Phone, GraduationCap, ArrowLeft, Edit2, Check, X,
  Zap // Imported for Lightning Responder
} from "lucide-react";

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ completed: 0, earnings: 0, isLightningResponder: false, avgResponseTime: 0 });
  const [loading, setLoading] = useState(true);

  // UPI Editing State
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [tempUpi, setTempUpi] = useState("");
  const [savingUpi, setSavingUpi] = useState(false);

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

        // 2. CRITICAL SYNC: Check Signup Metadata vs DB
        const meta = user.user_metadata || {};
        const needsSync = !userData ||
          (!userData.upi_id && meta.upi_id) ||
          (!userData.name && meta.full_name);

        if (needsSync) {
          console.log("Syncing Profile Data...");
          const updates = {
            id: user.id,
            email: user.email,
            name: userData?.name || meta.full_name || "",
            upi_id: userData?.upi_id || meta.upi_id || "",
            phone: userData?.phone || meta.phone || "",
            college: userData?.college || meta.college || "",
          };

          const { data: newProfile, error } = await supabase
            .from("users")
            .upsert(updates)
            .select()
            .single();

          if (!error && newProfile) {
            userData = newProfile;
          }
        }

        if (!userData) {
          console.error("Profile load failed.");
          setLoading(false);
          return;
        }

        // 3. Fetch Stats
        const { data: completedGigs } = await supabase
          .from("gigs")
          .select("price")
          .eq("assigned_worker_id", user.id)
          .eq("status", "COMPLETED");

        const completedCount = completedGigs?.length || 0;
        const totalEarned = completedGigs?.reduce((acc, gig) => acc + gig.price, 0) || 0;

        // 4. Calculate Lightning Responder (V4)
        // Logic: Avg time from Application Created -> First Message by Poster
        let isLightning = false;
        let avgTime = 0;

        const { data: myGigs } = await supabase.from("gigs").select("id").eq("poster_id", user.id);
        const gigIds = myGigs?.map(g => g.id) || [];

        if (gigIds.length > 0) {
          const { data: apps } = await supabase
            .from("applications")
            .select("id, gig_id, worker_id, created_at")
            .in("gig_id", gigIds);

          if (apps && apps.length > 0) {
            // Fetch MY messages in these gigs
            const { data: myMsgs } = await supabase
              .from("messages")
              .select("gig_id, receiver_id, created_at")
              .eq("sender_id", user.id)
              .in("gig_id", gigIds)
              .order("created_at", { ascending: true }); // Important order

            if (myMsgs && myMsgs.length > 0) {
              let totalResponseTimeMs = 0;
              let responseCount = 0;

              apps.forEach(app => {
                // Find first message to this worker in this gig
                const firstMsg = myMsgs.find(m => m.gig_id === app.gig_id && m.receiver_id === app.worker_id);
                if (firstMsg) {
                  const diff = new Date(firstMsg.created_at).getTime() - new Date(app.created_at).getTime();
                  if (diff > 0) { // Should be positive
                    totalResponseTimeMs += diff;
                    responseCount++;
                  }
                }
              });

              if (responseCount > 0) {
                avgTime = totalResponseTimeMs / responseCount / (1000 * 60); // in minutes
                if (avgTime < 30) isLightning = true;
              }
            }
          }
        }

        setProfile(userData);
        setStats({ completed: completedCount, earnings: totalEarned, isLightningResponder: isLightning, avgResponseTime: Math.round(avgTime) });

      } catch (err) {
        console.error("Profile Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, supabase]);

  const saveUpi = async () => {
    if (!tempUpi.includes("@")) {
      alert("Invalid UPI ID. Format: name@bank");
      return;
    }
    setSavingUpi(true);

    const { error } = await supabase
      .from("users")
      .update({ upi_id: tempUpi })
      .eq("id", profile.id);

    if (!error) {
      setProfile({ ...profile, upi_id: tempUpi });
      setIsEditingUpi(false);
    } else {
      alert("Failed to save UPI.");
    }
    setSavingUpi(false);
  };

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
    <main className="min-h-[100dvh] bg-[#0B0B11] p-4 md:p-6 lg:p-12 pb-24 text-white selection:bg-brand-purple overflow-x-hidden relative">

      <div className="max-w-5xl mx-auto space-y-6 md:space-y-10 relative z-10">

        {/* Back Button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors py-2 active:scale-95 touch-manipulation">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Profile Header */}
        <div className="relative overflow-hidden rounded-[28px] md:rounded-[32px] border border-white/10 bg-[#121217] p-6 md:p-12 shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12">

            {/* Avatar */}
            <div className="relative shrink-0">
              <div className={`w-28 h-28 md:w-32 md:h-32 rounded-full p-[3px] ${stats.isLightningResponder
                ? "bg-gradient-to-tr from-yellow-400 via-white to-yellow-600 shadow-[0_0_20px_rgba(250,204,21,0.4)] animate-pulse"
                : "bg-gradient-to-tr from-[#8825F5] via-white to-[#0097FF]"}`
              }>
                <div className="w-full h-full rounded-full bg-[#0B0B11] flex items-center justify-center overflow-hidden relative">
                  {profile.avatar_url ? (
                    <Image src={profile.avatar_url} alt="Profile" fill className="object-cover" />
                  ) : (
                    <span className="text-4xl md:text-5xl font-black text-white">{avatarLetter}</span>
                  )}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 md:bottom-1 md:right-1">
                {stats.isLightningResponder ? (
                  <div className="bg-yellow-500 text-black p-2 rounded-full border-4 border-[#121217] shadow-lg" title="Lightning Responder">
                    <Zap className="w-5 h-5 md:w-6 md:h-6 fill-current" />
                  </div>
                ) : profile.kyc_verified ? (
                  <div className="bg-green-500 text-black p-2 rounded-full border-4 border-[#121217]">
                    <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                ) : (
                  <div className="bg-yellow-500 text-black p-2 rounded-full border-4 border-[#121217]">
                    <ShieldAlert className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left space-y-5 w-full">
              <div>
                <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight capitalize leading-tight flex items-center justify-center md:justify-start gap-3">
                  {displayName}
                  {stats.isLightningResponder && (
                    <span className="hidden md:inline-flex px-3 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold uppercase tracking-widest rounded-full items-center gap-1">
                      <Zap size={12} fill="currentColor" /> Lightning Responder
                    </span>
                  )}
                </h1>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3 text-white/60 text-xs md:text-sm font-medium">

                {/* Email */}
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 truncate max-w-full">
                  <Mail className="w-4 h-4 text-[#0097FF] shrink-0" /> {profile.email}
                </span>

                {/* Phone */}
                {profile.phone && (
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-green-400">
                    <Phone className="w-4 h-4 shrink-0" /> {profile.phone}
                  </span>
                )}

                {/* --- UPI LOGIC START --- */}
                {profile.upi_id ? (
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#8825F5]/10 border border-[#8825F5]/30 text-[#8825F5]">
                    <Wallet className="w-4 h-4 shrink-0" /> {profile.upi_id}
                  </span>
                ) : isEditingUpi ? (
                  <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <input
                      className="px-3 py-1.5 rounded-lg bg-[#1A1A24] border border-white/20 text-white text-base outline-none focus:border-[#8825F5] placeholder:text-white/20 w-40 md:w-48"
                      placeholder="user@bank"
                      value={tempUpi}
                      onChange={(e) => setTempUpi(e.target.value)}
                      autoFocus
                    />
                    <button onClick={saveUpi} disabled={savingUpi} className="p-2 bg-green-500/20 text-green-500 rounded-lg active:scale-90 touch-manipulation">
                      {savingUpi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button onClick={() => setIsEditingUpi(false)} className="p-2 bg-red-500/20 text-red-500 rounded-lg active:scale-90 touch-manipulation">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditingUpi(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 active:scale-95 touch-manipulation">
                    <Wallet className="w-4 h-4 shrink-0" /> Add UPI ID <Edit2 className="w-3 h-3 opacity-70" />
                  </button>
                )}

                {/* College */}
                {profile.college && (
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-yellow-400">
                    <GraduationCap className="w-4 h-4 shrink-0" /> {profile.college}
                  </span>
                )}

                {/* Join Date */}
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-white/40">
                  <Calendar className="w-4 h-4 shrink-0" /> Joined {joinDate}
                </span>
              </div>
            </div>

            {/* Stats Block - Optimized Grid for Mobile */}
            <div className="flex md:flex-col gap-3 w-full md:w-auto md:min-w-[140px]">
              <div className="flex-1 p-4 md:p-5 bg-white/5 rounded-2xl border border-white/5 text-center">
                <div className="text-2xl md:text-3xl font-black text-white">{Number(profile.rating || 0).toFixed(1)}</div>
                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider flex items-center justify-center gap-1 mt-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" /> Rating
                </div>
              </div>
              <div className="flex-1 p-4 md:p-5 bg-white/5 rounded-2xl border border-white/5 text-center">
                <div className="text-2xl md:text-3xl font-black text-white">{stats.completed}</div>
                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider flex items-center justify-center gap-1 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" /> Done
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KYC Section */}
        {!profile.kyc_verified && (
          <div className="rounded-[24px] border border-[#8825F5]/50 bg-[#1A1A24] p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden active:scale-[0.99] transition-transform">
            <div className="absolute inset-0 bg-gradient-to-r from-[#8825F5]/10 to-transparent pointer-events-none"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-[#8825F5]/20 text-[#8825F5] rounded-xl shrink-0">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-lg font-bold text-white">Verification Pending</h3>
                <p className="text-white/60 text-sm">Upload Student ID to unlock features.</p>
              </div>
            </div>
            <Link href="/verify-id" className="w-full md:w-auto px-8 py-3 bg-white text-black font-bold rounded-xl text-center active:scale-95 transition-all relative z-10 touch-manipulation">
              Verify Now
            </Link>
          </div>
        )}

        {/* Financials & Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="rounded-[28px] md:rounded-[32px] border border-white/10 bg-[#121217] p-6 md:p-8 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-[#0097FF]" /> Financials
            </h3>
            <div className="flex justify-between items-center p-5 bg-[#0B0B11] border border-white/5 rounded-2xl">
              <span className="text-sm text-white/60">Total Earned</span>
              <span className="text-xl md:text-2xl font-bold text-white">₹{stats.earnings}</span>
            </div>
          </div>

          <div className="rounded-[28px] md:rounded-[32px] border border-white/10 bg-[#121217] p-6 md:p-8 space-y-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" /> Reputation
            </h3>
            <div className="flex flex-col items-center justify-center h-[100px] bg-[#0B0B11] border border-white/5 rounded-2xl">
              <div className="text-3xl md:text-4xl font-black text-white">{profile.rating || 0}</div>
              <div className="text-white/40 text-[10px] tracking-widest uppercase mt-1">{profile.rating_count || 0} Reviews</div>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="flex justify-center pt-4 md:pt-8">
          <div className="w-full md:w-1/3 active:scale-95 transition-transform touch-manipulation">
            <LogoutButton />
          </div>
        </div>

      </div>
    </main>
  );
}