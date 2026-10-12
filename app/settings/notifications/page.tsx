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

  /*
   * THIS PAGE WAS PAINTING ITSELF DARK INSIDE THE CREAM SHELL.
   *
   * It sits under app/settings/layout.tsx, which wraps everything in
   * WorkspaceLayout and loads workspace-theme.css — the signed-in palette is
   * cream. The page nonetheless set `min-h-screen bg-[#0B0B11] text-white` and
   * dark `#13131A` cards, so the content area rendered as a near-black slab
   * butted against a cream sidebar and topbar. Readable, because the page
   * supplied its own dark background, and obviously wrong the moment you saw
   * it next to any other workspace screen.
   *
   * This is exactly the failure the token contract in CLAUDE.md exists to
   * prevent: `--surface`, `--fg` and friends resolve to dark values on public
   * routes and cream ones under `.workspace`, so naming the ROLE works in both
   * palettes while naming the colour works in neither. The page no longer sets
   * a page background at all — the shell owns that.
   */
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8 text-[var(--fg)]">
      <Link href="/profile" className="inline-flex items-center gap-2 text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors text-sm min-h-11">
        <ArrowLeft className="w-4 h-4" /> Back to Profile
      </Link>

      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-[var(--fg-muted)] mt-1">Choose how doitforme reaches you about gigs, offers, and payouts.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[var(--fg-faint)]" /></div>
      ) : (
        <div className="space-y-4">
          {/* EMAIL */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 bg-[var(--chip)] rounded-xl shrink-0"><Mail className="w-5 h-5 text-[var(--accent-ink)]" aria-hidden="true" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Email</h2>
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ok)]"><CheckCircle2 size={12} aria-hidden="true" /> On</span>
              </div>
              <p className="text-xs text-[var(--fg-muted)] mt-1 break-all">
                Transactional updates go to <strong className="text-[var(--fg)]">{email || "your email"}</strong>. These keep your escrow and applications safe, so they can&apos;t be turned off.
              </p>
            </div>
          </div>

          {/* TELEGRAM */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-5 flex items-start gap-4">
            <div className="p-2.5 bg-[var(--chip)] rounded-xl shrink-0"><Send className="w-5 h-5 text-[var(--brand-blue)]" aria-hidden="true" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold">Telegram</h2>
                {telegramLinked ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ok)]"><CheckCircle2 size={12} aria-hidden="true" /> Connected</span>
                ) : (
                  <span className="text-[11px] text-[var(--fg-faint)]">Not connected</span>
                )}
              </div>
              <p className="text-xs text-[var(--fg-muted)] mt-1">
                Get instant alerts for new offers and messages — faster than email.
              </p>
              {!telegramLinked && userId && (
                <a
                  href={`https://t.me/${TELEGRAM_BOT}?start=${userId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-4 min-h-11 bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/25 hover:bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] text-xs font-bold rounded-xl transition"
                >
                  <Send size={14} aria-hidden="true" /> Connect Telegram
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
