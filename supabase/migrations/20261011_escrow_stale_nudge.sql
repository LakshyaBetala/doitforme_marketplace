-- Debounce column for the funded-but-never-delivered escalation.
--
-- There was already a nudge for a funded gig, added to cron/nudge-posters as
-- "the moment after hiring is where deals die quietly". It fires when NOBODY
-- HAS SPOKEN since the money landed, and it skips the gig entirely the moment
-- one message exists:
--
--     if ((recentMsgs || 0) > 0) continue;
--
-- So it covers the pair who never started, and goes permanently silent for the
-- pair who said hello and then abandoned it — which is the case where the money
-- is actually trapped. Measured on the live database: of the funded,
-- undelivered gigs, 100% had a message after escrow_locked_at, so the nudge was
-- disabled for every single one of them.
--
-- The one that matters is ₹500 held for 35 days between a real company and a
-- real student. 20 messages on the gig, 6 of them after the money landed, the
-- last on the same day it was funded. status='assigned', delivered_at NULL, so
-- auto-release can never fire — it only scans status='DELIVERED'. There is no
-- timeout anywhere for "paid, assigned, never delivered", which means the money
-- has no exit except a dispute that only the poster can open.
--
-- poster_nudged_at already exists and belongs to the unanswered-applications
-- stage. Reusing it would make the two stages silence each other, so this is a
-- separate column.

alter table public.gigs
  add column if not exists escrow_stale_nudged_at timestamptz;

comment on column public.gigs.escrow_stale_nudged_at is
  'Last time cron/nudge-posters escalated a funded-but-undelivered gig. Separate from poster_nudged_at so the application-silence stage and the stuck-escrow stage cannot debounce each other.';

-- Finding them is an age scan over a small, highly selective slice, but it runs
-- daily and the table has 1,254 rows today and grows with every listing.
create index if not exists gigs_funded_undelivered_idx
  on public.gigs (escrow_locked_at)
  where status = 'assigned' and delivered_at is null;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'gigs'
       and column_name = 'escrow_stale_nudged_at'
  ) then
    raise exception 'escrow_stale_nudged_at was not added';
  end if;
  raise notice 'escrow_stale_nudged_at ready';
end $$;
