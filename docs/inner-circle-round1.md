# Inner Circle · Sales · Round 1 — selection sprint

## Aim

Turn the ~607 people who ticked **"Put me forward for the Inner Circle"** on the maintenance page into a filtered Sales cohort through a time-boxed, measurable Round 1 — without requiring any of them to sign up for an account first.

Round 1 is a **24-hour lead-list task**: candidates build a sheet of 30 qualified B2B prospects for an India-based AI/IT consultancy, using LinkedIn + enrichment tools of their choice. We're measuring four things at once: can they find real decision-makers, can they format structured work, can they ship inside a short window, and can they follow written instructions without hand-holding. The signal lives in the submission; the portal exists to make the signal measurable.

Rounds 2 (experiential) and 3 (interview) come later and are deliberately out of scope for this build.

## Context

The hold page at `/maintenance` has collected ~607 people who ticked **"Put me forward for the Inner Circle"** (a Cloudflare D1 `waitlist` row with `inner_circle = 1`). The existing `inner_circle_applications` Supabase table only accepts **signed-up users** — these candidates are anonymous waitlist entries, so the existing flow doesn't apply.

We're starting Inner Circle selection with the **Sales (OUTREACH) stream**. Candidates need a tracked, timed, reminder-driven portal — not just an email with a Google Sheet link — because the signal we're measuring is whether they can deliver 30 qualified B2B leads inside 24 hours with structured follow-through.

Why it has to be a new system rather than reusing the signed-up Inner Circle flow:
- Candidates have no `auth.uid()` — they log in with email + DOB.
- The campaign window is 7 days total; the data model is campaign-shaped, not user-shaped.
- Submissions, reminders and scoring are per-candidate per-round, which is a different cardinality than one approval decision per user.

## Decisions locked

| | |
|---|---|
| Deadline model | **Full 24h per candidate; invite link expires at day 7, last windows close day 8** |
| Timer start | **Explicit "Start my 24 hours" click after the brief** (not on email-link click) |
| Audience | **All 607 who ticked Inner Circle**, regardless of `inner_circle_role` |
| Non-Sales opt-out | **"Switch my lane to Tech"** one-click link in the invite — flips `waitlist.inner_circle_role` to `TECH` |
| Google Sheet template | `https://docs.google.com/spreadsheets/d/1ILhCN7x1m1ZTQU4vwY7yFK4kOiPeI36jEyD85pyYfrs/edit?usp=sharing` |
| Email sending | Automated via `lib/email.ts` — provider TBD (see "Email sending" section below) |

## Data model — new Cloudflare D1 table

Add migration file alongside the existing `supabase/d1/waitlist.sql`:

```sql
-- supabase/d1/inner_circle_round1.sql
CREATE TABLE IF NOT EXISTS inner_circle_round1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort TEXT NOT NULL DEFAULT 'sales-2026-10',       -- future rounds reuse table
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  college TEXT,
  token TEXT NOT NULL UNIQUE,                         -- 32-byte urlsafe, in invite URL
  dob_hash TEXT,                                      -- bcrypt(dob || token-pepper), set on first visit
  invited_at INTEGER NOT NULL,                        -- unix seconds, when invite emailed
  started_at INTEGER,                                 -- when 'Start my 24h' clicked
  deadline_at INTEGER,                                -- started_at + 86400
  campaign_closes_at INTEGER NOT NULL,                -- invited_at + 7*86400, hard close
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited','started','submitted','expired','advanced','rejected','switched_to_tech')),
  submission_url TEXT,
  submitted_at INTEGER,
  next_reminder_at INTEGER,                           -- cron idempotency pin
  reminders_sent TEXT NOT NULL DEFAULT '[]',          -- json array of fired reminders
  score INTEGER,
  admin_note TEXT,
  decided_at INTEGER,
  decided_by TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE (cohort, email)
);
CREATE INDEX idx_round1_status ON inner_circle_round1(status);
CREATE INDEX idx_round1_next_reminder ON inner_circle_round1(next_reminder_at)
  WHERE status = 'started';
CREATE INDEX idx_round1_deadline ON inner_circle_round1(deadline_at)
  WHERE status = 'started';
```

