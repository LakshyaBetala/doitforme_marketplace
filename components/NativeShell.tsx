"use client";

import { useEffect } from "react";

/**
 * Native-only behaviour for the Capacitor builds. Renders nothing, and on the
 * web every effect below short-circuits before any Capacitor code is fetched.
 *
 * WHY THIS EXISTS: the Play Store build loads the live site in a WebView (see
 * capacitor.config.ts for why it is a remote URL and not a static export). A
 * WebView is not a browser, and two of its defaults make a correct web app
 * feel like a broken native one:
 *
 *  1. THE ANDROID BACK BUTTON CLOSES THE APP. It is a hardware button wired to
 *     the Activity, not to history, so on any screen below the landing page the
 *     first press quits — mid-application, mid-chat, mid-KYC upload. This is
 *     the single most-reported complaint about wrapped web apps and it is
 *     invisible in a browser, where the same code is fine. The handler below
 *     walks history instead and only exits at the root.
 *  2. The status bar keeps its own colours, so the dark app renders under dark
 *     system text on Android, which is unreadable.
 *
 * EVERY CAPACITOR IMPORT IS DYNAMIC AND INSIDE THE NATIVE BRANCH. The
 * Cloudflare Worker bundle is the constraint — CLAUDE.md records it at 2.84MB
 * against a 3MB ceiling, and that limit has already broken this build once
 * (the @xenova/transformers trap). A static `import { App } from
 * "@capacitor/app"` would put the whole plugin in the shared chunk that every
 * web visitor downloads, to run code none of them can reach. Dynamic imports
 * put it in a chunk that is only ever requested natively.
 */
export default function NativeShell() {
  useEffect(() => {
    // A plain object check, not an import: reading the global costs nothing and
    // means the web path never touches the module graph at runtime.
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor;
    if (!cap?.isNativePlatform?.()) return;

    let disposed = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      try {
        const [{ App }, { StatusBar, Style }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/status-bar"),
        ]);
        if (disposed) return;

        // Light-on-dark system text, matching --background (#0B0B11).
        await StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
        // Android only; the call is a no-op elsewhere and must not throw.
        await StatusBar.setBackgroundColor({ color: "#0B0B11" }).catch(() => {});

        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          // `canGoBack` is the WebView's own history depth, which is the right
          // question: the user's mental model is the screen they came from, not
          // the route tree. Only quit when there is genuinely nothing behind.
          if (canGoBack) {
            window.history.back();
          } else {
            void App.exitApp();
          }
        });
        if (disposed) {
          void handle.remove();
          return;
        }
        cleanups.push(() => void handle.remove());
      } catch {
        // A missing or failed plugin must never take the screen down with it.
        // The app keeps working; back just behaves as it did before.
      }
    })();

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
