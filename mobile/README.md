# DoItForMe mobile app (Expo / React Native)

Native Android app, written so iOS needs no code changes (Expo modules only, no
Android-only APIs). It replaces the Capacitor wrapper described in `docs/APP.md`;
`capacitor.config.ts` is now unused.

## How it talks to the backend

- **Reads** go straight to Supabase with the anon key and RLS (`lib/supabase.ts`),
  exactly like the website's client components.
- **Writes** go through the website's own API routes (`lib/api.ts`). Those routes read the
  login from a cookie, so the app sends the session as the same cookie
  (`lib/cookie.ts`). **No server change was needed.** The real refresh token never leaves the
  device, because a server-side refresh would rotate it and log the user out.
- `npx tsx mobile/scripts/cookie-check.ts` (run from the repo root) proves the cookie format
  against the server's own `@supabase/ssr`, including chunking and UTF-8.
- Posting a task inserts into `gigs` under RLS after `/api/moderation`, same as `app/post`.

## Run and build

```bash
cd mobile
npm install
npx expo start            # dev server, open in Expo Go or a dev build
npx tsc --noEmit && npx expo-doctor
eas build -p android --profile preview      # installable .apk
eas build -p android --profile production   # .aab for Play (no demo button)
eas build -p ios --profile production       # needs an Apple Developer account, no Mac
```

`preview` sets `EXPO_PUBLIC_DEMO=1`, which adds a "Try demo" button on the login screen
(sample data from `lib/demo.ts`, all writes blocked). `production` does not.

Always run `rm -rf node_modules package-lock.json && npm install` before queueing a build:
that is what EAS does, and a conflicting peer dependency once failed a build that passed
locally (`react-dom` must stay pinned to `react`'s version).

## What exists

Students: sign-up and login by emailed code, profile completion with the website's college
list and referral code, Home (what needs you today), task feed with campus filter, task
detail with photos and documents, apply, chat, submit work with UPI prompt, approve with a
rating (releases escrow through /api/gig/complete), request changes, dispute, rate the poster,
hire and pay (Razorpay in a WebView), post a task or a service advert (photos, documents,
deadline), take a listing down, Talent (service adverts and request-service), public
profiles, edit profile and avatar, worker profile and resume (private bucket), earnings,
referrals, Telegram link, notifications (bell plus live in-app banners), student-ID upload
with camera, account deletion.

Businesses: registration (code, logo, password), password sign-in, dashboard with Company
Pro checkout, post a company task (workers, managed delivery, attachments, free-tier limit),
edit task, applicants and hiring (same task screen), company profile, public company page.

Inner Circle: apply, TECH briefs workflow (computed by shared/innerCircle.ts), OUTREACH lead
tracker. Legal and marketing pages open on the website.

Reused from the website unchanged: `shared/` is copied from `lib/` by
`node mobile/scripts/sync-shared.mjs` (fees, gig roles, attachments, UPI, phone, Inner
Circle, college list). Run it with `--check` to fail on drift.

## Not done

- **Push notifications.** Needs a Firebase project: add `google-services.json`, upload an FCM
  key to EAS, then `expo-notifications` and a device-token table next to `push_subscriptions`.
- The admin desk (disputes, payouts, KYC review, managed queue, company clearance).
- Client-side AI moderation (the website runs a model in the browser). The app relies on the
  server's regex check, which is the same check the website's server runs.
- Brand fonts (DM Sans, Manrope): the app uses the system font.
- Web-push settings (replaced by the Telegram link and in-app alerts).
- `/about` is not in proxy.ts's maintenance allow-list, so it shows the hold page until the
  site is out of maintenance.

## Untested

Everything that needs a signed-in user was checked only by type-check, bundling and the
offline cookie test (until someone has signed in on a device). Run through these on a device with a real account before shipping:
sign-up, apply, chat send, deliver, approve, hire and pay (especially UPI inside the
WebView), ID upload, account deletion.

## Before a store release

- Confirm the application ID (`in.doitforme.app`): it cannot change after the first upload.
- Play Console and App Store need a privacy-policy URL and the data-safety or privacy-label forms.
- Keystores live on EAS; never commit them.
