"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";

export default function TelegramLinkButton({ 
  userId, 
  isLinked = false 
}: { 
  userId: string;
  isLinked?: boolean;
}) {
  const [clicked, setClicked] = useState(false);
  const botUsername = "doitforme_alerts_bot"; // Using real bot username

  const handleConnect = () => {
    setClicked(true);
    // The 'start' parameter is natively read by Telegram
    window.open(`https://t.me/${botUsername}?start=${userId}`, "_blank");
  };

  if (isLinked) {
    return (
      <div className="w-full relative group">
        <div className="absolute inset-0 bg-[#0088cc]/10 rounded-xl blur pointer-events-none"></div>
        <div className="p-4 rounded-xl border border-[#0088cc]/30 bg-[#1A1A24] flex items-center justify-between relative z-10 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="font-bold text-white text-sm">Telegram Linked</p>
              <p className="text-xs text-white/50">You're receiving instant notifications natively.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full relative group">
      <div className="absolute inset-0 bg-[#0088cc]/20 rounded-xl blur group-hover:bg-[#0088cc]/30 transition-all pointer-events-none"></div>
      <button 
        onClick={handleConnect} 
        disabled={clicked}
        className="w-full p-4 rounded-xl border border-[#0088cc]/50 bg-[#1A1A24] hover:bg-[#1A1A24] flex flex-col items-center justify-center gap-2 relative z-10 transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-2 font-bold text-white text-base">
          <Send className="text-[#0088cc] w-5 h-5" />
          {clicked ? "Connecting..." : "Connect Telegram Alerts"}
        </div>
        <p className="text-[10px] text-white/50 text-center max-w-[280px]">
          Requires the free Telegram App. Link your account to get instant push notifications for gigs and messages.
        </p>
      </button>
    </div>
  );
}
