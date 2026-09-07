# Deploying to Cloudflare

Everything in this file has been built and tested locally against `workerd`
(`wrangler dev --local`). What is left is the part that needs a browser login
and a DNS change.

## What runs where after the move

| | |
|---|---|
| Next.js app (pages, all 50 route handlers, middleware) | Cloudflare Workers — one Worker, `doitforme1` |
| Static assets, `/_next/static`, `public/` | Cloudflare Workers Static Assets (`ASSETS` binding) — free, not billed as requests |
| Scheduled jobs | A second Worker, `doitforme-cron` (`workers/cron/`) |
| Database, auth, storage, realtime | **Supabase — unchanged.** Nothing about it moves. |
| Payments | **Razorpay — unchanged.** |
| Email | Brevo / ZeptoMail / Resend — unchanged, `lib/email.ts` picks by key |

## Before the first deploy

### 1. Node 22+

Wrangler refuses to run on Node 20. This repo was migrated on **24.20.0**.

```bash
nvm install 24.20.0
nvm use 24.20.0
```

### 2. Log in

```bash
npx wrangler login      # opens a browser
npx wrangler whoami     # confirm the right account
```

### 3. Secrets on the app Worker

`NEXT_PUBLIC_*` values are inlined into the client bundle **at build time**, so
they must be in `.env.local` when you run `cf:build`. They do **not** need to be
Worker secrets.

Everything else is a runtime secret and must be set explicitly — Workers have no
`.env` file in production:

```bash
for k in SUPABASE_SERVICE_ROLE_KEY RAZORPAY_KEY_ID RAZORPAY_KEY_SECRET \
         RAZORPAY_WEBHOOK_SECRET CRON_SECRET ADMIN_SECRET TELEGRAM_BOT_TOKEN \
         GEMINI_API_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT PUSH_DISPATCH_SECRET \
         BREVO_API_KEY; do
  npx wrangler secret put "$k"
done
```

Local preview reads `.dev.vars` instead (gitignored, already generated).

### 4. Secrets on the cron Worker

It needs exactly one, and it must match the app's:

```bash
npx wrangler secret put CRON_SECRET --config workers/cron/wrangler.jsonc
```

## Deploying

```bash
npm run cf:size          # bundle size without deploying
npm run cf:deploy        # build + deploy the app
npm run cf:deploy:cron   # deploy the scheduled jobs
npm run cf:tail          # live logs
```

## Cutover order

Do these in order. Steps 1–3 are reversible; step 4 is the switch.

1. `npm run cf:deploy` — lands on `doitforme1.<subdomain>.workers.dev`.
2. Smoke-test that URL. **Push notifications will not fire yet** — see the
   database note below.
3. `npm run cf:deploy:cron`, then set `APP_ORIGIN` in
   `workers/cron/wrangler.jsonc` to the workers.dev URL and verify a job runs:
   `curl -H "x-cron-secret: $CRON_SECRET" https://doitforme-cron.<sub>.workers.dev/__run?job=auto-release`
4. Point `doitforme.in` at the Worker (Workers → Triggers → Custom Domains).
   Set `APP_ORIGIN` back to `https://doitforme.in` and redeploy the cron Worker.
5. Leave Vercel deployed but no longer receiving traffic for a week as rollback.

## The database calls the app

`dispatch_push_on_notification()` in Postgres fires `net.http_post` at a
**hardcoded** URL:

```
https://www.doitforme.in/api/push/dispatch
```

Because the domain is unchanged this keeps working after cutover with no edit —
but it means **web push stays broken while you are testing on a `workers.dev`
URL**, since the trigger is still calling the old host. That is expected, not a
migration failure. If you want push working before DNS moves, temporarily update
the URL inside that function.

`pg_cron` is **not installed** on this project, so nothing is scheduled inside
Supabase. Scheduling lives entirely in `workers/cron`. Supabase's own Cron is a
reasonable alternative for DB-only jobs (vacuuming, aggregates), but the three
jobs here all need to run application code — fee arithmetic, email, the payout
queue — so they belong in the Worker calling HTTP routes, which is what
`vercel.json` was doing too.

## Rollback

The Vercel project still builds from this branch. `vercel.json` is deliberately
left in place. Rolling back is repointing DNS.

## Verified locally against workerd

- 13 page routes, 5 static assets, 3 cross-domain redirects — all correct
- Middleware auth gate: 5 protected paths → 307
- API authorization: unauthenticated → 401, cron without secret → 401,
  unsigned Razorpay webhook → 401
- `next/og` profile image → 200, `image/png`, 1200×630
- `web-push` → sent a real notification under `workerd` (`{"ok":true,"sent":1}`)
- 53 unit tests, 20 escrow checks, 37 anonymous-exposure checks
- Bundle: **2.84 MB gzipped** (free limit 3 MB, paid 10 MB)