Why DOB-hash and not plaintext DOB: it's a return-login secret. Even on D1, we shouldn't store it readable. Hash with the token as pepper so a dump without tokens can't be rainbow-tabled.

**Rate limit** for login (email + DOB): 5 wrong DOBs per email per 15 min, stored in Cloudflare KV. On failure, response is **constant-time and non-leaky** — same "Try again" message whether the email is unknown or the DOB is wrong (never confirm an email exists).

## Portal — public routes

All under `app/inner-circle/sales/round-1/` and whitelisted in `proxy.ts` so the `MAINTENANCE_MODE` default-ON doesn't block them.

| Route | Purpose |
|---|---|
| `app/inner-circle/sales/round-1/[token]/page.tsx` | Entry via invite link. If `token` valid → show brief + "Start my 24 hours" + DOB entry. If already started → redirect to dashboard. |
| `app/inner-circle/sales/round-1/page.tsx` | Return-visit login — email + DOB form. On success, sets a signed cookie (short-lived) scoped to this route and redirects to dashboard. |
| `app/inner-circle/sales/round-1/dashboard/page.tsx` | Live task page: countdown timer, brief, "How to do this task" expandable, template-sheet link, submission URL field, submit button. Shows **submitted** / **expired** states. |
| `app/inner-circle/sales/round-1/switch-to-tech/[token]/page.tsx` | One-click lane switch — flips `waitlist.inner_circle_role` to TECH, marks `inner_circle_round1.status='switched_to_tech'`, shows a confirmation. |

Visual language: dark Swiss-minimalist with the purple accent, matching the existing hold page. One primary purple CTA per screen. **No new design system — reuse the `components/ui/` primitives**. Space Grotesk for the big "Inner Circle · Round 1" display heading; Inter for everything else.

## API routes — new under `app/api/inner-circle/`

| Route | Method | Purpose |
|---|---|---|
| `app/api/inner-circle/round1/claim/route.ts` | POST | `{ token, dob }` → verifies token, stores `dob_hash`, flips status to `started`, sets `started_at`/`deadline_at`/`next_reminder_at`, returns candidate state. Idempotent — re-call returns current state, does not restart timer. |
| `app/api/inner-circle/round1/login/route.ts` | POST | `{ email, dob }` → finds row by email, compares `bcrypt.compare(dob, dob_hash)`, sets signed session cookie. Rate-limited via KV. |
| `app/api/inner-circle/round1/submit/route.ts` | POST | `{ submission_url }` from session cookie → validates URL (Google Sheets host), stores `submission_url`/`submitted_at`, flips status to `submitted`, cancels future reminders, fires `_submitted` email. Refuses after `deadline_at`. |
| `app/api/inner-circle/round1/me/route.ts` | GET | Returns the authenticated candidate's row (timer state, status, submission). Dashboard polls / revalidates from this. |
| `app/api/inner-circle/round1/switch-tech/route.ts` | POST | `{ token }` → flips D1 waitlist row `inner_circle_role` to TECH and marks the Round 1 row `switched_to_tech`. |

Admin routes under `app/api/admin/`:

| Route | Method | Purpose |
|---|---|---|
| `app/api/admin/inner-circle-round1/invite/route.ts` | POST | `{ limit?: number, dryRun?: boolean }` — pulls N uninvited waitlist rows, creates candidate rows with fresh tokens, sends invite emails via batch pattern (reuse `broadcast-gig` throttling). Idempotent — running twice doesn't double-invite. |
| `app/api/admin/inner-circle-round1/list/route.ts` | GET | Lists candidates with filters: status, deadline range, submitted/not. Supports CSV export. |
| `app/api/admin/inner-circle-round1/decide/route.ts` | POST | `{ candidateId, action: 'advance'\|'reject', note, score }` — flips status, writes admin_note, mails candidate. |

All admin routes gated by `isAdminEmail()` from `lib/admins.ts`.

## Email templates — add to `lib/email.ts`

New `EmailKind` entries, following the existing template structure (lines 26–49):

