# App launch checklist

What is done, what still needs a person, and in what order. Written 2026-11-06
after a full audit of the Inner Circle app (`mobile/`) against the live backend.
Every number here was measured against production that night.

---

## Where things stand

| | State |
|---|---|
| **Codebase** | One trunk. `main` holds the website *and* the app (`mobile/`). The app came from `feat/mobile-inner-circle@cb4c6b0` (Anant), app folder only — `ui-ux-final`'s website redesign stays off `main`, as decided earlier. |
| **Website** | Live at `30b2a4f`, 59/59 live checks. Includes Mouriyan's PR #4 (SES provider, waitlist-pool view) and his type fix, which `main` had been failing without. |
| **Round 1 Sales** | Live end to end: both secrets set, both D1 tables present, portal answers `401 Not signed in`. |
| **App** | Type-check clean, `expo-doctor` 20/20, Android bundle exports. Not yet built as an APK (needs an EAS login). |
| **Tests** | 198/198 unit, 0 website type errors, DB guard tests 19/19 and 7/7. |
| **Worker size** | 2326 KiB of 3072 (75.7%). |

---

## Do these, in this order

### 1. Fix the code email (Supabase SMTP) — the login blocker

**Why:** email-code sign-in is broken. In the last 14 days not one account signed
in by email code, while all 283 new accounts came through Google. The interns
measured it directly: `/auth/v1/otp` hangs ~35 s, then `504 upstream request
timeout`. Supabase's built-in email answers instantly (2/hour, team only), so a
35 s hang means **custom SMTP is configured but its server is not answering**.
This breaks the website's code login too, not just the app.

Supabase dashboard → **Authentication → SMTP Settings** (enable custom SMTP):

| Field | Value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | your Brevo **SMTP login** (Brevo → SMTP & API → SMTP tab) |
| Password | a Brevo **SMTP key** from that tab — *not* the API key |
| Sender email | `support@doitforme.in` |
| Sender name | `DoItForMe` |

Then **Authentication → Rate Limits**: custom SMTP starts at 30 emails/hour;
raise it to ~100. Brevo's free 300/day is shared with transactional mail and the
Round 1 reminders; ~35 sign-ups a day plus logins fits.

**Test:** sign in on the website with "email code" — the code should arrive in
seconds. Brevo is already authenticated for the domain (its DKIM records are
live), so it will not land in spam.

> Want me to do it instead? Create a Supabase access token (Account → Access
> Tokens), save it to `scratchpad/.supabase-token`, and I will set this through
> the Management API.

### 2. Apply the two database fixes

Both are written, committed and proven against the live database inside
rolled-back transactions. Applying them was blocked for me as a production
deploy.

```powershell
npm run db:migrate supabase/migrations/20261106_guard_gig_money_columns.sql supabase/migrations/20261106_companies_admin_policy_uses_is_admin.sql
node scripts/gig-guard-test.mjs         # expect 19/19
node scripts/companies-admin-test.mjs   # expect 7/7
npm run db:anon-audit                   # expect 49/49
```

- **`guard_gig_money_columns`** — a poster could rewrite price, payment status,
  escrow status, the assigned worker, fees, delivery fields or a dispute on their
  own gig straight over the REST API, create a gig already funded or assigned,
  or post under another company's name. A trigger now refuses all of that for
  logged-in users. Every legitimate write path was mapped first; the two payment
  routes that write through the user's own session still work.
- **`companies_admin_policy_uses_is_admin`** — the companies admin policy had a
  hardcoded two-email list that missed Mouriyan. It now uses `is_admin()`.

### 3. Build the APK

```powershell
cd mobile
npm i -g eas-cli
eas login                                 # infernalcentaur, or a collaborator on it
eas build -p android --profile apk
```

Use the **`apk`** profile. `preview` is the demo build (fake data, a "Try demo"
button). `apk` talks to the real backend and no longer asks for the microphone.

**On the phone:** sign in → **Sign in with password**. As an admin you see all
five tabs: Circle, Briefs, Pipeline, Messages, Account.

