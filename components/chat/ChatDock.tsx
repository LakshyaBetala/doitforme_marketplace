"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { MessagesView } from "@/components/chat/MessagesView";
import { CHAT_DOCK_EVENT, setChatDockReady, type ChatTarget } from "@/lib/chatDock";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const EASE = [0.23, 1, 0.32, 1] as const;

// The full-page inbox owns these routes; a dock on top of it would be the same
// screen twice.
const OWNS_CHAT = ["/messages", "/chat"];

/**
 * The chat bubble in the corner, on every workspace page.
 *
 * Tap it and the inbox opens as a panel that grows out of the bubble; tap a
 * conversation and the thread replaces the list; minimise and it shrinks back
 * into the bubble. Chat buttons elsewhere call `openChatDock()` so a
 * conversation opens here, beside the page, rather than navigating away.
 */
export default function ChatDock() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [chatKey, setChatKey] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [unread, setUnread] = useState(0);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const hidden = OWNS_CHAT.some((p) => pathname?.startsWith(p));

  // Let chat buttons across the app find us.
  useEffect(() => {
    setChatDockReady(true);
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent<ChatTarget>).detail || {};
      setChatKey(t.gigId && t.otherUserId ? `${t.gigId}_${t.otherUserId}` : null);
      setNonce((n) => n + 1); // remount, so a new target always wins over an open thread
      setUnread(0);
      setOpen(true);
    };
    window.addEventListener(CHAT_DOCK_EVENT, onOpen);
    return () => {
      window.removeEventListener(CHAT_DOCK_EVENT, onOpen);
      setChatDockReady(false);
    };
  }, []);

  // A dot for replies that arrive while the panel is closed.
  useEffect(() => {
    const supabase = supabaseBrowser();
    let channel: any;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }: any) => {
      if (cancelled || !data?.user) return;
      channel = supabase
        .channel("dock_unread")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `receiver_id=eq.${data.user.id}` },
          () => {
            if (!openRef.current) setUnread((n) => n + 1);
          }
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // On wide screens the page makes room instead of being covered: the chat is a
  // third column beside it (see html[data-dock] in globals.css), so the buttons
  // under the panel — Apply, Budget — stay visible and clickable.
  const docked = open && !hidden;
  useEffect(() => {
    if (docked) document.documentElement.dataset.dock = "open";
    else delete document.documentElement.dataset.dock;
    return () => {
      delete document.documentElement.dataset.dock;
    };
  }, [docked]);

  if (hidden) return null;

  // Sits above the mobile bottom bar (62px + safe area); on desktop there is none.
  const anchor = "fixed right-4 z-40 bottom-[calc(76px+env(safe-area-inset-bottom))] sm:right-6 lg:bottom-6";

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="bubble"
            type="button"
            onClick={() => {
              setChatKey(null);
              setNonce((n) => n + 1);
              setUnread(0);
              setOpen(true);
            }}
            aria-label={unread > 0 ? `Open messages, ${unread} new` : "Open messages"}
            initial={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
            whileHover={reduce ? undefined : { scale: 1.08 }}
            whileTap={reduce ? undefined : { scale: 0.93 }}
            transition={{ duration: 0.28, ease: EASE }}
            className={`${anchor} flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] shadow-[0_14px_34px_-8px_rgba(80,20,120,0.65)] ring-4 ring-[var(--w-page)]`}
          >
            {unread > 0 && <span aria-hidden className="soft-ping absolute inset-0 rounded-full" />}
            <MessageCircle size={27} strokeWidth={2.2} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[var(--w-orange)] px-1.5 text-[12px] font-extrabold text-[#371448] ring-2 ring-[var(--w-page)]">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            role="dialog"
            aria-label="Messages"
            initial={reduce ? { opacity: 0 } : { scale: 0.12, opacity: 0, borderRadius: 40 }}
            animate={{ scale: 1, opacity: 1, borderRadius: 24 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.12, opacity: 0, borderRadius: 40 }}
            transition={{ duration: 0.34, ease: EASE }}
            style={{ transformOrigin: "bottom right" }}
            className={`${anchor} z-50 flex h-[min(640px,calc(100dvh-170px))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden border border-[var(--w-line-strong)] bg-[var(--w-page)] shadow-[0_28px_90px_-16px_rgba(40,10,70,0.55)] lg:h-[min(660px,calc(100dvh-48px))]`}
          >
            <MessagesView key={nonce} embedded initialChat={chatKey} onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
