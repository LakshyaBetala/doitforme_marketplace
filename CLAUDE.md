# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev     # Next dev server (explicit --webpack, not Turbopack)
npm run build   # Production build (explicit --webpack)
npm run start   # Run production build
npm run lint    # ESLint (next/core-web-vitals + next/typescript)
```

No test framework is configured. `test_onboard.ts` and `test_onboard_rls.ts` at the repo root are ad-hoc scripts, not a suite.

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

Escrow flow: payment creates `HELD` funds → delivery sets `status='DELIVERED'` + `auto_release_at = now + 24h` → after 24h the cron releases (or the poster manually releases sooner). The **3% flat platform fee** is deducted from the recipient's payout.

Key SQL RPCs (called from API routes, not written as raw SQL in handlers):
- `manual_release_escrow(p_gig_id)` — called by [app/api/escrow/release/route.ts](app/api/escrow/release/route.ts).
- `release_escrow_transactional(gig_uuid)`, `refund_escrow_transactional(gig_uuid, poster_uuid)`.
- `freeze_wallet_amount` / `unfreeze_wallet_amount`.
- `increment_worker_stats(worker_id, amount)` — updates `jobs_completed` / earnings on payout.
- `is_admin()` — SQL function that whitelists admin emails (`betala911@gmail.com`, `doitforme.in@gmail.com`); used inside RLS policies.

When touching gig/payment code, the canonical reference for state transitions and RLS is [supabase/migrations/20260421_standardize_naming_and_rls.sql](supabase/migrations/20260421_standardize_naming_and_rls.sql) (RLS baseline) and [supabase/migrations/v6_master.sql](supabase/migrations/v6_master.sql).

### Cron (auto-release)
[vercel.json](vercel.json) schedules a daily GET to `/api/cron/auto-release`. The handler requires an `x-cron-secret` header matching `CRON_SECRET` env var, then scans `gigs` where `status='DELIVERED' AND auto_release_at < now() AND payment_status='HELD' AND dispute_reason IS NULL` in batches of 50 and transitions them to `completed` / `PAYOUT_PENDING`. A parallel route exists at `/api/cron/escrow-auto-release`.

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

### Payments
Cashfree is the primary gateway ([app/api/payments/create-order/route.ts](app/api/payments/create-order/route.ts), `verify-payment`). Razorpay SDK is also installed but Cashfree is the active path. **The create-order handler re-fetches the real gig price from the DB and ignores any price sent in the request body** — client-supplied amounts are a security footgun.

### Client-side state
Zustand is used minimally; the only store is [store/useGigFormStore.ts](store/useGigFormStore.ts) for the multi-step post-a-gig form. Everything else uses local `useState` or Supabase realtime.

### Realtime
[components/RealtimeListener.tsx](components/RealtimeListener.tsx) is mounted globally in [app/layout.tsx](app/layout.tsx). It subscribes to Supabase postgres_changes for `messages` (filtered by `receiver_id`) and gig updates, and surfaces them as Sonner toasts. Don't add a second global listener — extend this one.

### Company vs. Student flows
`/company/*` routes (onboarding, dashboard, post, task) are a parallel funnel for B2B posters. Companies need manual admin clearance before they can post at scale. The `users` and `companies` tables are both RLS-enabled; policies key off `auth.uid()` and `is_admin()`.

## Auth modes
Supabase is configured for **email OTP only** — magic links are disabled. Keep this in mind when touching auth UI; no magic-link code paths should exist.

## Required environment variables
From README + handler code:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `CRON_SECRET`, `ADMIN_SECRET`, `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY` (student-ID auto-verification), `RESEND_API_KEY` (transactional email — unset = email no-ops).

## Stale-doc warning
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
