"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

interface CrossDomainLinkProps {
  targetDomain: string; // e.g. "https://marketforme.in"
  redirectTo?: string; // e.g. "/dashboard"
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export default function CrossDomainLink({ 
  targetDomain, 
  redirectTo = "/dashboard", 
  children, 
  className = "",
  onClick
}: CrossDomainLinkProps) {
  const [loading, setLoading] = useState(false);

  const handleCrossDomainNav = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (onClick) onClick(e);
    
    setLoading(true);
    try {
      const supabase = supabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      
      const targetUrl = new URL(`${targetDomain}/auth-transfer`);
      targetUrl.searchParams.set('redirect_to', redirectTo);
      
      if (session) {
        targetUrl.searchParams.set('access_token', session.access_token);
        targetUrl.searchParams.set('refresh_token', session.refresh_token);
      }
      
      window.location.href = targetUrl.toString();
    } catch (err) {
      console.error("Failed to generate cross-domain link", err);
      // Fallback
      window.location.href = `${targetDomain}${redirectTo}`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleCrossDomainNav}
      className={className}
      disabled={loading}
    >
      {loading ? "Switching..." : children}
    </button>
  );
}
