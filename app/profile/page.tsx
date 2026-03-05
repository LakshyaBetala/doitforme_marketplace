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
  Zap, Save, AlertTriangle, Lock, Gift, Copy, Clock
} from "lucide-react";

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

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ completed: 0, earnings: 0, isLightningResponder: false, avgResponseTime: 0 });
  const [loading, setLoading] = useState(true);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Editable fields (ONLY name and phone)
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // Referral state
  const [referralCode, setReferralCode] = useState("");
  const [pointsBalance, setPointsBalance] = useState(0);
  const [referralCount, setReferralCount] = useState(0);
  const [activePoints, setActivePoints] = useState<any[]>([]);
  const [codeCopied, setCodeCopied] = useState(false);

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
          (!userData.name && (meta.full_name || meta.name));

        if (needsSync) {
          const updates = {
            id: user.id,
            email: user.email,
            name: userData?.name || meta.full_name || meta.name || "",
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

        // 4. Calculate Lightning Responder
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
            const { data: myMsgs } = await supabase
              .from("messages")
              .select("gig_id, receiver_id, created_at")
              .eq("sender_id", user.id)
              .in("gig_id", gigIds)
              .order("created_at", { ascending: true });

            if (myMsgs && myMsgs.length > 0) {
              let totalResponseTimeMs = 0;
              let responseCount = 0;

              apps.forEach(app => {
                const firstMsg = myMsgs.find(m => m.gig_id === app.gig_id && m.receiver_id === app.worker_id);
                if (firstMsg) {
                  const diff = new Date(firstMsg.created_at).getTime() - new Date(app.created_at).getTime();
                  if (diff > 0) {
                    totalResponseTimeMs += diff;
                    responseCount++;
                  }
                }
              });

              if (responseCount > 0) {
                avgTime = totalResponseTimeMs / responseCount / (1000 * 60);
                if (avgTime < 30) isLightning = true;
              }
            }
          }
        }

        setProfile(userData);
        setStats({ completed: completedCount, earnings: totalEarned, isLightningResponder: isLightning, avgResponseTime: Math.round(avgTime) });

        // Initialize edit fields (only name & phone are editable)
        setEditName(userData.name || "");
        setEditPhone(userData.phone || "");

        // 5. Fetch Referral data
        if (userData.referral_code) {
          setReferralCode(userData.referral_code);
        }
        setPointsBalance(userData.points_balance || 0);

        const { data: refs } = await supabase
          .from("referrals")
          .select("id")
          .eq("referrer_id", user.id);
        setReferralCount(refs?.length || 0);

        const { data: pts } = await supabase
          .from("points_transactions")
          .select("amount, expires_at, reason")
          .eq("user_id", user.id)
          .eq("type", "EARN")
          .eq("redeemed", false)
          .gt("expires_at", new Date().toISOString())
          .order("expires_at", { ascending: true });
        setActivePoints(pts || []);

      } catch (err) {
        console.error("Profile Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, supabase]);

  const startEditing = () => {
    setIsEditing(true);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    setEditName(profile.name || "");
    setEditPhone(profile.phone || "");
    setIsEditing(false);
    setSaveMessage(null);
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveMessage(null);

    if (!editName.trim()) {
      setSaveMessage({ type: 'error', text: 'Name cannot be empty.' });
      setSaving(false);
      return;
    }

    try {
      // Only update name and phone — college, UPI, email are locked
      const { error: dbError } = await supabase
        .from("users")
        .update({
          name: editName.trim(),
          phone: editPhone.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (dbError) throw dbError;

      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: editName.trim(),
          name: editName.trim(),
          phone: editPhone.trim(),
        },
      });

      if (authError) throw authError;

      // Update local state
      setProfile({
        ...profile,
        name: editName.trim(),
        phone: editPhone.trim(),
        updated_at: new Date().toISOString(),
      });

      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'Profile updated! Next edit available in 14 days.' });
      setTimeout(() => setSaveMessage(null), 4000);

    } catch (err: any) {
      console.error("Save error:", err);
      setSaveMessage({ type: 'error', text: err.message || 'Failed to save profile.' });
    } finally {
      setSaving(false);
    }
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

  // 14-day edit cooldown logic
  const EDIT_COOLDOWN_DAYS = 14;
  const lastEditedAt = profile.updated_at ? new Date(profile.updated_at) : null;
  const now = new Date();
  const cooldownMs = EDIT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const canEdit = !lastEditedAt || (now.getTime() - lastEditedAt.getTime()) >= cooldownMs;
  const nextEditDate = lastEditedAt ? new Date(lastEditedAt.getTime() + cooldownMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  // Check missing fields for alert
  const missingFields: string[] = [];
  if (!profile.name) missingFields.push("Name");
  if (!profile.phone) missingFields.push("Phone");
  if (!profile.college) missingFields.push("College");
  if (!profile.upi_id) missingFields.push("UPI ID");

  return (
    <main className="min-h-[100dvh] bg-[#0B0B11] p-4 md:p-6 lg:p-12 pb-24 text-white selection:bg-brand-purple overflow-x-hidden relative">

      <div className="max-w-5xl mx-auto space-y-6 md:space-y-10 relative z-10">

        {/* Back Button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors py-2 active:scale-95 touch-manipulation">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Profile Incomplete Alert */}
        {missingFields.length > 0 && !isEditing && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
            <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-300 mb-1">Profile incomplete</p>
              <p className="text-xs text-amber-300/70">Missing: {missingFields.join(", ")}. Complete your profile to post gigs and apply.</p>
            </div>
            <button onClick={startEditing} className="shrink-0 px-4 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-xl hover:bg-amber-500/30 transition-all active:scale-95">
              Add Now
            </button>
          </div>
        )}

        {/* Save Message Toast */}
        {saveMessage && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300 ${saveMessage.type === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
            {saveMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span className="text-sm font-bold">{saveMessage.text}</span>
          </div>
        )}

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
                {/* Email (always read-only) */}
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 truncate max-w-full">
                  <Mail className="w-4 h-4 text-[#0097FF] shrink-0" /> {profile.email}
                </span>

                {/* Phone */}
                {profile.phone && (
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-green-400">
                    <Phone className="w-4 h-4 shrink-0" /> {profile.phone}
                  </span>
                )}

                {/* UPI */}
                {profile.upi_id && (
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#8825F5]/10 border border-[#8825F5]/30 text-[#8825F5]">
                    <Wallet className="w-4 h-4 shrink-0" /> {profile.upi_id}
                  </span>
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

            {/* Stats Block */}
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

        {/* ============================================
            EDIT PROFILE SECTION
        ============================================ */}
        <div className="rounded-[28px] md:rounded-[32px] border border-white/10 bg-[#121217] p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-brand-purple" /> Edit Profile
            </h3>
            {!isEditing ? (
              <div className="flex items-center gap-3">
                {!canEdit && (
                  <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Lock size={10} /> Next edit: {nextEditDate}
                  </span>
                )}
                <button
                  onClick={startEditing}
                  disabled={!canEdit}
                  className="px-5 py-2.5 bg-white/5 border border-white/10 text-white text-xs font-bold rounded-xl hover:bg-brand-purple/10 hover:border-brand-purple/30 hover:text-brand-purple transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:border-white/10 disabled:hover:text-white"
                >
                  {canEdit ? 'Edit' : 'Locked'}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelEditing}
                  className="px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 text-xs font-bold rounded-xl hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="px-5 py-2.5 bg-gradient-to-r from-brand-purple to-brand-pink text-white text-xs font-bold rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(136,37,245,0.3)]"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
                />
              ) : (
                <div className="p-4 rounded-xl bg-[#0B0B11] border border-white/5 text-sm flex items-center gap-3">
                  <User size={16} className="text-zinc-500 shrink-0" />
                  <span className={profile.name ? "text-white" : "text-zinc-600 italic"}>{profile.name || "Not set"}</span>
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Phone Number</label>
              {isEditing ? (
                <input
                  type="tel"
                  inputMode="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="w-full p-4 rounded-xl bg-[#0B0B11] border border-white/10 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-brand-purple focus:ring-1 focus:ring-brand-purple transition-all"
                />
              ) : (
                <div className="p-4 rounded-xl bg-[#0B0B11] border border-white/5 text-sm flex items-center gap-3">
                  <Phone size={16} className="text-zinc-500 shrink-0" />
                  <span className={profile.phone ? "text-white" : "text-zinc-600 italic"}>{profile.phone || "Not set"}</span>
                </div>
              )}
            </div>

            {/* College (read-only always) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1">University / College <Lock size={8} className="text-zinc-600" /></label>
              <div className="p-4 rounded-xl bg-[#0B0B11] border border-white/5 text-sm flex items-center gap-3">
                <GraduationCap size={16} className="text-zinc-500 shrink-0" />
                <span className={profile.college ? "text-white" : "text-zinc-600 italic"}>{profile.college || "Not set"}</span>
              </div>
            </div>

            {/* UPI ID (read-only always) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-1">UPI ID <Lock size={8} className="text-zinc-600" /></label>
              <div className="p-4 rounded-xl bg-[#0B0B11] border border-white/5 text-sm flex items-center gap-3">
                <Wallet size={16} className="text-zinc-500 shrink-0" />
                <span className={profile.upi_id ? "text-white" : "text-zinc-600 italic"}>{profile.upi_id || "Not set"}</span>
              </div>
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Email Address <span className="text-zinc-600">(read-only)</span></label>
              <div className="p-4 rounded-xl bg-[#0B0B11] border border-white/5 text-sm flex items-center gap-3">
                <Mail size={16} className="text-zinc-500 shrink-0" />
                <span className="text-zinc-400">{profile.email}</span>
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

        {/* Refer & Earn Section */}
        {referralCode && (
          <section id="refer" className="scroll-mt-24 rounded-[28px] md:rounded-[32px] border border-brand-purple/20 bg-[#121217] p-6 md:p-8 space-y-6 relative overflow-hidden group hover:border-brand-purple/40 transition-colors">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand-purple/5 blur-[100px] rounded-full pointer-events-none group-hover:bg-brand-purple/10 transition-all"></div>

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              {/* Left: Referral Info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-purple/20 to-brand-pink/20 flex items-center justify-center shrink-0 border border-brand-purple/30">
                  <Gift size={26} className="text-brand-purple drop-shadow-[0_0_15px_rgba(136,37,245,0.8)]" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white flex gap-2 items-center">
                    Refer & Earn
                    <span className="px-2 py-0.5 rounded-full bg-brand-pink/20 text-brand-pink text-[10px] uppercase font-bold tracking-widest border border-brand-pink/30">Hot</span>
                  </h3>
                  <p className="text-[12px] text-zinc-400 max-w-sm mt-1">Share your code with friends. You both get 25 Reward Points when they join!</p>
                </div>
              </div>

              {/* Center: Code Share */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex-1 md:flex-none flex items-center justify-between bg-[#0B0B11] border border-white/5 rounded-xl px-4 py-3 gap-4">
                  <span className="text-base font-mono font-black text-white tracking-[0.2em]">{referralCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(referralCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-brand-purple/20 text-zinc-400 hover:text-brand-purple transition-all active:scale-90"
                    title="Copy Code"
                  >
                    {codeCopied ? <CheckCircle2 size={16} className="text-green-400" /> : <Copy size={16} />}
                  </button>
                </div>
                <button
                  onClick={() => {
                    const shareUrl = `${window.location.origin}/login?ref=${referralCode}`;
                    if (navigator.share) {
                      navigator.share({ title: 'Join DoItForMe!', text: `Use my referral code ${referralCode} to sign up!`, url: shareUrl });
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-brand-purple to-brand-pink text-white text-sm font-bold rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-[0_0_15px_rgba(136,37,245,0.3)] whitespace-nowrap"
                >
                  Share Code
                </button>
              </div>
            </div>

            {/* Right: Stats Footer */}
            <div className="pt-4 border-t border-white/5 flex items-center gap-8 overflow-x-auto scrollbar-hide relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                  <User size={16} className="text-zinc-400" />
                </div>
                <div>
                  <div className="text-lg font-black text-white">{referralCount}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Friends Joined</div>
                </div>
              </div>

              <div className="w-px h-8 bg-white/5 shrink-0"></div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Zap size={16} className="text-amber-400 fill-amber-400" />
                </div>
                <div>
                  <div className="text-lg font-black text-amber-400 flex items-baseline gap-1">{pointsBalance}<span className="text-[10px] opacity-60">RP</span></div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Reward Points</div>
                </div>
              </div>

              {activePoints.length > 0 && (
                <>
                  <div className="w-px h-8 bg-white/5 shrink-0"></div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                      <Clock size={16} className="text-red-400" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-red-400 mb-0.5">
                        {(() => {
                          const earliest = activePoints[0]?.expires_at;
                          if (!earliest) return 'N/A';
                          const hoursLeft = Math.max(0, Math.round((new Date(earliest).getTime() - Date.now()) / (1000 * 60 * 60)));
                          return `${hoursLeft}h left`;
                        })()}
                      </div>
                      <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Points Expiry</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
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