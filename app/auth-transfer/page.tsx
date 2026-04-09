"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { motion } from "framer-motion";
import Image from "next/image";

export default function AuthTransferPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const transferSession = async () => {
      const accessToken = searchParams.get("access_token");
      const refreshToken = searchParams.get("refresh_token");
      const redirectTo = searchParams.get("redirect_to") || "/dashboard";

      if (!accessToken || !refreshToken) {
        // No tokens = just go to login or maybe they are already logged in via cookie
        const { data: { session } } = await supabaseBrowser().auth.getSession();
        if (session) {
          router.push(redirectTo);
        } else {
          router.push("/login");
        }
        return;
      }

      // We have tokens! Set the session using supabase auth
      const supabase = supabaseBrowser();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error("Auth transfer failed:", sessionError.message);
        setError("Failed to transfer authentication securely.");
        setTimeout(() => router.push("/login"), 2000);
      } else {
        // Successfully transferred! Replace URL so tokens don't sit in browser history
        window.location.replace(redirectTo);
      }
    };

    transferSession();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#0B0B11] flex flex-col items-center justify-center text-white relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#8825F5]/20 rounded-full blur-[100px]" />
      </div>
      
      <div className="relative z-10 flex flex-col items-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-24 h-24 relative mb-6"
        >
          <Image src="/Doitforme_logo.png" alt="DoItForMe" fill className="object-contain" />
        </motion.div>
        
        <h1 className="text-2xl font-bold mb-2">Switching Platforms...</h1>
        {error ? (
          <p className="text-red-400 text-sm">{error}</p>
        ) : (
          <p className="text-zinc-400 text-sm animate-pulse">Establishing secure session</p>
        )}
      </div>
    </div>
  );
}
