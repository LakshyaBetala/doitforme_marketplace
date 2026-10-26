# DoItForMe mobile app

Handoff document. It is written so that a new developer, or a new Claude Code session, can
read this one file and carry on the work without asking the previous author anything.

Last updated: 2026-10-26. Branch: `feat/mobile-app`. Everything for the app lives in
`mobile/`; nothing outside that folder was changed.

---

## 1. What we are building

DoItForMe is an Indian student freelance marketplace. A poster (a student or a business)
puts up a task and pays into escrow. A student worker applies, gets hired, delivers, and is
paid out when the poster approves (or automatically 24 hours after delivery). The website
is the product today; this folder is its native mobile app.

Goal: an **Android APK now**, with the same code shipping to **iOS later with minimal
changes** (the author has no Mac yet). So the app uses Expo modules only and no
Android-specific APIs.

Scope decided with the owner:

- Everything a student or a business can do on the website is in the app.
- **Left out on purpose:** admin tools (disputes, payouts, KYC review, managed queue,
  company clearance), and public or legal pages (terms, privacy, refund, shipping, pricing,
  contact, about). Those open the website in the browser instead.
- **Push notifications are deferred.** In-app alerts (a live banner and a bell) exist.
- The visual look follows the website's cream workspace palette plus the grape and violet
  brand colours (see `lib/theme.ts`). Do not redesign it; keep the palette and basic design.

The app is a **client of the existing backend**. It does not have its own server. There is
exactly one backend: the website's Next.js API routes plus the Supabase project behind it.

## 2. The stack

| Layer | What |
|---|---|
| App | Expo SDK 58, React Native 0.88, React 19.3.0, TypeScript (strict) |
| Navigation | expo-router ~58 (file-based; routes are in `app/`, not `src/app/`) |
| Backend data | Supabase (Postgres, Auth, Realtime, Storage), project ref `wxjurdywtkkyybgbpgzx` |
| Backend logic | The website's API routes in `app/api/*` at the repo root (Next.js 16 on Cloudflare Workers via OpenNext), served at `https://www.doitforme.in` |
| Payments | Razorpay, opened in a WebView (`components/Checkout.tsx`) |
| Builds | EAS Build (cloud), Expo account `infernalcentaur`, project `@infernalcentaur/doitforme` |
| Auth | Supabase email one-time code (OTP). Magic links are disabled. Businesses can also use a password |

Repo layout: this repo is the website (repo root) and the app (`mobile/`) together. The root
`CLAUDE.md` describes the website in depth and is worth reading: it explains escrow, fees,
ratings, RLS traps and the cron jobs, all of which the app depends on.

## 3. How the app talks to the backend (the key design)

There are two paths and both are deliberate.

**Reads** go straight to Supabase with the public anon key under row-level security, like the
website's client components. See `lib/supabase.ts`. Realtime (messages, gig changes,
notifications) is one global listener in `lib/alerts.tsx`. Do not add a second one.

**Writes that need server logic** (hiring, escrow, delivery, approval, disputes, payments,
account deletion and so on) go through the website's existing API routes via `lib/api.ts`.
Those routes identify the caller from a **cookie** written by `@supabase/ssr`, and a phone
has no browser cookie jar. So the app builds the same cookie by hand:

- Name: `sb-<projectRef>-auth-token`
- Value: `base64-` + base64url(JSON of the session), split into chunks of 3180 characters
  named `.0`, `.1` and so on, exactly like `@supabase/ssr` 0.8.0 does.
- The refresh token inside the cookie is replaced with the literal string `"app"`. The real
  refresh token never leaves the device. If the server saw the real one it could rotate it
  and silently log the phone out.
- Requests use `credentials: 'omit'` and attach the `Cookie` header manually. If the access
  token has under 5 minutes left, the app refreshes locally first.

**No server change was needed**, which was the point. The cookie builder is `lib/cookie.ts`.
`npx tsx mobile/scripts/cookie-check.ts` (run from the repo root) proves the format against
the server's own `@supabase/ssr`, including chunking and non-ASCII text. **It has never been
verified on a device with a real login.** That is the single biggest unknown, see section 9.

Other rules that came out of reading the server code:

- **Approve** a delivery with `POST /api/gig/complete` (it records the rating and releases
  escrow). Never also call `/api/escrow/release`; that double-releases.
- **Money direction** is single: the poster pays, the assigned worker is paid. Do not invent
  a second direction. `shared/gigRoles.ts` is the only place that answers role questions.
- **Fees** come only from `shared/fees.ts` (student 5%, business 10%, Razorpay 2% on top).
  Never hardcode a percentage.
