-- Growth instrumentation + application black-hole fix (2026-08-12).
--
-- Context: signups jumped ~8x (10/day -> 81 on 2026-08-11) with zero paid
-- marketing and zero referral-code usage, and we could not name the channel
-- because nothing captured attribution. Meanwhile 85% of applicants had never
-- received a single reply, so the incoming cohort was landing in silence.
-- These columns back both fixes.

-- === 1. Signup attribution ===
-- `signup_source` is the self-reported answer from onboarding (a small closed
-- set, see lib/attribution.ts). `signup_source_detail` is the free-text "Other".
-- `signup_referrer` / `signup_landing` are captured client-side on first touch
-- (document.referrer + UTM querystring) and are the objective counterpart to
-- the self-report — people misremember, referrers don't.
-- All four are WRITE-ONCE: set at profile creation, never overwritten, so the
-- attribution of a cohort can't drift after the fact.
alter table public.users add column if not exists signup_source text;
alter table public.users add column if not exists signup_source_detail text;
alter table public.users add column if not exists signup_referrer text;
alter table public.users add column if not exists signup_landing text;

create index if not exists idx_users_signup_source
  on public.users (signup_source, created_at desc)
  where signup_source is not null;

-- === 2. Application black-hole fix ===
-- The nudge cron pokes posters who are sitting on unanswered applications, then
-- expires the gig if they still don't act. `poster_nudged_at` is the debounce so
-- a poster is nudged once per gig, not once per cron run.
alter table public.gigs add column if not exists poster_nudged_at timestamptz;
alter table public.gigs add column if not exists expired_at timestamptz;

-- Cron lookup: open gigs, oldest first.
create index if not exists idx_gigs_open_created
  on public.gigs (created_at)
  where status = 'open';

-- NOTE: expiry sets gigs.status = 'expired'. There is deliberately no CHECK
-- constraint on gigs.status in this schema (verified 2026-08-12) — the feed
-- filters on status = 'open', so expired gigs drop out with no further wiring.
