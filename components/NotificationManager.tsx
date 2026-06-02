"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

// VAPID public keys are base64url; the browser's pushManager wants a Uint8Array.
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

// Registers the Web Push service worker and subscribes logged-in users so they
// receive notifications (new gigs, messages, application/payment updates) even
// when the tab is closed — provided they've installed/allowed the PWA.
// Anonymous visitors are never prompted (we only ask once a user has signed in).
export default function NotificationManager() {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (typeof window === "undefined") return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) return;
      if (Notification.permission === "denied") return;

      try {
        // Only subscribe authenticated users — the subscription is tied to their row.
        const supabase = supabaseBrowser();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
        }
        if (cancelled) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapid),
          });
        }
        if (cancelled) return;

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub }),
        });
      } catch {
        // Fail silent — push is a best-effort enhancement, never block the app.
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return null;
}