- **UPI is asked at delivery, not before.** `/api/gig/deliver` returns `409 UPI_REQUIRED` and
  the app then prompts. Do not move that earlier.
- **Prices are re-read by the server.** The app never sends an amount for payments.
- **Uploads use an ArrayBuffer**, not a Blob (a Blob uploads zero bytes on Android). Photos
  are shrunk first with `expo-image-manipulator`. Limits: documents 5 MB, resumes 2 MB.
  The picker also uses `shared/attachments.ts` for the accept list.
- **Posting a task** inserts into `gigs` under RLS after `POST /api/moderation`, same as the
  website's post page. Moderation fails open; the app relies on the server's regex check.
- **Service adverts** (`SERVICE`) are shopfront listings, never funded. Hiring from one goes
  through `/api/gig/request-service`, which builds a normal engagement.

### Shared rule files

`scripts/sync-shared.mjs` copies these website files **verbatim** into `shared/`:
`lib/fees.ts`, `lib/gigRoles.ts`, `lib/attachments.ts`, `lib/innerCircle.ts`, `lib/upi.ts`,
`lib/phone.ts`. It also generates `shared/colleges.ts` from `components/UniversitySelect.tsx`.
Run `node mobile/scripts/sync-shared.mjs` after the website changes those files, and
`node mobile/scripts/sync-shared.mjs --check` to fail on drift. `shared/imageCompress.ts` is a
mobile-only stub. **Do not edit the copied files in `shared/`**; edit the website original
and re-sync.

## 4. What is in the app

### Screens (`app/`)

| Route file | What it does |
|---|---|
| `_layout.tsx` | The gate. Order: loading; company register if profile is not COMPANY; no session leads to login; COMPANY leads to `/company`; incomplete profile (phone and college) leads to `/finish-profile`; students are kept out of `/company`. Wraps everything in the alerts provider |
| `login.tsx` | Sign in / Sign up tabs, emailed 6-digit code (auto-submits at 6 digits, 30 s resend cooldown), business password step, friendly error mapper, 25 s request timeout, "Try demo" on test builds |
| `finish-profile.tsx` | Name, phone, college picker, optional referral code and UPI. Calls `/api/auth/create-user` then `/api/referral/apply` |
| `company-register.tsx` | Business registration: details, code, logo upload, `/api/company/onboard` |
| `(tabs)/index.tsx` | Home: what needs you today |
| `(tabs)/feed.tsx` | Find tasks, campus filter |
| `(tabs)/post.tsx` | Post a task or a service advert (photos, documents, deadline, GitHub link) |
| `(tabs)/messages.tsx` | Conversations |
| `(tabs)/profile.tsx` | Hub: stats, referral share, links, legal links (open the website), delete account (typed DELETE) |
| `(tabs)/activity.tsx` | My work. Hidden from the tab bar (`href: null`), reached from Home |
| `gig/[id].tsx` | The big role-aware task screen. Apply, request service, message, deliver (with the UPI 409 flow), approve with rating, request changes, dispute, rate poster, hire and pay, fund escrow, take down, company edit, applicant resume |
| `chat/[gigId].tsx` | Chat for a task |
| `u/[username].tsx`, `edit-profile.tsx`, `worker-setup.tsx`, `payouts.tsx` | Public profile, edit profile and avatar, worker profile and resume, earnings |
| `notifications.tsx`, `notification-settings.tsx`, `verify-id.tsx`, `talent.tsx` | Notifications list, Telegram link, student ID upload with camera, service adverts |
| `company/*`, `c/[id].tsx` | Business tab group (dashboard with Company Pro checkout, post a company task, account, messages) and the public company page |
| `inner-circle/*` | Apply, TECH briefs workflow (derived by `shared/innerCircle.ts`), OUTREACH lead tracker |

### Library and components

- `lib/supabase.ts` client with AsyncStorage persistence, auto-refresh tied to AppState, and a
  Proxy that serves demo data when demo mode is on. `lib/session.tsx` holds the session and
  `Profile`. `lib/api.ts` is the cookie-bridged `api()` and `signedUrlFrom()`.
  `lib/alerts.tsx`, `lib/upload.ts`, `lib/theme.ts`, `lib/format.ts`, `lib/demo.ts`.
- `components/`: `ui.tsx` (Card, Pill, Button, Empty, Loading), `form.tsx` (Field, Sheet,
  ErrorText), `GigCard`, `Checkout` (Razorpay WebView), `Attachments`, `DeadlineField`,
  `CollegePicker`.

### Backend surface used

