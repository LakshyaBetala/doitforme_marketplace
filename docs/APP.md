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
| `android/` native project | **generated and committed** (Capacitor 7) |
| Debug APK | **builds** — 21.8 MB, verified 2026-10-13 |
| `ios/` native project | **not generated** — needs Xcode on macOS, impossible on Windows |
| Store listings, signing keys, review | **not started** |

### What the app actually is: `/app`, the Inner Circle surface

The app does **not** open the marketplace. It opens
[app/app/](../app/app/) — bottom tabs, one column, its own palette
([app-theme.css](../app/app/app-theme.css)), gated on membership by
[app/app/layout.tsx](../app/app/layout.tsx) and then again by RLS.
[lib/appShell.ts](../lib/appShell.ts) decides the role (admin > pm > member,
all derived) and the four tabs per role. `NativeShell` sends `/` to `/app` on
launch.

`/app` is in `MAINTENANCE_PUBLIC` in [proxy.ts](../proxy.ts), so **the app
works while the public site is still behind the hold page.** That is
deliberate: it is invite-only and double-gated, and the people using it are the
team delivering client work.

Why not Flutter or React Native: neither reaches iOS without Xcode, because
Xcode is the only iOS compiler Apple ships and it is macOS-only. A cloud macOS
runner (Codemagic, GitHub Actions) removes the need to *own* a Mac, and that
applies to this Capacitor project unchanged. A rewrite would cost 46 screens,
two palettes, auth, escrow, KYC and chat for zero iOS gain.

### Play Store: what is done and what is left

Done: app id `in.doitforme.app`, name "DoItForMe", branded adaptive launcher
icon and splash at every density, release signing wired to a gitignored
properties file, `bundleRelease` producing an AAB, INTERNET as the only
permission.

Left, and none of it is code:

1. **Create the upload key.** Deliberately not generated here — Google pins the
   app id to its signature, so losing it means the listing can never be updated
   and must be republished under a new id. Keep the file and both passwords in
   a password manager.
   ```bash
   keytool -genkeypair -v -keystore doitforme-upload.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
   Then write `android/keystore.properties` (gitignored) as documented in
   [android/app/build.gradle](../android/app/build.gradle), and re-run
   `bundleRelease` — the AAB comes out signed.
2. Play Console account (one-off $25) and a new app entry.
3. Listing: short and full description, feature graphic, at least two phone
   screenshots, and the privacy-policy URL — `/privacy-policy` already exists.
4. The Data safety form. The app collects email, phone, a student ID document
   and a UPI id; answer it from that list honestly.
5. Internal testing track first. Upload the AAB, add yourself as a tester,
   install from Play, and check sign-in, a brief and a payout screen on a real
   phone before any wider release.

`MAINTENANCE_MODE` does not block the app, but the website is still held — so
decide whether the public site should be live before the listing goes public.

### Building the APK: it needs JDK 21, not 17

**`./gradlew assembleDebug` fails with `invalid source release: 21` under JDK
17.** Capacitor 7 targets Java 21, and the error names the version it wanted
rather than the one it found, which makes it read like a Gradle misconfiguration.
A JDK 21 is already on this machine inside Android Studio, so no separate
install is needed:

```bash
cd android
JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" \
ANDROID_HOME="$LOCALAPPDATA/Android/Sdk" \
  ./gradlew assembleDebug --no-daemon
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

Run `npx cap sync android` first whenever a Capacitor plugin is added, or the
native project will not register it.

The Capacitor dependencies **are** now in `package.json`. That is safe for the
Worker because every import in
[components/NativeShell.tsx](../components/NativeShell.tsx) is dynamic and
behind a native-platform check — measured at **+5.24 KiB gzipped**, with the
library itself absent from `.open-next/worker.js`. Keep it that way: the Worker
had **33 KiB** of headroom at the time of writing, so a static Capacitor import
would be a deploy failure rather than a build one.

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
