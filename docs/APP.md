# Shipping DoItForMe as an app

The web app is already installable as a PWA. This file is about the **store**
builds — an `.apk`/`.aab` for Google Play and an IPA for the App Store — using
Capacitor to wrap the live site.

Read [capacitor.config.ts](../capacitor.config.ts) first; it explains why this
wraps `https://www.doitforme.in` rather than bundling a static export.

## Status

| | |
|---|---|
| PWA (installable, offline shell, home-screen icon) | **done** — manifest, icon set, safe areas, status bar |
| Capacitor config | **done** — `capacitor.config.ts` |
| Native projects (`android/`, `ios/`) | **not generated** — needs Android Studio / Xcode, see below |
| Store listings, signing keys, review | **not started** |

Nothing here runs in CI and none of it affects the Cloudflare build. The
Capacitor dependencies are deliberately **not** in `package.json` yet, so the
Worker bundle does not carry them — add them on the machine doing the native
build.

## What the PWA already does

These were fixed as part of the redesign and all of them matter more in a wrapped
WebView than in a browser tab:

- `viewportFit: "cover"` in [app/layout.tsx](../app/layout.tsx) — until this was
  added, **every `env(safe-area-inset-*)` in the app resolved to `0px`**, so the
  mobile bottom bar sat under the iPhone home indicator.
- Real icon sizes, and a separately padded `maskable` icon, from
  [scripts/make-app-icons.mjs](../scripts/make-app-icons.mjs). The manifest used
  to declare one 890KB 1024×1024 file as both 192px and 512px *and* as maskable,
  which a circular launcher mask cropped the edges off.
- `overscroll-behavior-y: none` — no Android pull-to-refresh firing mid-form.
- `hoverOnlyWhenSupported` in [tailwind.config.js](../tailwind.config.js) — every
  `hover:` utility is now behind `@media (hover: hover)`, so a tapped button
  stops keeping its hover fill.
- `user-select`/`-webkit-touch-callout: none` on controls only — long-press no
  longer selects a button label. Body text stays selectable.
- `theme_color` follows the route via
  [WorkspaceThemeColor](../components/shell/WorkspaceThemeColor.tsx), so the
  status bar is cream in the workspace and dark on the marketing pages.
- `start_url: "/dashboard"` — someone who installed the app has already decided;
  launching them onto a sales page is wrong. It redirects to `/login` with no
  session.

## Generating the native projects

Needs **Node 22+** (same as Wrangler), plus Android Studio for Android and a Mac
with Xcode for iOS.

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android @capacitor/ios

npx cap add android
npx cap add ios        # macOS only

npx cap sync
npx cap open android   # or: npx cap open ios
```

`capacitor.config.ts` is already in place, so `cap add` picks up the app id
(`in.doitforme.app`), the name and the remote URL without further configuration.

`android/` and `ios/` are generated output. Commit them only if you intend to
hand-edit the native manifests (you will, for push and the camera) — otherwise
leave them gitignored and regenerate.

## Before the first submission

Apple rejects "a website in a frame" under guideline **4.2**. A remote-URL
Capacitor app clears review when it uses capability a browser cannot. In order of
how much they help:

1. **Push notifications via APNs/FCM** (`@capacitor/push-notifications`). The app
   already has web push end to end — VAPID keys, subscription storage,
   [push/dispatch](../app/api/push/dispatch/route.ts). Native push reuses that
   fan-out; only the token registration is new. This is also the single most
   valuable feature for the product: an applicant finding out they were hired.
2. **Camera for ID upload** (`@capacitor/camera`). `/verify-id` currently takes a
   file input. A native capture is a markedly better flow for the KYC step and is
   concrete native capability.
3. **Share target / deep links** (`@capacitor/app` + App Links / Universal
   Links), so a shared `/gig/<id>` opens in the app.

Also required, and easy to forget:

- **Privacy policy URL** — [/privacy-policy](../app/privacy-policy) exists.
- **Account deletion from inside the app** — Apple guideline 5.1.1(v) requires
  it for any app with accounts. Today deletion is a support email handled by
  [scripts/delete-account.mjs](../scripts/delete-account.mjs). **This needs an
  in-app path before submission.**
- **Data Safety form** (Play) / **Privacy nutrition labels** (App Store): the app
  collects email, phone, college, a student ID image and a UPI ID.
- A payments answer. Razorpay checkout opens in the system browser via
  `allowNavigation`, which is what keeps this outside Apple's in-app-purchase
  requirement — the goods are real-world services, not digital content. Expect to
  be asked.

## Keys and signing

Do not put signing keys in the repo. Play wants an upload keystore (and uses Play
App Signing); the App Store wants a distribution certificate and provisioning
profile. Keep both in a password manager, not in `android/` or `ios/`.