API routes: `auth/create-user`, `auth/check-username`, `referral/apply`, `chat/send`,
`moderation`, `gig/{apply,deliver,complete,request-changes,dispute,rate-poster,hire,
request-service,delete}`, `payments/{create-order,verify-payment}`,
`company/{onboard,edit-task,pro/create-order,pro/verify}`, `profile/{resume,
update-avatar,worker-setup}`, `kyc/upload`, `telegram/broadcast`, `account/delete`.
Tables read: `gigs, users, companies, applications, messages, notifications, ratings,
referrals, payout_queue, inner_circle_applications, outreach_leads, outreach_touches`.
Storage buckets: `gig-images` (public), `resumes` (private, read through `/api/profile/resume`).

### Demo mode

`EXPO_PUBLIC_DEMO=1` (set only in the `preview` EAS profile) adds a "Try demo" button on the
login screen. It serves fixtures from `lib/demo.ts`. Every write, upload and `api()` call is
refused in demo. It exists because the first reviewer had no account. The `production` profile
has no demo.

## 5. Run and build

Requirements: Node 20 or newer (the website needs Node 22+, the app is fine on 20), an Expo
account, and for device testing either an Android phone or an emulator.

```bash
cd mobile
npm install
npx expo start               # dev server; open in Expo Go or a dev build
npx tsc --noEmit             # type-check
npx expo-doctor              # expect 20/20 passing
node scripts/sync-shared.mjs --check
```

Cloud builds (no local Android SDK needed):

```bash
npm i -g eas-cli
eas login                    # account that owns or is a collaborator on the project
eas build -p android --profile preview      # installable .apk, demo button on
eas build -p android --profile production   # release build, no demo, auto-increments version
eas build -p ios --profile production       # needs an Apple Developer account, no Mac required
```

- **Always run `rm -rf node_modules package-lock.json && npm install` before queueing a
  build.** EAS installs from scratch. A peer-dependency conflict (react-dom 19.3.1 against
  react 19.3.0) once failed a build that worked locally. `react-dom` must stay pinned to
  the same version as `react`.
- `eas.json` holds the Supabase URL and the **anon** key in each profile's `env`. The anon key
  is public by design (it ships in every website page). The Supabase **service-role key is
  never used or needed by the app and must never be put in this folder.**
- On Windows Git Bash, `eas` may not be on PATH; call
  `"/c/Users/<you>/AppData/Roaming/npm/eas.cmd"` directly.
- Builds so far: #1 splash only, #2 failed (the ERESOLVE above), #3 read-only app, #4 demo,
  #5 first full-feature, #6 all screens, #7 new login screen. Artifact links on expo.dev
  expire, so rebuild rather than relying on old links.

### Continuing on a different Expo account

The project is owned by Expo user `infernalcentaur` (`app.json` has `owner` and
`extra.eas.projectId`). Either ask that user to add you as a collaborator, or run
`eas init` on your own account and replace `owner` and `projectId` in `app.json`. EAS also
generates the Android keystore on first build and stores it on its servers. **A new account
means a new keystore, which means a different signing key.** Decide this before the first
Play Store upload.

### Branch and commit rules

- Work on `feat/mobile-app` (or branches off it). It is based on `ui-ux-final`.
- Commits must be the committer's own: no `Co-Authored-By: Claude`, no session URL, no
  "Generated with Claude Code" line. The owner asked for this explicitly.
- The root `.gitignore` already ignores `mobile/.env`.

## 6. Current state

Done and type-checked: every screen in section 4, the cookie bridge (offline-verified),
demo mode, app icon and splash, Razorpay checkout flow, realtime alerts, uploads.

Quality gates that pass: `tsc --noEmit`, `expo-doctor` 20/20, `sync-shared --check`,
`cookie-check.ts`, `expo export` (bundling).

## 7. Known blocker: new-user sign-up email times out (server side)

Sign-up from a **new** email currently fails. Reproduced on 2026-10-25 against
`POST https://wxjurdywtkkyybgbpgzx.supabase.co/auth/v1/otp` with `create_user: true`: it
hangs about 35 seconds and returns `504 "upstream request timeout"`.

- Supabase auth itself is healthy: `/auth/v1/health` returns 200 in about 0.5 s, and
  `/auth/v1/settings` shows email enabled, sign-ups allowed, `mailer_autoconfirm: false`.
- The same call with `create_user: false` for an unknown address returns an instant
  `422 "Signups not allowed for otp"`. So only the **email-sending step** hangs.
- Most likely cause (inferred, because SMTP settings cannot be seen from outside): custom
  SMTP is misconfigured or unreachable, or the project is on Supabase's built-in email, which
  only delivers to team members and is heavily rate-limited.