| Kind | When fired |
|---|---|
| `inner_circle_round1_invite` | Initial batch to all 607. Contains token link + the "Switch to Tech" link. |
| `inner_circle_round1_reminder` | T–12h / T–6h / T–3h / T–30m. Parametrised with `{ hoursLeft }`. |
| `inner_circle_round1_submitted` | On successful submission — "received, you'll hear from us within 7 days". |
| `inner_circle_round1_expired` | On deadline passing without submission. |
| `inner_circle_round1_advanced` | When admin advances them to Round 2. |
| `inner_circle_round1_rejected` | When admin rejects with the written feedback. |

**Copy tone** (invite): makes them feel chosen, not drafted. Starts with the fact that they're one of ~600 who put their hand up, and that we're starting with Sales because that's the shape of real client work right now. Explains the 3-round structure in two lines so expectations are set. CTA is **"Join the Inner Circle — begin Round 1"** (purple). Below the fold, a soft **"I was more interested in the Tech side — hold my spot there instead"** link.

## Email sending — provider

The DoItForMe transactional email abstraction already supports three providers (Brevo / ZeptoMail / Resend) through `lib/email.ts`. All three let you send **from your business email as the "From" address** after a one-time domain verification (SPF + DKIM DNS records added at the domain registrar — GoDaddy in our case).

**Candidates will see the email from `[business-email]@[your-domain]`. Replies land in your GoDaddy mailbox.** The actual sending is done by the transactional service because:
- GoDaddy personal mailboxes cap at ~250–500 sends per day, with abuse flags well below that for bulk patterns.
- GoDaddy mailboxes don't offer tracking, bounce handling, or deliverability tuning that transactional services do.
- Microsoft 365 (what GoDaddy sells for new mailboxes) is deprecating basic SMTP auth, so direct SMTP relay would need OAuth2 app registration.

Setup (one-time, 15 min):
1. Pick a provider — ZeptoMail (10K free one-time credits, strong India deliverability) is the recommendation for this campaign.
2. Add the domain in the provider's dashboard.
3. Add the SPF / DKIM / DMARC records they generate to GoDaddy's DNS panel.
4. Set `FROM_EMAIL=inner-circle@doitforme.in` (or whichever business address) in `wrangler.jsonc` vars.
5. Set `EMAIL_PROVIDER=zeptomail` in `wrangler.jsonc` vars and `ZEPTOMAIL_TOKEN` via `wrangler secret put`.

After verification, every email the platform sends — the 607 invites, every reminder, every status update — comes from the business address with full deliverability. Zero code changes needed; `lib/email.ts` already handles provider selection.

Operator flow: open `/admin → Inner Circle Round 1`, click **"Send next batch"**. ZeptoMail free credits send all 607 in one click; Brevo would require 3 days of batches (300/day cap).

## Cron — new scheduled trigger

Add a trigger to `workers/cron/wrangler.jsonc` and a handler in `workers/cron/src/index.ts`:

```jsonc
{ "cron": "*/15 * * * *" }  // /api/cron/inner-circle-round1-nudge
```

Route `app/api/cron/inner-circle-round1-nudge/route.ts`:
- Gated by `x-cron-secret` header, same pattern as `/api/cron/auto-release`.
- SELECT candidates where `status='started' AND next_reminder_at <= now()`.
- For each: compute `hoursLeft`, pick the right reminder bucket (12/6/3/0.5), ensure it's not already in `reminders_sent`, fire the email, append to `reminders_sent`, advance `next_reminder_at` to the next bucket (or `NULL` if past 30m).
- Separate pass: SELECT candidates where `status='started' AND deadline_at < now()` → flip to `expired` and fire `_expired` email.

Reminders are idempotent via the `reminders_sent` jsonb array — the cron can re-run safely.

Pin the schedule in `tests/unit/cloudflare-config.test.mjs` the same way the other three crons are pinned, so route and schedule can't drift.

## Admin panel — new tab

Extend `app/admin/page.tsx` with a `INNER_CIRCLE_ROUND1` tab (sits next to the existing `INNER_CIRCLE` tab). Panel contents:

- Top row: counts by status (invited / started / submitted / expired / advanced / rejected / switched_to_tech), SLA badge for anyone past deadline without a decision.
- Table: email, name, college, invited_at, started_at, deadline countdown, submission link, score, status, admin note.
- Filters: status multi-select, cohort dropdown, "needs decision" quick filter.
- Row actions: **Open submission** · **Advance** (prompts for score + note) · **Reject** (prompts for note) · **Resend invite**.
- Top-right **"Send next batch"** button that POSTs to the invite route.

