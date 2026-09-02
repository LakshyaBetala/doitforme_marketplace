-- Re-applies the UNIQUE (gig_id, worker_id) constraint on public.escrow.
--
-- 20260322_1500_escrow_multi_worker.sql already declared this, but the live
-- database does not have it — the table still carries the original
-- escrow_gig_id_key UNIQUE (gig_id). The settlement path used
-- upsert(onConflict: "gig_id,worker_id"), which therefore failed every time
-- with 42P10 "no unique or exclusion constraint matching the ON CONFLICT
-- specification". The error was never checked, so gigs were marked
-- ESCROW_FUNDED with no escrow row behind them.
--
-- This is NOT merely defence in depth, which is how it was first described.
-- Verified against the live database on 2026-09-02: a second escrow insert for
-- the same gig fails with
--   23505  Key (gig_id)=(...) already exists
-- i.e. the surviving constraint is the single-worker-era escrow_gig_id_key on
-- gig_id ALONE. So a gig can only ever hold ONE escrow row, and every gig with
-- max_workers > 1 is unfundable past its first worker: settlement writes the
-- second escrow row, gets 23505, reverts the transaction to PENDING, and the
-- webhook retries forever against a constraint that can never be satisfied.
--
-- Four such gigs already exist (max_workers 2-5), including a 6-week contract.
-- Dropping escrow_gig_id_key for the (gig_id, worker_id) pair is what makes
-- multi-worker gigs possible at all.
--
-- Safe to run more than once.

BEGIN;

-- The single-worker-era constraint blocks multi-worker gigs entirely.
ALTER TABLE public.escrow DROP CONSTRAINT IF EXISTS escrow_gig_id_key;

-- Collapse any duplicate (gig_id, worker_id) pairs before adding the key.
-- Keeps the oldest row; there should be none of these in practice.
DELETE FROM public.escrow a
USING public.escrow b
WHERE a.gig_id = b.gig_id
  AND a.worker_id IS NOT DISTINCT FROM b.worker_id
  AND a.created_at > b.created_at;

ALTER TABLE public.escrow DROP CONSTRAINT IF EXISTS escrow_gig_id_worker_id_key;
ALTER TABLE public.escrow ADD CONSTRAINT escrow_gig_id_worker_id_key UNIQUE (gig_id, worker_id);

COMMIT;
