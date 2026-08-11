-- Split self-promotion out of the task feed (2026-08-12).
--
-- The marketplace had inverted: of 50 listings, 31 were students ADVERTISING
-- themselves ("I can make your PPT for Rs 100") and only 6 were genuine demand
-- outside of company posts. Buyers landed on a feed of sellers and left, and
-- sellers competed with sellers — which is why 267 applications produced 4
-- acceptances (1.5%).
--
-- Fix: self-promotion becomes its own listing_type, SERVICE, and gets its own
-- surface. Two different objects with two different jobs:
--   HUSTLE / COMPANY_TASK -> demand. Someone applies, escrow funds, work ships.
--   SERVICE               -> a shopfront. It is browsed and hired FROM; it is
--                            never applied to. Hiring one creates a real task.
--
-- gigs.listing_type IS constrained by gigs_listing_type_check, so the constraint
-- has to be widened BEFORE any row can be relabelled. Feed queries already
-- filter `listing_type in ('HUSTLE','COMPANY_TASK')`, so SERVICE drops out of
-- the task feed automatically the moment these rows are relabelled.
alter table public.gigs drop constraint if exists gigs_listing_type_check;
alter table public.gigs add constraint gigs_listing_type_check
  check (listing_type in ('HUSTLE', 'MARKET', 'COMPANY_TASK', 'SERVICE'));

-- === Backfill ===
-- Conservative: relabel only rows whose TITLE opens with a self-promotion
-- pattern AND which don't read as a request. Anything ambiguous ("Work",
-- "Nothing", "data entry") is deliberately LEFT as HUSTLE — the nudge cron
-- expires those on staleness, which is the right tool for junk.
update public.gigs
set listing_type = 'SERVICE'
where listing_type = 'HUSTLE'
  and (
    title ilike 'i can %' or title ilike 'i will %' or title ilike 'i am %'
    or title ilike 'i''m %' or title ilike 'i do %' or title ilike 'i make %'
    or title ilike 'i design %' or title ilike 'i build %' or title ilike 'i offer %'
    or title ilike 'i provide %' or title ilike '%available%' or title ilike '%offering%'
    or title ilike 'freelance %' or title ilike 'professional % & %'
    or title ilike '%hire me%' or title ilike 'build any %'
  )
  and title not ilike 'need%'
  and title not ilike 'looking for%'
  and title not ilike '%wanted%'
  and title not ilike '%hiring%';

-- Browsing the talent directory: newest first, only live rows.
create index if not exists idx_gigs_service
  on public.gigs (created_at desc)
  where listing_type = 'SERVICE' and status = 'open';
