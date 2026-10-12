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

    // Let CSS target the app without asking Capacitor anything. Set
    // synchronously, before any await, so the native-only rules in globals.css
    // apply on the first paint rather than snapping in a frame later.
    const root = document.documentElement;
    root.classList.add("native");
    cleanups.push(() => root.classList.remove("native"));

    /*
     * AN APP DOES NOT OPEN ON A MARKETING PAGE.
     *
     * `/` renders components/home/LandingPage — the acquisition page, with the
     * "India's Campus Freelance Network" hero and a sign-up call to action.
     * That is right for a first-time visitor on the web and wrong for every
     * single launch of an installed app: a student who installed it has already
     * been acquired, and being pitched the product they are holding is the
     * clearest reason the app "feels like a website".
     *
     * So the app opens the product instead. /dashboard is in PROTECTED_ROUTES,
     * so proxy.ts decides what that means: signed in lands on the dashboard,
     * signed out lands on /login. That is exactly the native convention, and it
     * needs no new auth logic here — getting it wrong in a second place is how
     * auth bugs happen.
     *
     * A FULL navigation, not router.replace, so proxy.ts actually runs. The
     * splash is deliberately NOT hidden on this path: it stays up across the
     * second load, so the landing page is never seen. The effect then re-runs
     * on the new page, where the pathname no longer matches and the splash
     * comes down over real content.
     *
     * This runs on mount only. NativeShell lives in the root layout and so
     * mounts once per document — a later tap on a logo linking to `/` is a
     * deliberate navigation and is left alone.
     */
    if (window.location.pathname === "/") {
      window.location.replace("/dashboard");
      return;
    }

    (async () => {
      try {
        const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/status-bar"),
          import("@capacitor/splash-screen"),
        ]);
        if (disposed) return;

        /*
         * Hide the splash now that React has mounted — `launchAutoHide` is
         * false in capacitor.config.ts specifically so this decision is ours.
         * Reaching this line means the remote site has loaded and hydrated, so
         * what is behind the splash is real content rather than a blank
         * WebView.
         *
         * The timeout is the safety net: if the site is unreachable the splash
         * must still come down and let the WebView show its own error, because
         * an app stuck on a logo forever is worse than an app showing a
         * failure. It is cleared on unmount so it cannot fire into a torn-down
         * component.
         */
        const splashTimer = setTimeout(() => {
          void SplashScreen.hide().catch(() => {});
        }, 4000);
        cleanups.push(() => clearTimeout(splashTimer));
        void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});

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
