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
-- lib/paymentSettlement.ts no longer depends on ON CONFLICT, so this migration
-- is defence in depth: it stops a second escrow row ever existing for the same
-- (gig, worker) pair, which is what multi-worker gigs need.
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
