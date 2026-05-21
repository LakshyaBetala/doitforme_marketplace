"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Image from "next/image";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import {
  User, Mail, ShieldCheck, ShieldAlert, Star, Briefcase,
  Loader2, Wallet, Calendar, CheckCircle2,
  Phone, GraduationCap, ArrowLeft, Edit2, Check, X,
  Zap, Save, AlertTriangle, Lock, Gift, Copy, Clock, Send, Camera
} from "lucide-react";
import UniversitySelect, { COLLEGES } from "@/components/UniversitySelect";
import TelegramLinkButton from "@/components/TelegramLinkButton";
import Avatar from "@/components/ui/Avatar";

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPreferences, setEditPreferences] = useState<string[]>([]);
  const [editUpiId, setEditUpiId] = useState("");
  const [editCollege, setEditCollege] = useState(COLLEGES[0]);
  const [editCustomCollege, setEditCustomCollege] = useState("");

  const PREFERENCE_OPTIONS = [
    "Tech & Engineering", "Design & Creative", "Science & Medical", "Law & Humanities",
    "Commerce & Finance", "Academics & Gigs", "Errands & Manual Labor", "Writing & Content",
    "Tutoring", "Other"
  ];

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

          let newProfile = null;
          let error = null;

          if (userData) {
              const res = await supabase
                .from("users")
                .update(updates)
                .eq("id", user.id)
                .select()
                .single();
              newProfile = res.data;
              error = res.error;
          } else {
              const res = await supabase
                .from("users")
                .upsert(updates)
                .select()
                .single();
              newProfile = res.data;
              error = res.error;
          }

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
        const totalEarned = completedGigs?.reduce((acc: any, gig: any) => acc + gig.price, 0) || 0;

        // 4. Calculate Lightning Responder
        let isLightning = false;
        let avgTime = 0;

        const { data: myGigs } = await supabase.from("gigs").select("id").eq("poster_id", user.id);
        const gigIds = myGigs?.map((g: any) => g.id) || [];

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

              apps.forEach((app: any) => {
                const firstMsg = myMsgs.find((m: any) => m.gig_id === app.gig_id && m.receiver_id === app.worker_id);
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

        // Initialize edit fields
        setEditName(userData.name ? String(userData.name) : "");
        setEditPhone(userData.phone ? String(userData.phone) : "");
        setEditPreferences(userData.preferences || []);
        setEditUpiId(userData.upi_id ? String(userData.upi_id) : "");
        setEditCollege(userData.college ? String(userData.college) : COLLEGES[0]);
        setEditCustomCollege("");

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage({ type: 'error', text: 'Image must be less than 5MB.' });
      return;
    }
    
    setUploadingAvatar(true);
    setSaveMessage(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/update-avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload avatar");
      }

      setProfile((prev: any) => ({ ...prev, avatar_url: data.avatar_url }));
      setSaveMessage({ type: 'success', text: 'Avatar updated successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    setEditName(profile.name ? String(profile.name) : "");
    setEditPhone(profile.phone ? String(profile.phone) : "");
    setEditPreferences(profile.preferences || []);
    setEditUpiId(profile.upi_id ? String(profile.upi_id) : "");
    setEditCollege(profile.college ? String(profile.college) : COLLEGES[0]);
    setEditCustomCollege("");
    setIsEditing(false);
    setSaveMessage(null);
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveMessage(null);

    if (!String(editName).trim()) {
      setSaveMessage({ type: 'error', text: 'Name cannot be empty.' });
      setSaving(false);
      return;
    }

    let finalUpiId = profile.upi_id;
    if (!profile.upi_id && editUpiId.trim()) {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(editUpiId.trim())) {
        setSaveMessage({ type: 'error', text: 'Invalid UPI ID format. (e.g., name@oksbi)' });
        setSaving(false);
        return;
      }
      finalUpiId = editUpiId.trim();
    }

    let finalCollege = profile.college;
    if (!profile.college) {
      if (editCollege === "Other") {
        finalCollege = editCustomCollege.trim();
        if (!finalCollege) {
          setSaveMessage({ type: 'error', text: 'Please enter your university name.' });
          setSaving(false);
          return;
        }
      } else {
        finalCollege = editCollege;
      }
    }

    try {
      // Update fields
      const updates: any = {
        name: String(editName).trim(),
        phone: String(editPhone).trim(),
        preferences: editPreferences,
        profile_last_edited_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!profile.college && finalCollege) updates.college = finalCollege;
      if (!profile.upi_id && finalUpiId) updates.upi_id = finalUpiId;

      const { error: dbError } = await supabase
        .from("users")
        .update(updates)
        .eq("id", profile.id);

      if (dbError) throw dbError;

      // Update auth metadata
      const authData: any = {
        full_name: String(editName).trim(),
        name: String(editName).trim(),
        phone: String(editPhone).trim(),
      };
      if (!profile.college && finalCollege) authData.college = finalCollege;
      if (!profile.upi_id && finalUpiId) authData.upi_id = finalUpiId;

      const { error: authError } = await supabase.auth.updateUser({
        data: authData,
      });

      if (authError) throw authError;

      // Update local state
      setProfile({
        ...profile,
        ...updates
      });

      setIsEditing(false);
      setSaveMessage({ type: 'success', text: 'Profile updated! Next edit available in 7 days.' });
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

  // 7-day edit cooldown logic (using profile_last_edited_at so new signups aren't locked)
  const EDIT_COOLDOWN_DAYS = 7;
  const lastEditedAt = profile.profile_last_edited_at ? new Date(profile.profile_last_edited_at) : null;
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
    <main className="min-h-[100dvh] bg-[#070B14] p-4 md:p-6 lg:p-12 pb-24 text-white selection:bg-[#8825F5]/30 selection:text-white overflow-x-hidden relative font-sans">
      <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 relative z-10">

        {/* Back Button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors py-2 active:scale-95 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Profile Incomplete Alert */}
        {missingFields.length > 0 && !isEditing && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start md:items-center gap-3">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5 md:mt-0" />
              <div>
                <p className="text-sm font-bold text-amber-400">Profile incomplete</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Missing: {missingFields.join(", ")}. Complete your profile to post and apply.</p>
              </div>
            </div>
            <button onClick={startEditing} className="shrink-0 px-5 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-bold rounded-xl transition-all active:scale-95 whitespace-nowrap">
              Complete Profile
            </button>
          </div>
        )}

        {/* Save Message Toast */}
        {saveMessage && (
          <div className={`rounded-2xl p-4 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-300 ${
            saveMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {saveMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span className="text-sm font-bold">{saveMessage.text}</span>
          </div>
        )}

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ==================================================== */}
          {/* MAIN IDENTITY & EDIT CARD (LEFT BENTO) */}
          {/* ==================================================== */}
          <div className="lg:col-span-7 rounded-[32px] border border-white/5 bg-[#0F141E] shadow-2xl overflow-hidden relative h-fit">
            
            {/* Cover Photo Area */}
            <div className="h-32 md:h-40 bg-gradient-to-br from-[#1E2536] to-[#0A0E17] relative flex items-start justify-end p-5 md:p-6">
              <div className="absolute inset-0 bg-white/5 opacity-20 mix-blend-overlay pointer-events-none"></div>
              
              {/* Edit Controls Top Right */}
              <div className="relative z-10 flex items-center gap-3">
                {!isEditing ? (
                  <>
                    {!canEdit && (
                      <span className="text-[10px] text-white/50 bg-black/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm border border-white/5 hidden md:flex">
                        <Lock size={10} /> Next edit: {nextEditDate}
                      </span>
                    )}
                    <button
                      onClick={startEditing}
                      disabled={!canEdit}
                      className="px-4 py-2 md:px-5 md:py-2.5 bg-black/20 hover:bg-[#8825F5] border border-white/10 hover:border-[#8825F5] text-white text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:hover:bg-black/20 disabled:cursor-not-allowed flex items-center gap-2 backdrop-blur-sm shadow-lg"
                    >
                      <Edit2 size={12} /> {canEdit ? 'Edit Profile' : 'Locked'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={cancelEditing}
                      className="px-4 py-2 md:py-2.5 bg-black/20 border border-white/10 text-white/60 text-xs font-bold rounded-xl hover:bg-white/5 hover:text-white transition-all active:scale-95 backdrop-blur-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveProfile}
                      disabled={saving}
                      className="px-5 py-2 md:py-2.5 bg-[#8825F5] text-white text-xs font-bold rounded-xl hover:bg-[#7D5FFF] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(136,37,245,0.3)]"
                    >
                      {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Profile Content */}
            <div className="px-6 md:px-10 pb-10 relative">
              
              {/* Avatar overlapping cover */}
              <div className="relative -mt-16 mb-6 inline-flex">
                <div className={`w-28 h-28 md:w-32 md:h-32 rounded-full p-[6px] bg-[#0F141E] relative z-10 group cursor-pointer ${stats.isLightningResponder ? "shadow-[0_0_20px_rgba(250,204,21,0.2)]" : ""}`} onClick={() => fileInputRef.current?.click()}>
                  <Avatar src={profile.avatar_url} fallback={avatarLetter} className="w-full h-full text-4xl group-hover:opacity-50 transition-opacity" />
                  <div className="absolute inset-[6px] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    {uploadingAvatar ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-8 h-8 text-white" />}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                </div>
                
                {/* Badges */}
                <div className="absolute bottom-2 right-2 z-20 flex gap-2">
                  {stats.isLightningResponder ? (
                    <div className="bg-yellow-500 text-black p-2 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)]" title="Lightning Responder">
                      <Zap className="w-4 h-4 fill-current" />
                    </div>
                  ) : profile.kyc_verified ? (
                    <div className="bg-emerald-500 text-black p-2 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="bg-amber-500 text-black p-2 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                  )}
                </div>
              </div>

              {/* Name & Title */}
              <div className="space-y-2 mb-10">
                {isEditing ? (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5 block ml-1">Full Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-white text-lg font-bold placeholder:text-white/30 focus:outline-none focus:border-[#8825F5] transition-all"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none flex items-center gap-3">
                      {displayName}
                      {stats.isLightningResponder && (
                        <span className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-widest rounded-md items-center gap-1 hidden md:flex">
                          <Zap size={10} fill="currentColor" /> Lightning
                        </span>
                      )}
                    </h1>
                    
                    {profile.username ? (
                      <Link href={`/u/${profile.username}`} target="_blank" className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 mt-1 w-fit">
                        doitforme.in/u/{profile.username} <Send size={12} className="opacity-50" />
                      </Link>
                    ) : (
                      <Link href="/onboarding" className="text-sm text-[#8825F5] hover:text-[#7D5FFF] transition-colors mt-1 font-medium w-fit">
                        + Claim your @username
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Bento Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                
                {/* Email (Always Read-only) */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5 block ml-1 flex items-center gap-1">
                    Email <span className="normal-case opacity-50 font-normal">(Read Only)</span>
                  </label>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-black/10 border border-transparent text-sm text-zinc-300">
                    <Mail size={16} className="text-zinc-500 shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5 block ml-1">Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#8825F5] transition-all"
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-black/10 border border-transparent text-sm">
                      <Phone size={16} className="text-zinc-500 shrink-0" />
                      <span className={profile.phone ? "text-zinc-300" : "text-zinc-600 italic"}>{profile.phone || "Not set"}</span>
                    </div>
                  )}
                </div>

                {/* UPI ID */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5 block ml-1 flex items-center gap-1">
                    UPI ID {profile.upi_id && <Lock size={10} className="text-zinc-600" />}
                  </label>
                  {isEditing && !profile.upi_id ? (
                    <input
                      type="text"
                      value={editUpiId}
                      onChange={(e) => setEditUpiId(e.target.value)}
                      placeholder="name@oksbi"
                      className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#8825F5] transition-all"
                    />
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-black/10 border border-transparent text-sm">
                      <Wallet size={16} className="text-zinc-500 shrink-0" />
                      <span className={profile.upi_id ? "text-zinc-300 truncate" : "text-zinc-600 italic"}>{profile.upi_id || "Not set"}</span>
                    </div>
                  )}
                </div>

                {/* College */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5 block ml-1 flex items-center gap-1">
                    University / College {profile.college && <Lock size={10} className="text-zinc-600" />}
                  </label>
                  {isEditing && !profile.college ? (
                    <div className="relative z-[60]">
                      <UniversitySelect value={editCollege} onChange={setEditCollege} />
                      {editCollege === "Other" && (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                          <input
                            type="text"
                            placeholder="University Name"
                            value={editCustomCollege}
                            onChange={(e) => setEditCustomCollege(e.target.value)}
                            className="w-full p-3 rounded-xl bg-black/20 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#8825F5] transition-all"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-black/10 border border-transparent text-sm">
                      <GraduationCap size={16} className="text-zinc-500 shrink-0" />
                      <span className={profile.college ? "text-zinc-300 truncate" : "text-zinc-600 italic"}>{profile.college || "Not set"}</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Interests */}
              <div className="mt-8 pt-8 border-t border-white/5">
                <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4 flex justify-between items-center">
                  Interests & Strengths
                  {isEditing && <span className="text-[9px] text-zinc-600 font-normal normal-case">Select 3-5 ({editPreferences.length}/5)</span>}
                </label>
                
                {isEditing ? (
                  <div className="flex flex-wrap gap-2">
                    {PREFERENCE_OPTIONS.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          if (editPreferences.includes(cat)) {
                            setEditPreferences(editPreferences.filter(c => c !== cat));
                          } else if (editPreferences.length < 5) {
                            setEditPreferences([...editPreferences, cat]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${editPreferences.includes(cat) ? 'bg-[#8825F5] text-white border-[#8825F5]' : 'bg-black/20 border-white/10 text-zinc-400 hover:text-white hover:border-white/20'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(!profile.preferences || profile.preferences.length === 0) ? (
                      <span className="text-sm text-zinc-600 italic px-2">No preferences set</span>
                    ) : (
                      profile.preferences.map((cat: string) => (
                        <span key={cat} className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/5 bg-white/5 text-zinc-300">
                          {cat}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* ==================================================== */}
          {/* STATS & ACTIONS (RIGHT BENTO) */}
          {/* ==================================================== */}
          <div className="lg:col-span-5 space-y-6">

            {/* Performance Stats */}
            <div className="rounded-[32px] border border-white/5 bg-[#0F141E] p-6 md:p-8 flex items-center justify-between shadow-xl">
              <div className="space-y-1 flex-1">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1.5 mb-2"><Briefcase size={12} className="text-zinc-400"/> Total Earned</div>
                <div className="text-3xl font-black text-white tracking-tight">₹{stats.earnings}</div>
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">✓ {stats.completed} GIGS</div>
              </div>
              
              <div className="w-px h-16 bg-white/10 mx-6"></div>
              
              <div className="space-y-1 flex-1">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold flex items-center gap-1.5 mb-2"><Star size={12} className="text-yellow-500"/> Reputation</div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-black text-white tracking-tight">{(!profile.rating || profile.rating_count === 0) ? "NA" : Number(profile.rating).toFixed(1)}</div>
                </div>
                <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">{profile.rating_count || 0} REVIEWS</div>
              </div>
            </div>

            {/* KYC Pending Alert (if applicable) */}
            {!profile.kyc_verified && (
              <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/5 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/20 text-amber-500 rounded-xl shrink-0">
                    <ShieldAlert size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-400">Verification Pending</h3>
                    <p className="text-amber-400/60 text-xs mt-0.5">Required to post & apply.</p>
                  </div>
                </div>
                <Link href="/verify-id" className="w-full sm:w-auto px-5 py-2.5 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded-xl transition-all whitespace-nowrap text-center text-center">
                  Verify Now
                </Link>
              </div>
            )}

            {/* Worker Setup CTA */}
            <div className="rounded-[32px] border border-white/5 bg-[#0F141E] p-6 md:p-8 flex flex-col gap-6 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-[50px] pointer-events-none transition-all"></div>
              
              <div className="flex items-start gap-4 relative z-10">
                <div className="p-3 bg-white/5 rounded-xl shrink-0 border border-white/5">
                  <Briefcase size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">Worker Profile</h3>
                  <p className="text-zinc-400 text-[13px] mt-1.5 leading-relaxed">Add specialized skills, portfolio links, and your resume to stand out to employers.</p>
                </div>
              </div>
              
              <Link href="/profile/worker-setup" className="w-full py-3.5 bg-white/10 border border-white/10 text-white font-bold rounded-xl text-center hover:bg-white/20 active:scale-95 transition-all relative z-10 text-sm">
                {profile.skills && profile.skills.length > 0 ? "Edit Details" : "Setup Profile"}
              </Link>
            </div>

            {/* Refer & Earn */}
            {referralCode && (
              <div className="rounded-[32px] border border-white/5 bg-[#0F141E] p-6 shadow-xl relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-4 relative z-10">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20">
                    <Gift size={14} className="text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white tracking-wide">Refer & Earn</h3>
                </div>
                
                <p className="text-xs text-zinc-400 mb-5 leading-relaxed relative z-10">Share your code with friends. You both get 25 Reward Points when they join!</p>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 relative z-10">
                  <div className="flex-1 w-full flex items-center justify-between bg-black/20 border border-white/5 rounded-xl px-4 py-3">
                    <span className="text-sm font-mono font-bold text-white tracking-[0.2em]">{referralCode}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(referralCode);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      }}
                      className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                    >
                      {codeCopied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
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
                    className="w-full sm:w-auto px-6 py-3 bg-white/5 border border-white/5 text-white text-xs font-bold rounded-xl hover:bg-white/10 transition-all active:scale-95 whitespace-nowrap"
                  >
                    Share
                  </button>
                </div>
              </div>
            )}

            {/* Telegram Notifications */}
            <div className="rounded-[24px] border border-[#0088cc]/20 bg-[#0F141E] p-5 relative overflow-hidden shadow-xl">
              <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 w-full">
                <div className="flex-1 w-full text-center sm:text-left">
                  <h3 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                    <Send size={14} className="text-[#0088cc]" /> Telegram Sync
                  </h3>
                </div>
                <div className="w-full sm:w-auto text-center sm:text-right">
                  <TelegramLinkButton userId={profile.id} isLinked={!!profile.telegram_chat_id} />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Logout */}
        <div className="flex justify-center pt-8 pb-4 relative z-10">
          <div className="w-full md:w-auto min-w-[200px] active:scale-95 transition-transform">
            <LogoutButton />
          </div>
        </div>

      </div>
    </main>
  );
}