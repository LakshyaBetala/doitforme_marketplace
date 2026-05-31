"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Bell, MessageSquare, Briefcase, CheckCheck } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  content: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// Drop-in notification bell. Reads the user's own rows from `public.notifications`
// (populated by DB triggers), shows an unread count, subscribes to new ones in
// real time, and marks everything read when opened.
export default function NotificationBell() {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("id, type, content, link, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      const rows = (data as Notification[]) || [];
      setItems(rows);
      setUnread(rows.filter((n) => !n.is_read).length);

      channel = supabase
        .channel("notifications:" + user.id)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload: { new: Notification }) => {
            setItems((prev) => [payload.new, ...prev].slice(0, 20));
            setUnread((c) => c + 1);
          }
        )
        .subscribe();
    })();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [supabase]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
      }
    }
  };

  const go = (n: Notification) => {
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={toggle}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/15 text-zinc-400 hover:text-white transition-colors relative"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-brand-purple text-white text-[10px] font-bold rounded-full border-2 border-[#0B1021]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-80 max-w-[90vw] bg-[var(--card)] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {items.length > 0 && <CheckCheck size={14} className="text-white/30" />}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-white/40">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => go(n)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0"
                >
                  <span className="mt-0.5 shrink-0 text-[#C9A9FF]">
                    {n.type === "message" ? <MessageSquare size={15} /> : <Briefcase size={15} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-white/80 leading-snug">{n.content}</span>
                    <span className="block text-[10px] text-white/35 mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-purple shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}
