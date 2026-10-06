import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wrapper for the Play Store / App Store builds.
 *
 * THE DECISION THIS FILE ENCODES: the app loads the live site over HTTPS
 * (`server.url`) instead of bundling an exported copy of the frontend.
 *
 * Capacitor's documented default is to ship a static `webDir`, and that is the
 * right answer for most apps. It is the wrong answer for this one, because this
 * app is not static. Half of it is server-rendered, every signed-in route is
 * dynamic (`ƒ` in the build output), and there are ~50 route handlers plus
 * proxy.ts doing the auth gating. `next build` with `output: "export"` cannot
 * produce any of that — it would need a second, parallel client-only app, which
 * means two codebases and two sets of auth bugs.
 *
 * What the remote-URL approach costs, stated plainly so nobody discovers it
 * during review:
 *
 *  - No offline support beyond what the service worker already caches. For a
 *    product whose every screen reads live escrow state, that is honest.
 *  - Apple review guideline 4.2 rejects apps that are only a website in a frame.
 *    Clearing it needs native capability the browser does not have — push
 *    notifications through APNs, the camera for ID upload, share targets. Those
 *    are the plugins to add before the first submission, not after.
 *  - A deploy ships to the app instantly, which is the upside: no store review
 *    for a bug fix.
 *
 * ANDROID: `androidScheme: "https"` is required. With the default `http` scheme
 * Android treats the WebView origin as insecure, and Supabase auth cookies are
 * `Secure`, so sign-in silently fails to persist — the user logs in, the app
 * reloads, and they are signed out again.
 *
 * Nothing here runs in CI or in the Cloudflare build. The native projects are
 * generated on a machine with Android Studio / Xcode:
 *
 *   npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios
 *   npx cap add android && npx cap add ios
 *   npx cap sync
 *   npx cap open android
 *
 * See docs/APP.md for the full runbook.
 */
const config: CapacitorConfig = {
  appId: "in.doitforme.app",
  appName: "DoItForMe",

  // Required by the CLI even when `server.url` is set, in which case nothing is
  // served from it. Pointed at public/ so the directory exists and the CLI does
  // not fail on a missing path.
  webDir: "public",

  server: {
    url: "https://www.doitforme.in",
    // Without this, cookies set by Supabase auth (which are Secure) are dropped
    // by the Android WebView and the session never persists.
    androidScheme: "https",
    iosScheme: "https",
    // Only our own origins load in the app shell. Anything else — a payment
    // page, an OAuth consent screen, a link in a gig description — opens in the
    // system browser, which is both the Apple requirement for third-party
    // payment flows and the right security boundary.
    allowNavigation: ["www.doitforme.in", "doitforme.in"],
  },

  android: {
    // Razorpay's checkout and Google OAuth both need a real browser session.
    allowMixedContent: false,
  },

  ios: {
    contentInset: "always",
  },
};

export default config;
