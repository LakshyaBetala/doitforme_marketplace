# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Next dev server (explicit --webpack, not Turbopack)
npm run build   # Production build (explicit --webpack)
npm run start   # Run production build
npm run lint    # ESLint (next/core-web-vitals + next/typescript)
npm run test:e2e        # Playwright (auto-starts `npm run dev` on :3000 via webServer)
npx playwright test tests/golden-path.spec.ts   # run a single spec
```

The only automated tests are Playwright E2E in [tests/](tests/) ([playwright.config.ts](playwright.config.ts) — chromium only, `baseURL` http://localhost:3000). `test_onboard.ts` and `test_onboard_rls.ts` (now under [scripts/maintenance/](scripts/maintenance/)) are ad-hoc scripts, not part of the suite.

Path alias: `@/*` → repo root (see [tsconfig.json](tsconfig.json)).

## Framework quirks (non-obvious)

- **Next.js 16 + React 19.2 + React Compiler** (`babel-plugin-react-compiler` is enabled).
- **`proxy.ts` at repo root is the middleware.** Next.js 16 renamed middleware → proxy. It handles auth-gating for `/dashboard`, `/profile`, `/post`, `/feed`, `/gig`, `/onboarding`, `/verify-id` and bounces logged-in users away from `/login`. Do not confuse it with an HTTP proxy.
- **Webpack is forced** via `--webpack` flags. This is deliberate because `@xenova/transformers` (used for client-side moderation) requires the webpack aliases in [next.config.ts](next.config.ts) (`onnxruntime-node: false`, `sharptools: false`) and `serverExternalPackages`.
- **Cross-domain redirects:** `/marketplace/*` and `/store/*` are permanently redirected to `marketforme.in` in [next.config.ts](next.config.ts). The marketplace lives on a sister domain; this repo only hosts the hustle/gig side.

## Architecture

### Supabase client hierarchy
Three clients serve three distinct roles — pick deliberately:
- [lib/supabaseBrowser.ts](lib/supabaseBrowser.ts) — `createBrowserClient`, used in `"use client"` components. Respects RLS via the logged-in user's session.
- [lib/supabaseServer.ts](lib/supabaseServer.ts) — `createServerClient` with Next cookie store, used in server components, route handlers, and layouts. Also re-exported as `createServer`. Respects RLS.
- [lib/supabase.ts](lib/supabase.ts) — plain anon client; used sparingly.
- **Admin/service-role** operations use `createClient(..., SUPABASE_SERVICE_ROLE_KEY)` inline inside route handlers (e.g. [app/api/payments/create-order/route.ts](app/api/payments/create-order/route.ts), [app/api/cron/auto-release/route.ts](app/api/cron/auto-release/route.ts)). These bypass RLS and must never be reachable from the browser bundle.

### Auth & onboarding gate
Auth has two layers that must both pass:
1. `proxy.ts` redirects unauthenticated users away from protected paths.
2. [app/dashboard/layout.tsx](app/dashboard/layout.tsx) enforces a profile-completion gate: if `users.phone` or `users.college` is missing, it redirects to `/onboarding`. This catches Google OAuth users who skipped the signup form.

The OAuth callback at [app/auth/callback/route.ts](app/auth/callback/route.ts) exchanges the code, then POSTs to `/api/auth/create-user` to sync the user row, and optionally POSTs to `/api/referral/apply` if a `ref` code was attached.

### Gig lifecycle & escrow (core domain model)
Two listing types drive branching logic everywhere:
- `HUSTLE` — service work; the **assigned worker** is the payout recipient.
- `MARKET` with `market_type` ∈ `SELL | RENT | REQUEST` — product; the **poster (seller)** is the payout recipient. `RENT` additionally tracks `security_deposit` which is refunded to the renter on release.

Escrow flow: payment creates `HELD` funds → delivery sets `status='DELIVERED'` + `auto_release_at = now + 24h` → after 24h the cron releases (or the poster manually releases sooner).

Between "approve" and "dispute" sits a third, lighter path: [app/api/gig/request-changes/route.ts](app/api/gig/request-changes/route.ts). The poster sends written feedback → gig reverts to `status='assigned'` with `auto_release_at = null` and `delivered_at = null` (timer **cancelled**, not paused) → the worker resubmits, which restarts the 24h clock. No admin involvement; dispute remains the heavy path that freezes escrow for review.

**Resolving a dispute** is the **Disputes** tab in [app/admin/page.tsx](app/admin/page.tsx), backed by [app/api/admin/resolve-dispute/route.ts](app/api/admin/resolve-dispute/route.ts). For a long time this did not exist: `/api/gig/dispute` froze escrow and mailed both parties a 48-hour promise, with no UI and no endpoint to act on it — the only exit was hand-written SQL. Two outcomes: `RELEASE` re-implements the [cron/auto-release](app/api/cron/auto-release/route.ts) arithmetic exactly (stored fee first, recompute only as fallback) so a disputed gig settles identically to a normal one; `REFUND` delegates to `refund_escrow_transactional`. Decision notes are **mandatory** and emailed to both sides — that text is the record if a payment is ever charged back. The tab badges anything past the 48h SLA.

Key SQL RPCs (called from API routes, not written as raw SQL in handlers):
- `manual_release_escrow(p_gig_id)` — called by [app/api/escrow/release/route.ts](app/api/escrow/release/route.ts).
- `release_escrow_transactional(gig_uuid)`, `refund_escrow_transactional(gig_uuid, poster_uuid)`.
- `freeze_wallet_amount` / `unfreeze_wallet_amount`.
- `increment_worker_stats(worker_id, amount)` — updates `jobs_completed` / earnings on payout.
- `is_admin()` — SQL function that whitelists admin emails; used inside RLS policies. It is the **database half** of the whitelist in [lib/admins.ts](lib/admins.ts) — see below.

### Fee model — [lib/fees.ts](lib/fees.ts) is the single source of truth
Do **not** hardcode a percentage anywhere; import the helpers. (The old "3% flat" rate is gone.)
- `PLATFORM_FEES` — `STUDENT: 5%`, `BUSINESS: 10%`. Deducted from the **recipient's payout**.
- `audienceForGig(gig)` — `BUSINESS` when `company_id` is set or `listing_type === 'COMPANY_TASK'`; `STUDENT` otherwise.
- `GATEWAY_FEE_RATE` (2%) / `gatewayFeeFor(subtotal)` — Razorpay pass-through charged **on top**, paid by the payer.
- Managed delivery (`is_managed`) is deliberately **not** a separate rate — it is Business 10%, to keep pricing "DoItForMe = 10%".

Both call sites ([create-order](app/api/payments/create-order/route.ts), [cron/auto-release](app/api/cron/auto-release/route.ts)) go through these. create-order persists the full breakdown (incl. `fee_audience`) into `transactions.provider_data.breakdown`; the cron prefers that **stored** fee and only recomputes as a fallback — so historical gigs keep the rate they were priced at when you change the dial.

### Managed Mode + Elite pool
Strategy pivot recorded in [supabase/migrations/20260619_managed_mode.sql](supabase/migrations/20260619_managed_mode.sql): instead of a zero-commission connection hub (which leaked matches off-platform), DoItForMe can *itself* assign a vetted student and QA the work.
- `gigs.is_managed` (bool) + `gigs.managed_status` ∈ `UNASSIGNED | ASSIGNED | DELIVERED | CLOSED` — a queue lifecycle **parallel to** the public `gigs.status`; keep both in sync when you touch managed gigs. Set at post time in [app/company/post/page.tsx](app/company/post/page.tsx) — **companies only**, see the trap below.
- `users.is_elite` — manually curated top students the assignment UI sorts first.
- Admin desk: **Managed Queue** tab in [app/admin/page.tsx](app/admin/page.tsx) → [app/api/admin/assign-managed/route.ts](app/api/admin/assign-managed/route.ts). Assignment upserts an `approved` row into `applications` on purpose, so delivery/escrow/payout reuse the identical self-serve code path.
- Admin auth goes through `isAdminEmail()` from [lib/admins.ts](lib/admins.ts). It used to be a hardcoded `ADMINS` array copy-pasted into eight routes plus the admin page; adding a person meant editing ten places, and missing one produced an admin who could open a tab but got a 403 from the endpoint behind it. There are now exactly **two** copies — that file and the SQL `is_admin()` — because RLS cannot import TypeScript. Edit both together; [supabase/migrations/20260902_admin_whitelist.sql](supabase/migrations/20260902_admin_whitelist.sql) is the pattern.

When touching gig/payment code, the canonical reference for state transitions and RLS is [supabase/migrations/20260421_standardize_naming_and_rls.sql](supabase/migrations/20260421_standardize_naming_and_rls.sql) (RLS baseline) and [supabase/migrations/v6_master.sql](supabase/migrations/v6_master.sql).

### Vercel deploy constraints (read before touching [vercel.json](vercel.json))
Two rules that fail the **deploy**, not the build, so `npm run build` passing locally proves nothing:
- **`vercel.json` is schema-validated and has no comment syntax.** Any unrecognised top-level key (e.g. `"comment"`) fails deployment on both production and preview. Document constraints here instead.
- **Hobby allows once-per-day crons only.** `0 * * * *` or `*/30 * * * *` fail with *"Hobby accounts are limited to daily cron jobs"*. Hobby timing is also hour-accurate only — a `30 7 * * *` job fires anywhere in 07:00–07:59, so nothing may depend on precise minutes. Pro is required for anything more frequent.

Both are guarded by [tests/unit/vercel-config.test.mjs](tests/unit/vercel-config.test.mjs), which also asserts every scheduled path has a matching route file. Run `npm run test:unit` before pushing config changes.

### Cron (auto-release)
[vercel.json](vercel.json) schedules a daily GET to `/api/cron/auto-release`. The handler requires an `x-cron-secret` header matching `CRON_SECRET` env var, then scans `gigs` where `status='DELIVERED' AND auto_release_at < now() AND payment_status='HELD' AND dispute_reason IS NULL` in batches of 50 and transitions them to `completed` / `PAYOUT_PENDING`. A near-duplicate handler exists at [app/cron/auto-release/route.ts](app/cron/auto-release/route.ts) (note: **no `/api`** prefix) — it is *not* the one wired into [vercel.json](vercel.json); the scheduled path is the one under `app/api/`. Don't edit the wrong one.

### Two-tier content moderation
Posts and chat messages are filtered for phone/UPI/social-handle leakage and illegal content:
- **Client** ([app/hooks/useModeration.ts](app/hooks/useModeration.ts)) runs regex checks first, then a Xenova `distilbert-base-uncased-mnli` zero-shot classifier in the browser. Threshold is **0.985** (deliberately liberal — bias toward allowing).
- **Server** ([lib/moderation.ts](lib/moderation.ts) + [app/api/moderation/route.ts](app/api/moderation/route.ts)) runs regex only; the AI check already happened client-side. The route **fails open** — moderation errors return `success: true` rather than blocking the message.

The regex blocklists in [lib/moderation-rules.ts](lib/moderation-rules.ts) and `useModeration.ts` are intentionally aggressive about phone-number obfuscation (`9 8 7 ...`, `9-8-7 ...`) and payment keywords (`paytm`, `gpay`, `upi`, etc.) because bypassing escrow is the primary abuse vector.

### Student KYC verification (AI auto-approve)
Students upload an ID at `/verify-id` → [app/api/kyc/upload/route.ts](app/api/kyc/upload/route.ts) stores it in the private `kyc-ids` bucket (service-role) and **auto-verifies it with Google Gemini** via [lib/kycVerification.ts](lib/kycVerification.ts) (`gemini-2.5-flash`, free tier, key `GEMINI_API_KEY`).
- **Eligibility is broad on purpose:** ANY student ID — school, Class 11/12, junior college, college, university, or graduate/alumni — is valid. The prompt explicitly approves school IDs; don't narrow it back to "university only."
- **State machine** on `users`: `kyc_status ∈ none | pending | approved | rejected | manual_review`, plus `kyc_confidence`, `kyc_institution`, `kyc_rejection_reason`, `kyc_reviewed_at`. The legacy `kyc_verified` boolean is kept in sync (`true` only when approved) because the rest of the app keys off it.
- **Thresholds** live in [lib/kycVerification.ts](lib/kycVerification.ts): approve ≥ `0.85`, treat < `0.5` as unsure. **Fails open** like moderation — any Gemini/network/parse error returns `manual_review` (never hard-blocks a real student).
- **Admin review** of the `manual_review` minority is in the **Student IDs** tab of [app/admin/page.tsx](app/admin/page.tsx), backed by [app/api/admin/review-kyc/route.ts](app/api/admin/review-kyc/route.ts) (GET lists with 30-min signed image URLs; POST approve/reject emails the student).
- **Backfill / re-verify** existing uploads with [scripts/maintenance/reverify-kyc.mjs](scripts/maintenance/reverify-kyc.mjs) (`node scripts/maintenance/reverify-kyc.mjs`). It's resumable (skips already-scored rows) and stops cleanly on the Gemini free-tier daily quota — re-run after reset to finish.
- Outcome emails (`kyc_approved` / `kyc_rejected` with reason) are sent via [lib/email.ts](lib/email.ts) — `RESEND_API_KEY` is set in Vercel (prod email works); it's just absent from local `.env.local`, so email no-ops in local dev only.

### Payments — Razorpay only
**Cashfree is gone.** It never cleared marketplace onboarding, so the gateway, its
webhook, its payouts helper and both npm packages were deleted. Do not reintroduce
a provider flag "just in case" — one gateway is the point.

Two entry points create orders, and they must stay in step:
- [payments/create-order](app/api/payments/create-order/route.ts) — fund escrow on an
  already-assigned gig.
- [gig/hire](app/api/gig/hire/route.ts) — hire-and-pay in one step (applicants list,
  company task desk). This is the busier path; it is easy to miss when changing payments.

Plus [company/pro/create-order](app/api/company/pro/create-order/route.ts) for the
₹299/mo subscription.

**Both handlers re-fetch the real price from the DB and ignore any amount in the
request body** — client-supplied amounts are a security footgun. Razorpay's own
integration guide tells you to accept `{ amount }` from the client; don't.

Settlement has exactly one implementation, [lib/paymentSettlement.ts](lib/paymentSettlement.ts),
reached from two places that race by design:
- [webhooks/razorpay](app/api/webhooks/razorpay/route.ts) — survives a closed tab. Refuses
  to run at all without `RAZORPAY_WEBHOOK_SECRET` rather than trusting an unverified body.
- [payments/verify-payment](app/api/payments/verify-payment/route.ts) — the browser callback.

Both are idempotent: the transaction row is claimed with a conditional UPDATE and only
the winner funds escrow. Verifying a payment needs **two** checks — the HMAC proves the
callback is genuine, and re-reading the payment proves it was `captured`. A signature
alone will happily validate a payment that failed.

`scratchpad/e2e-payment.mjs` (regenerate if lost) exercises the whole chain against a
running dev server using disposable rows, then deletes them. Run it after any change to
the payment path; unit tests cannot catch settlement bugs.

**Payouts to workers are manual.** Every Indian payouts product is withheld from
proprietorships, so [cron/process-payouts](app/api/cron/process-payouts/route.ts) reports
the queue and logs when the oldest row passes 24h — it does not move money. Pay from the
admin Payouts desk. A future RazorpayX integration needs a registered entity first.

### Client-side state
Zustand is used minimally; the only store is [store/useGigFormStore.ts](store/useGigFormStore.ts) for the multi-step post-a-gig form. Everything else uses local `useState` or Supabase realtime.

### Realtime
[components/RealtimeListener.tsx](components/RealtimeListener.tsx) is mounted globally in [app/layout.tsx](app/layout.tsx). It subscribes to Supabase postgres_changes for `messages` (filtered by `receiver_id`) and gig updates, and surfaces them as Sonner toasts. Don't add a second global listener — extend this one.

### Web push notifications
Separate from the in-app realtime toasts. The browser subscribes via [app/api/push/subscribe/route.ts](app/api/push/subscribe/route.ts); the server fans out with the `web-push` library through [app/api/push/dispatch/route.ts](app/api/push/dispatch/route.ts). Subscriptions and schema are defined in [supabase/migrations/20260602_web_push.sql](supabase/migrations/20260602_web_push.sql). Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `PUSH_DISPATCH_SECRET` (gates the dispatch route). Managed from [app/settings/notifications/page.tsx](app/settings/notifications/page.tsx).

### Company vs. Student flows
`/company/*` routes (onboarding, dashboard, post, task) are a parallel funnel for B2B posters. Companies need manual admin clearance before they can post at scale. The `users` and `companies` tables are both RLS-enabled; policies key off `auth.uid()` and `is_admin()`.

## Auth modes
Supabase is configured for **email OTP only** — magic links are disabled. Keep this in mind when touching auth UI; no magic-link code paths should exist.

## Required environment variables
From README + handler code:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_SECRET`, `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY` (student-ID auto-verification), `RESEND_API_KEY` (transactional email — unset = email no-ops), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_DISPATCH_SECRET` (web push).

## Traps that have already bitten (do not re-learn these)

- **Releasing escrow is `manual_release_escrow`, and nothing else.** It is the only
  implementation that locks the HELD escrow row against a double payout, refuses when
  the worker has no UPI, and — critically — inserts the `payout_queue` row. Three other
  paths used to release without it (the Activity approve button did a raw client-side
  two-column update; `/api/gig/complete` and `/api/cron/auto-release` wrote ledger rows
  but queued nothing), so `payout_queue` was **empty database-wide** and no worker was
  ever queued to be paid while every UI reported "funds released". Covered by
  `npm run test:escrow` ([scripts/escrow-flow-test.mjs](scripts/escrow-flow-test.mjs)),
  which asserts across three tables at once using disposable rows. Unit tests cannot
  catch this class of bug.

- **A service-role client neutralises `auth.uid()` guards inside SQL functions.**
  `manual_release_escrow` guards with `if auth.uid() is distinct from poster_id and not
  is_admin()`. Called with the service role, `auth.uid()` is NULL and `is_admin()`
  returns NULL, so the condition is `TRUE and NULL` = NULL and the branch never fires.
  `/api/escrow/release` relied on that guard and therefore let **any logged-in user
  release any gig's escrow**. Authorize in the route whenever you call a
  `security definer` function with the service key.

- **Authenticate before validating input.** `/api/payments/verify-payment` checked its
  body first, so an anonymous caller got `400 Missing fields` rather than `401` — which
  tells a prober the endpoint is open and what to send next. Guarded by
  [tests/uat-readiness.spec.ts](tests/uat-readiness.spec.ts).

- **UPI is captured at work submission, not at signup or apply.** Asking a student for
  payment details before they have earned anything kills the funnel, but the release RPC
  refuses without one — so `/api/gig/deliver` returns `409 UPI_REQUIRED` and the client
  prompts. Do not move this check earlier.

- **Managed mode is a company offering.** It was previously a toggle on the *student*
  post page and absent from the company one, so all 176 managed gigs were student-posted
  and `audienceForGig()` (which ignores `is_managed`) billed them at 5% rather than the
  documented Business 10%. It lives in [app/company/post/page.tsx](app/company/post/page.tsx),
  where `company_id` is set and the 10% follows automatically.

- **`<input type="number">` eats the scroll wheel.** A focused number input treats wheel
  events as increment/decrement, so a user types 100 into the price field, scrolls down
  to the next field, and the value silently counts down under the cursor — reaching
  negative numbers if they scroll far enough. It presents as "the amount changes to a
  random value". Every number input must carry `onWheel={blurOnWheel}` from
  [lib/inputs.ts](lib/inputs.ts); there are 7 of them.

- **Migrations in `supabase/migrations/` are not necessarily applied to the live DB.**
  `20260322_1500_escrow_multi_worker.sql` declares `UNIQUE (gig_id, worker_id)` on
  `escrow`; the live database never got it. Settlement used
  `upsert(onConflict: "gig_id,worker_id")`, which therefore failed every time with
  Postgres 42P10 — and nothing checked the error, so gigs were marked `ESCROW_FUNDED`
  with no escrow row behind them. **Check `error` on every Supabase write that matters.**
  Verify a constraint exists before relying on `onConflict`.

- **`tsx --test tests/unit/` silently skips `.ts` files.** Node's default test-file
  patterns match only `.js/.cjs/.mjs`, and Node 20 does not expand globs. Two suites sat
  unexecuted while reporting green. `npm run test:unit` goes through
  [scripts/run-unit-tests.mjs](scripts/run-unit-tests.mjs), which enumerates files explicitly.

- **Short aliases in the moderation regex need `` anchors.** Without them `sc` matches
  inside "escrow" and "discuss", so the platform blocked listings and chat messages for
  containing the word for its own payment system. Covered by
  [tests/unit/moderation-rules.test.ts](tests/unit/moderation-rules.test.ts).

- **Uploads are compressed client-side** by [lib/imageCompress.ts](lib/imageCompress.ts)
  before reaching Supabase; storage was growing ~40MB/day on a 1GB free tier. It fails
  open — an undecodable file uploads unchanged rather than erroring. Vercel image
  optimization is deliberately `unoptimized: true` to keep transformations off a Hobby
  quota; flip it back on a paid plan.

## Stale-doc warning
Four tables were dropped on 2026-06-19 ([supabase/migrations/20260619_drop_unused_tables.sql](supabase/migrations/20260619_drop_unused_tables.sql)) — `vasooli_bounties`, `deliveries`, `payout_methods`, `chat_blocked_logs`. Older migrations and schema dumps still reference them. Delivery artifacts live on `gigs.delivery_link` / `delivery_files` + `messages`; payout UPI lives on `users.upi_id` and payouts are manual.

[supabase/README.md](supabase/README.md) references files `supabase/sql/01_..08_*.sql`. That directory was removed in commit `0c8f119` ("Cleanup: remove redundant root sql directory"). The live migrations are in [supabase/migrations/](supabase/migrations/) and are date-stamped (e.g. `20260421_standardize_naming_and_rls.sql`). Trust the dated migrations, not the README's ordering.

## Design system (read before any UI change)

The site is **dark, Swiss-minimalist, purple-accented**. Default to monochrome; brand color is a highlight, not a fill. Anything else reads as AI-slop.

- **Surface scale (use these, don't invent new blacks):** `--background: #0B0B11` < `--card: #13131A` < `--card-elevated: #1A1A24`. Borders: `rgba(255,255,255,0.08)`. Foreground: `#fafafa`; muted text: `--foreground-muted` (62% white). Defined in [app/globals.css](app/globals.css). **Do not hardcode `bg-[#050505]`** — that's a legacy literal still scattered across ~10 files awaiting migration to the CSS var.
- **Brand palette is exactly two hues:** `--brand-purple: #8825F5` (primary) and `--brand-blue: #0097FF` (secondary, sparingly). No pink, no indigo, no gradient-magenta, no rainbow status pills. Use neutral grays for status differentiation; reserve purple for one CTA per surface.
- **Typography:** Space Grotesk for `h1`/`h2` only (display); Inter for everything else including `h3`–`h6`. Weights 400/500/600/700 are loaded. Negative letter-spacing on display heads (`-0.02em`) is the house style.
- **Soft purple accent:** for inline text/glows on dark surfaces, use `var(--brand-purple-soft)` (`#C9A9FF`) — never reach for `purple-300`/`purple-400`/`#C084FC`/lavenders. The brand `#8825F5` is for fills (CTAs, highlights); the soft tint is for inline accents that need contrast against `#0B0B11`.

## UI primitives — use these, don't roll your own

These live in [components/ui/](components/ui/). If you find yourself open-coding any of these patterns, import the primitive instead — the codebase has too much per-page drift already.

- **`Avatar`** — single initial fallback on neutral surface w/ hairline ring; `Image fill` w/ `sizes`. Source of truth for every user/company avatar.
- **`Card`** — `bg-[var(--card)]` (`#13131A`) or `variant="elevated"` (`#1A1A24`); hairline border; `rounded-2xl`; `padded` toggles default `p-5 md:p-6`.
- **`Button`** — variants: `primary` (purple, exactly one per surface), `secondary` (white/[0.06]), `ghost`, `destructive`. Sizes: `sm`/`md`/`lg`. `loading` swaps content for spinner.
- **`StatusBadge`** + **`statusToTone()`** + **`humanizeStatus()`** — every status pill (gig/escrow/application/dispute/payout) renders here. Tones: `neutral`/`info`/`success`/`warning`/`danger`. The mapper is the canonical place to add new DB status values; never inline ternary `text-green-400 bg-green-500/10` style classes for statuses.

## UI conventions

- Cards: `bg-[var(--card)]` (or the elevated variant for modals/popovers), `border border-[var(--card-border)]`, rounded-2xl, no shadows by default — depth comes from the surface scale, not box-shadow.
- Buttons: one primary purple per view; everything else is `bg-white/5 hover:bg-white/10` with hairline border. Avoid drop-shadows on dark surfaces; use `ring-1` instead.
- Mobile flex containers: never wrap a tall page in `items-center` — it traps content above the fold and breaks scrolling. Use `flex-col min-h-[100dvh] overflow-y-auto` for centered-feeling forms.
- Realtime/toast surface is `#1A1A24` with the standard hairline border (see [app/layout.tsx](app/layout.tsx)).

## Local maintenance scripts
[scripts/maintenance/](scripts/maintenance/) holds ad-hoc PowerShell color-migration scripts and one-off test runners (`test_onboard*.ts`). Gitignored. **Never move `proxy.ts` here** — it is the Next.js 16 middleware and must live at repo root or auth-gating silently breaks (Next does not error when middleware is missing).
