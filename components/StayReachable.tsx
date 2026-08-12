"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Send, Share, Plus, X } from "lucide-react";

/**
 * "Stay reachable" — shown right after a hire, on both sides.
 *
 * The failure mode this exists for: both parties get one notification when the
 * hire happens, and if either misses it the work never starts. Nobody sits on a
 * screen waiting. Money stays in escrow doing nothing.
 *
 * Asked HERE rather than at signup because this is the one moment the request
 * is obviously in the user's own interest — they have money on the line. Only
 * 7 of 1,069 users had connected Telegram when it was buried in settings.
 *
 * iOS is called out separately and deliberately: Safari does not deliver web
 * push to a browser tab under any circumstances. Installing to the Home Screen
 * is not a nice-to-have there, it is the prerequisite for receiving anything.
 */

type Props = {
  telegramLinked?: boolean;
  className?: string;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari exposes this non-standard flag instead of display-mode.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function StayReachable({ telegramLinked = false, className = "" }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [pushState, setPushState] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setIos(isIos());
    setInstalled(isStandalone());
    if (typeof Notification !== "undefined") setPushState(Notification.permission);
  }, []);

  const pushGranted = pushState === "granted";
  // Nothing left to ask for.
  if (dismissed || (telegramLinked && (pushGranted || (ios && installed)))) return null;

  const enablePush = async () => {
    if (typeof Notification === "undefined") return;
    const res = await Notification.requestPermission();
    setPushState(res);
  };

  return (
    <div className={`rounded-2xl border border-[var(--brand-purple)]/25 bg-[var(--brand-purple)]/[0.06] p-4 sm:p-5 ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-[13px] font-semibold text-white">Don&apos;t miss their messages</p>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-white/40 hover:text-white/70 transition shrink-0"
        >
          <X size={14} />
        </button>
      </div>
      <p className="text-[12px] text-white/60 leading-relaxed mb-4">
        Work stalls when one side stops checking. Pick a way for us to reach you.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        {!telegramLinked && (
          <Link
            href="/settings/notifications"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--brand-purple)] hover:opacity-90 text-white text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            <Send size={15} /> Connect Telegram
          </Link>
        )}

        {/* On iOS, push simply does not work in a tab — installing is the ask. */}
        {ios && !installed ? (
          <span className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/80 text-[12px] font-medium min-h-[44px] text-center leading-snug">
            <Share size={14} className="shrink-0" />
            Tap Share <Plus size={12} className="shrink-0" /> Add to Home Screen
          </span>
        ) : (
          !pushGranted &&
          pushState !== "unsupported" && (
            <button
              onClick={enablePush}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
            >
              <Bell size={15} /> Turn on alerts
            </button>
          )
        )}
      </div>

      {ios && !installed && (
        <p className="text-[11px] text-white/45 mt-3 leading-relaxed">
          On iPhone, alerts only work once doitforme is added to your Home Screen — Safari
          can&apos;t notify you from a normal tab.
        </p>
      )}
    </div>
  );
}
