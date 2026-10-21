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
      <div className="w-full">
        <div className="p-4 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--ok-soft)] text-[var(--ok)] flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="font-bold text-[var(--fg)] text-sm">Telegram Linked</p>
              <p className="text-xs text-[var(--fg-muted)]">You're receiving instant notifications natively.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <button 
        onClick={handleConnect} 
        disabled={clicked}
        className="w-full p-4 rounded-xl border border-[var(--line-strong)] bg-[var(--surface-2)] hover:bg-[var(--chip)] flex flex-col items-center justify-center gap-1.5 transition active:scale-[0.98]"
      >
        <div className="flex items-center gap-2 font-bold text-[var(--fg)] text-base">
          <Send className="text-[#0088cc] w-5 h-5" />
          {clicked ? "Connecting..." : "Connect Telegram Alerts"}
        </div>
        <p className="text-[12px] leading-relaxed text-[var(--fg-muted)] text-center max-w-[300px]">
          Requires the free Telegram App. Link your account to get instant push notifications for gigs and messages.
        </p>
      </button>
    </div>
  );
}
