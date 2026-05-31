"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { ArrowLeft, Mail, Send, CheckCircle2, Loader2 } from "lucide-react";

const TELEGRAM_BOT = "doitforme_alerts_bot";

export default function NotificationSettingsPage() {
  const supabase = supabaseBrowser();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [telegramLinked, setTelegramLinked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("users")
        .select("email, telegram_chat_id")
        .eq("id", user.id)
        .single();
      setEmail(data?.email || user.email || null);
      setTelegramLinked(Boolean(data?.telegram_chat_id));
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="min-h-screen bg-[#0B0B11] text-white">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">
        <Link href="/profile" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </Link>

        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-white/50 mt-1">Choose how doitforme reaches you about gigs, offers, and payouts.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
        ) : (
          <div className="space-y-4">
            {/* EMAIL */}
            <div className="bg-[#13131A] border border-white/[0.08] rounded-2xl p-5 flex items-start gap-4">
              <div className="p-2.5 bg-white/[0.04] rounded-xl shrink-0"><Mail className="w-5 h-5 text-[#C9A9FF]" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Email</h2>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 size={12} /> On</span>
                </div>
                <p className="text-xs text-white/50 mt-1 break-all">
                  Transactional updates go to <strong className="text-white/80">{email || "your email"}</strong>. These keep your escrow and applications safe, so they can&apos;t be turned off.
                </p>
              </div>
            </div>

            {/* TELEGRAM */}
            <div className="bg-[#13131A] border border-white/[0.08] rounded-2xl p-5 flex items-start gap-4">
              <div className="p-2.5 bg-white/[0.04] rounded-xl shrink-0"><Send className="w-5 h-5 text-[#0097FF]" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-semibold">Telegram</h2>
                  {telegramLinked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 size={12} /> Connected</span>
                  ) : (
                    <span className="text-[11px] text-white/40">Not connected</span>
                  )}
                </div>
                <p className="text-xs text-white/50 mt-1">
                  Get instant alerts for new offers and messages — faster than email.
                </p>
                {!telegramLinked && userId && (
                  <a
                    href={`https://t.me/${TELEGRAM_BOT}?start=${userId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-[#0097FF]/10 border border-[#0097FF]/20 hover:bg-[#0097FF]/20 text-[#0097FF] text-xs font-bold rounded-xl transition-all"
                  >
                    <Send size={14} /> Connect Telegram
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
