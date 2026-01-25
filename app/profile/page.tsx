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
  ArrowLeft, Save, Lock, AlertCircle
} from "lucide-react";

export default function ProfilePage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ completed: 0, earnings: 0 });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form States
  const [name, setName] = useState("");
  const [upiId, setUpiId] = useState("");
  
  // Locking: Once data is saved, we lock it to prevent accidental changes
  const [isNameLocked, setIsNameLocked] = useState(false);
  const [isUpiLocked, setIsUpiLocked] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }

        // 1. Fetch Existing Profile
        let { data: userData } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        // 2. AUTO-SYNC: If Profile is missing OR missing fields, pull from Signup Data
        const meta = user.user_metadata || {};
        const needsSync = !userData || !userData.upi_id || !userData.name;

        if (needsSync) {
            console.log("Syncing Signup Data to Profile...");
            
            // Prepare the sync payload
            const updates = {
                id: user.id,
                email: user.email,
                name: userData?.name || meta.full_name || "",
                upi_id: userData?.upi_id || meta.upi_id || "", // <--- Pull UPI from Signup
                phone: userData?.phone || meta.phone || "",
            };

            // Upsert (Create or Update)
            const { data: newProfile, error } = await supabase
                .from("users")
                .upsert(updates)
                .select()
                .single();
            
            if (!error && newProfile) {
                userData = newProfile; // Use the synced data
            }
        }

        if (!userData) {
           console.error("Critical: Profile load failed.");
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

        setProfile(userData);
        setStats({ completed: completedCount, earnings: totalEarned });

        // 4. Set & Lock Fields
        if (userData.name) {
            setName(userData.name);
            setIsNameLocked(true); 
        }
        if (userData.upi_id) {
            setUpiId(userData.upi_id);
            setIsUpiLocked(true); 
        }

      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, supabase]);

  const handleSave = async () => {
    // Basic Format Validation
    const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/;
    if (upiId && !upiRegex.test(upiId)) {
        alert("Invalid UPI ID format. It should look like 'name@oksbi'.");
        return;
    }

    setSaving(true);
    try {
        const updates: any = {};
        if (!isNameLocked) updates.name = name;
        if (!isUpiLocked) updates.upi_id = upiId;

        const { error } = await supabase
            .from("users")
            .update(updates)
            .eq("id", profile.id);

        if (error) throw error;
        
        alert("Profile Saved!");
        if (name) setIsNameLocked(true);
        if (upiId) setIsUpiLocked(true);

    } catch (error: any) {
        alert("Error: " + error.message);
    } finally {
        setSaving(false);
    }
  };

  if (loading) return (
      <div className="min-h-screen bg-[#0B0B11] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-[#8825F5] animate-spin" />
      </div>
  );

  if (!profile) return null;
  const avatarLetter = profile.email ? profile.email[0].toUpperCase() : "U";

  return (
    <main className="min-h-screen bg-[#0B0B11] p-6 lg:p-12 pb-24 text-white">
      <div className="max-w-4xl mx-auto space-y-10">
        
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="bg-[#121217] border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            
            <div className="flex flex-col md:flex-row gap-10">
                {/* Avatar Section */}
                <div className="flex flex-col items-center">
                    <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-[#8825F5] to-[#0097FF] p-1">
                        <div className="w-full h-full bg-[#0B0B11] rounded-full flex items-center justify-center overflow-hidden">
                             {profile.avatar_url ? (
                                <Image src={profile.avatar_url} alt="Profile" fill className="object-cover" />
                             ) : (
                                <span className="text-4xl font-black">{avatarLetter}</span>
                             )}
                        </div>
                    </div>
                    {/* KYC Badge */}
                    <div className="mt-4 px-4 py-1.5 rounded-full border bg-white/5 border-white/10 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                         {profile.kyc_verified ? (
                             <><ShieldCheck className="w-4 h-4 text-green-500" /> <span className="text-green-500">Verified</span></>
                         ) : (
                             <><ShieldAlert className="w-4 h-4 text-yellow-500" /> <span className="text-yellow-500">Pending</span></>
                         )}
                    </div>
                </div>

                {/* Form Section */}
                <div className="flex-1 space-y-6">
                    
                    {/* Name Field */}
                    <div>
                        <label className="text-xs font-bold text-white/40 uppercase mb-2 block">Full Name</label>
                        <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${isNameLocked ? 'bg-white/5 border-white/5 cursor-not-allowed' : 'bg-[#0B0B11] border-white/20 focus-within:border-[#8825F5]'}`}>
                            <User className="w-5 h-5 text-white/50" />
                            <input 
                                type="text" 
                                value={name}
                                onChange={(e) => !isNameLocked && setName(e.target.value)}
                                disabled={isNameLocked}
                                placeholder="Enter Full Name"
                                className="bg-transparent w-full outline-none font-bold text-lg disabled:text-white/50"
                            />
                            {isNameLocked && <Lock className="w-4 h-4 text-white/30" />}
                        </div>
                    </div>

                    {/* UPI Field */}
                    <div>
                        <label className="text-xs font-bold text-green-400 uppercase mb-2 flex items-center gap-2">
                           UPI ID for Payouts
                           {isUpiLocked ? (
                               <span className="bg-green-500 text-black px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1">
                                   <ShieldCheck className="w-3 h-3" /> VERIFIED
                               </span>
                           ) : (
                               <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-[10px]">VERIFY CAREFULLY</span>
                           )}
                        </label>
                        <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${isUpiLocked ? 'bg-green-900/10 border-green-500/20 cursor-not-allowed' : 'bg-[#0B0B11] border-green-500/30 focus-within:border-green-500'}`}>
                            <Wallet className="w-5 h-5 text-green-500" />
                            <input 
                                type="text" 
                                value={upiId}
                                onChange={(e) => !isUpiLocked && setUpiId(e.target.value)}
                                disabled={isUpiLocked}
                                placeholder="e.g. user@okaxis"
                                className="bg-transparent w-full outline-none font-bold text-lg text-green-100 placeholder:text-green-500/30 disabled:opacity-60"
                            />
                            {isUpiLocked && <Lock className="w-4 h-4 text-green-500/50" />}
                        </div>
                    </div>

                    {/* Save Button */}
                    {(!isNameLocked || !isUpiLocked) && (
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full py-4 bg-[#8825F5] hover:bg-[#7a1fd6] text-white font-bold rounded-xl transition-all shadow-lg shadow-[#8825F5]/20 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                            Save & Lock Details
                        </button>
                    )}

                </div>
            </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-6">
            <div className="p-6 bg-[#121217] border border-white/10 rounded-2xl text-center">
                <div className="text-3xl font-black text-white">₹{stats.earnings}</div>
                <div className="text-xs text-white/40 uppercase font-bold mt-1">Total Earned</div>
            </div>
            <div className="p-6 bg-[#121217] border border-white/10 rounded-2xl text-center">
                <div className="text-3xl font-black text-white">{stats.completed}</div>
                <div className="text-xs text-white/40 uppercase font-bold mt-1">Gigs Completed</div>
            </div>
        </div>

        <div className="flex justify-center">
             <LogoutButton />
        </div>

      </div>
    </main>
  );
}