## Config — env vars

| Name | Where | Purpose |
|---|---|---|
| `ROUND1_SALES_SHEET_TEMPLATE_URL` | `wrangler.jsonc` vars | The Google Sheet link candidates clone |
| `ROUND1_DOB_PEPPER` | `wrangler secret put` | Secret peppered into `dob_hash` |
| `ROUND1_SESSION_SECRET` | `wrangler secret put` | HMAC key for the signed session cookie |
| `FROM_EMAIL` | `wrangler.jsonc` vars | Business "From" address for all Inner Circle emails |
| `EMAIL_PROVIDER` + provider token | `wrangler.jsonc` + `wrangler secret put` | Chosen email service — see "Email sending" above |

## Maintenance-gate trap

`proxy.ts` defaults `MAINTENANCE_MODE` ON. The new portal paths and the switch-to-tech path and the new API routes under `/api/inner-circle/*` **must be whitelisted** in the proxy allowlist alongside the existing exemptions. Without this, candidates click the email link and land on the hold page itself.

## Rollout order

1. Migration + schema + seed template URL — day –1.
2. Portal pages, API routes, email templates, admin tab — day –1.
3. Provider domain verification at GoDaddy — day –1 (DNS records take minutes to propagate).
4. Dry-run invite on operator email only, end-to-end click through portal → submit → see admin row.
5. First batch to real candidates — day 0.
6. Subsequent batches daily if on Brevo; one-shot if on ZeptoMail; cron reminders run throughout.
7. Day 7: close new starts; day 8: close submissions; admin evaluates and clicks Advance/Reject.

## Deliberately out of scope

- Rounds 2 and 3. The schema uses `cohort` so a future table or added `round` column covers them, but copy and timing stay unlocked.
- Any new auth, SSO, or linking of the anonymous candidate to a real `users` row. If/when they're advanced and we open signups, we match by email.
- Score weighting / auto-grading. Admin scores manually; the field exists but no formula is applied.

## Verification

End-to-end before the first real batch:
1. **Migration applied** — `wrangler d1 execute` the schema; confirm table exists.
2. **Domain verified** — send a test email through the chosen provider from the business "From" address to a Gmail inbox, confirm it lands in inbox (not spam) with DKIM pass.
3. **Dry-run invite** — `POST /api/admin/inner-circle-round1/invite { limit: 1, dryRun: false }` with operator's own email as target.
4. **Click-through** — operator opens link on fresh browser, sees brief, enters DOB, clicks Start. D1 row shows `status='started'`, `started_at` and `deadline_at` set.
5. **Return login** — close browser, visit `/inner-circle/sales/round-1`, enter email + DOB. Dashboard reopens with correct remaining time.
6. **Submission** — paste the operator-cloned sheet URL, submit. D1 row flips to `submitted`, `_submitted` email arrives.
7. **Admin view** — tab shows the operator row with Open-submission link, Advance and Reject buttons functional.
8. **Reminder dry-run** — manually set `started_at` to 25h ago on a disposable test row, run the cron route with the secret header; row flips to `expired` and `_expired` email arrives.
9. **Switch-to-Tech** — on another disposable row, click the switch link; D1 waitlist row shows `inner_circle_role='TECH'`, candidate row shows `switched_to_tech`.
10. **Maintenance-gate** — temporarily set `MAINTENANCE_MODE=on` locally, confirm the four portal routes and the switch route still load.
11. **Rate limit** — hit login 6× with wrong DOB on the same email, confirm KV lock engages and the 6th response is identical to earlier failures.

Unit tests to add (same spirit as `tests/unit/inner-circle.test.mjs`):
- Deadline math — `started_at + 86400 = deadline_at`; `invited_at + 7*86400 = campaign_closes_at`.
- Reminder bucket selection given `hoursLeft`.
- `claim` route is idempotent — second POST with same token and DOB returns same `started_at`, doesn't bump it.
- `submit` refuses after `deadline_at`.
- `switch-to-tech` is one-way and does not expire with the invite.
