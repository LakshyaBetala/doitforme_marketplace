-- Automated payouts (2026-08-12).
--
-- payout_queue previously allowed only PENDING | COMPLETED | FAILED, which has
-- no state for "we have handed this to Cashfree and are waiting". Without it the
-- payout cron cannot claim a row before calling the API, and a timeout after the
-- transfer was created would let the next run send the same money again.
--
-- PROCESSING is that claim. The row leaves PENDING before any network call, so
-- a crash mid-flight strands the row visibly instead of double-paying.

alter table public.payout_queue drop constraint if exists payout_queue_status_check;
alter table public.payout_queue add constraint payout_queue_status_check
  check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'));

alter table public.payout_queue add column if not exists processed_at timestamptz;

-- Cron lookup: oldest unpaid first.
create index if not exists idx_payout_queue_pending
  on public.payout_queue (created_at)
  where status = 'PENDING';

-- Rows stuck in PROCESSING are the ones a human must look at: the transfer may
-- or may not have gone out. Kept queryable rather than auto-retried, because
-- guessing wrong here means paying twice.
create index if not exists idx_payout_queue_processing
  on public.payout_queue (created_at)
  where status = 'PROCESSING';