- Fix needs someone with Supabase dashboard access: Authentication > Emails > SMTP Settings
  (host, port 465 or 587, credentials, provider account active), and Logs > Auth at the time
  of a failed attempt. Configure a real provider; the website already uses Brevo, ZeptoMail
  or Resend for its own mail.
- The app already shows a friendly message for this ("Our email service is not responding
  right now. Please try again in a minute.") and has a 25 s client timeout.
- **Retest after the fix:** sign up with a fresh email in the app, receive the code, finish
  the profile, then delete the account from Profile to confirm `/api/account/delete`.

The website is in maintenance mode (`MAINTENANCE_MODE`, page requests return 503) but
`/api/*` still works, which is why the app works against it. If the maintenance flag changes
or `proxy.ts` starts gating `/api`, the app's write path breaks.

## 8. Next steps, in priority order

1. **Fix the Supabase email (section 7), then do a full on-device test** with a real account:
   sign-up, finish profile, feed, apply, chat send, deliver (including the UPI prompt),
   approve with rating, hire and pay (Razorpay inside the WebView, especially UPI apps),
   student ID upload from the camera, account deletion. This is the first time the cookie
   bridge meets a real login. Expect small bugs; keep fixes in the screen or `lib/api.ts`
   rather than changing the server.
2. **Verify the cookie bridge against production**: a signed-in `GET`/`POST` to any
   `/api/*` route should return 200, not 401. If 401, compare the cookie name and chunking
   with `@supabase/ssr` for the version pinned in the root `package.json`.
3. **Decide the application ID.** `in.doitforme.app` is a placeholder in `app.json` (both
   `ios.bundleIdentifier` and `android.package`). It cannot change after the first store
   upload.
4. **Push notifications.** Needs a Firebase project: add `google-services.json`, upload an
   FCM key to EAS, add `expo-notifications`, and a device-token table next to the website's
   `push_subscriptions`. The website's `/api/push/*` routes are Web Push only and will need a
   mobile counterpart. iOS needs an APNs key from an Apple Developer account.
5. **iOS.** Create an Apple Developer account, then `eas build -p ios`. The code is meant to
   need no changes; the likely friction is camera and photo permission strings (already set
   in `app.json`), the Razorpay WebView and safe-area insets.
6. **Store release.** Play Console and App Store need a privacy-policy URL
   (`https://www.doitforme.in/privacy-policy`, currently on the maintenance allow-list) and
   the data-safety / privacy-label forms. Move from APK to an `.aab` with the `production`
   profile. Keystores live on EAS; never commit them.
7. **Brand fonts** (DM Sans, Manrope). The app uses the system font. `expo-font` is already a
   dependency.
8. **Client-side AI moderation.** The website runs a model in the browser; the app uses only
   the server's regex check, which is the same check the website's server runs.
9. **Admin tools in the app.** Deliberately excluded; leave on the website.
10. **Cleanup debt:** `capacitor.config.ts` and `docs/APP.md` at the repo root describe the old
    Capacitor wrapper and are now unused by the mobile effort.

## 9. Untested and risky (be honest about this)

- Nothing that needs a signed-in user has run on a device. All of it was checked by
  type-check, bundling, and the offline cookie test only.
- Razorpay inside a WebView: UPI intent handoff to GPay or PhonePe may behave differently on
  real devices and on iOS.
- Android back-button and keyboard behaviour on the chat and long forms.
- Realtime alert banner under a flaky network and after the app is backgrounded.
- `/about` is not on the website's maintenance allow-list, so the app link to it shows the
  hold page until the site leaves maintenance.

## 10. Tips for the next Claude Code session

- Read `mobile/AGENTS.md` too. It is the Expo template's guidance. One correction: in this
  project routes live in `mobile/app/`, **not** `src/app/`. Expo SDK 58 changes APIs often,
  so check `https://docs.expo.dev/versions/v58.0.0/` before using any Expo API from memory.
- Install Expo packages with `npx expo install <pkg>`, not `npm add`, so versions match the SDK.
- Windows Git Bash notes: write large files with an editor tool rather than heredocs (quoting
  breaks); `rm -rf` on a drive-root path is blocked by a safety check, so write build output
  into a scratch folder.
- Safety: never ask for or use the Supabase service-role key. Do not create real users or send
  real OTP emails against production without the owner's say-so, and delete anything you
  create. Confirm with the owner before pushing to shared branches.
- Before every build: clean install, `tsc --noEmit`, `expo-doctor`, `sync-shared --check`,
  `cookie-check.ts`.
