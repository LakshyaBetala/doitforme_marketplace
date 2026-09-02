-- Constraints the code assumes but the live database does not have.
--
-- Found by scripts/constraint-audit.mjs, which probes the running database with
-- disposable rows rather than trusting the migration folder. Every one of these
-- is a case where application code is the only thing standing between us and a
-- bad row — and application checks race, get refactored away, or are simply
-- bypassed by a service-role script.
--
-- Safe to run more than once.

BEGIN;

-- 1. payout_queue.amount must be positive.
--
-- The audit inserted amount = -500 and the database accepted it. A negative
-- payout row is not merely wrong, it is dangerous: the admin Payouts desk sums
-- pending amounts, so one negative row silently understates what is owed, and
-- any future automated payout would attempt a negative transfer.
--
-- Nothing legitimate ever queues a non-positive payout: manual_release_escrow
-- refuses when the computed net is <= 0, and the SPLIT settlement clamps with
-- Math.max(0, ...). This makes that guarantee the database's, not the caller's.
ALTER TABLE public.payout_queue DROP CONSTRAINT IF EXISTS payout_queue_amount_positive;
ALTER TABLE public.payout_queue
  ADD CONSTRAINT payout_queue_amount_positive CHECK (amount > 0);

-- 2. One rating per (gig, rater, rated).
--
-- /api/gig/rate-poster checks for an existing row before inserting, but that is
-- a read followed by a write with no lock between them: two requests that arrive
-- together both see "no existing rating" and both insert. A double-tap on a
-- slow connection is enough. Since a rating moves a public average, the
-- duplicate is visible on someone's profile forever.
--
-- The table is empty at the time of writing, so there is nothing to de-duplicate
-- first — but do it anyway, because this migration may be applied later against
-- a table that has since collected rows.
DELETE FROM public.ratings a
USING public.ratings b
WHERE a.gig_id = b.gig_id
  AND a.rater_id = b.rater_id
  AND a.rated_id = b.rated_id
  AND a.created_at > b.created_at;

ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_one_per_gig_rater_rated;
ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_one_per_gig_rater_rated UNIQUE (gig_id, rater_id, rated_id);

-- 3. Nobody rates themselves.
--
-- rate-poster rejects it and gig/complete cannot express it, but the constraint
-- costs nothing and closes the door for any future writer, including a
-- service-role script run by hand.
ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_no_self_rating;
ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_no_self_rating CHECK (rater_id <> rated_id);

COMMIT;