> A new Expo account means a new signing key, which matters for the Play Store.
> Decide before the first upload (README §5).

### 4. Approve the first Inner Circle members

**Nobody is a member yet** — zero users have `is_elite`. Until someone is
approved, every non-admin sees only the "Join the Circle" screen. There are 3
TECH applications pending and none for Outreach.

Approve on the website admin desk. Applicants must have accepted the current
programme terms first (`/program/terms`); the approval route refuses otherwise,
by design.

### 5. Rotate the Cloudflare API tokens pasted in chat

Then save the new deploy token to `scratchpad/.cf-token`.

---

## Decisions for you

- **Google sign-in in the app.** All 283 recent sign-ups are Google-only with no
  password, so once SMTP works they can sign in by email code. Adding a native
  Google button needs a Google Cloud OAuth Android client tied to the EAS
  signing key — worth doing, but it depends on step 3's account decision.
- **Round 1 Sales in the app.** The app's Inner Circle runs on Supabase accounts.
  Round 1 candidates are waitlist rows in Cloudflare D1 with an email + date of
  birth login and no account, so they cannot use the app. Today that is fine:
  Round 1 runs on the website. Say if it should come into the app.
- **Storage before reopening.** Supabase Storage is at 731 MB of 1 GB. It has been
  flat during maintenance (11 MB in the last month), but grew ~335 MB a month
  before. That is about three weeks of headroom after the site reopens. Moving
  uploads to Cloudflare R2 (10 GB free, no egress fees) should happen first;
  R2 has to be enabled in the Cloudflare dashboard.

---

## Free tiers — is it enough?

| Service | Use | Free limit | Verdict |
|---|---|---|---|
| Supabase database | 132 MB | 500 MB | Fine |
| Supabase storage | 731 MB | 1 GB | Fine now; R2 before reopening |
| Supabase auth | 431 MAU | 50,000 | Fine |
| Supabase auth email | — | needs custom SMTP | Step 1 |
| Cloudflare Worker | 2326 KiB bundle | 3072 KiB | Fine, 746 KiB headroom |
| Cloudflare Workers requests | low | 100k/day | Fine |
| Cloudflare D1 (Round 1) | small | 5M reads, 100k writes/day | Fine; the tracking endpoint is capped per candidate |
| Brevo | transactional + auth codes | 300/day | Fine at current volume; ZeptoMail ₹150/10k if it is not |

Realtime: `notifications` is deliberately **not** published (it was the
database's largest CPU cost). The app no longer listens for it; the bell
refreshes on message and task events and when the app reopens.

---

## Found and fixed in this audit

**App (`mobile/`)**
- Nobody could sign in: the Inner Circle build hid the password option, so the
  broken email code was the only way in. Password sign-in is back.
- Admins could not see Briefs or Pipeline (no admin is a member), although the
  database lets them in. The admin list is now synced from the website.
- A lead could never be marked **Won**: the database requires the closed value,
  and nothing asked for it. Now it does.
- The bell listened to a realtime feed that was turned off, so it went stale.
- The only APK profile was the demo build; the APK asked for the microphone.
- Six packages had drifted behind SDK 58 (`expo-doctor` 19/20 → 20/20).

**Website and database**
- `main` did not build (type error); the website type-check would also have
  broken on the app's files, and `npm run lint` was linting the built Worker
  (37,729 problems → 439 real ones).
- The website pipeline had the same Won bug, so no outreach commission could
  ever be raised.
- The Round 1 candidate **score** box changed value when scrolled past. Every
  number input is now checked by a test.
- The money-columns hole, the company impersonation hole, and the drifted
  companies admin policy (step 2).
- `db:migrate` could fail on a read-only setting leaked by another client of
  the connection pooler.

**Not changed:** the design — every app fix reuses the existing components. 355
of the 439 lint errors are `no-explicit-any` typing style; rewriting hundreds of
working files for that was not worth the risk.
