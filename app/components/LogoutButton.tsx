"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react"; // Assuming you have lucide-react installed

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = supabaseBrowser();

  const handleLogout = async () => {
    setLoading(true);
    // 1. Sign out from Supabase (clears cookies)
    await supabase.auth.signOut();
    
    // 2. Refresh router to clear server cache & redirect
    router.refresh(); 
    router.replace("/login"); 
    setLoading(false);
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-3 w-full p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
    >
      <LogOut size={20} />
      <span className="font-medium">{loading ? "Logging out..." : "Logout"}</span>
    </button>
  );
}