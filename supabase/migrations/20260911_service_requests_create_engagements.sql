-- Hiring from a service advert creates a normal engagement.
--
-- A SERVICE listing is a shopfront advert: someone publishing what they can do.
-- It is not a job and it never holds escrow. When a customer wants to hire that
-- person, /api/gig/request-service creates a NEW gig in the platform's one and
-- only money direction — the customer is the poster and pays, the provider is
-- the assigned worker and is paid — so deliver, release, dispute and payout all
-- work unchanged.
--
-- This column records which advert produced the engagement, so the provider can
-- see why a request arrived and so the shopfront's conversion is measurable. It
-- is the only schema change the fix needs.
--
-- ON DELETE SET NULL, not CASCADE: taking down your advert must never delete
-- the funded work that came from it.
--
-- Safe to run more than once.

ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS source_service_id uuid
  REFERENCES public.gigs(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.gigs.source_service_id IS
  'The SERVICE advert this engagement was requested from. NULL for gigs posted directly.';

-- Finding a provider's engagements-from-adverts is a per-advert lookup on the
-- provider dashboard, so it needs an index; the column is NULL for almost every
-- row, so keep the index partial and small.
CREATE INDEX IF NOT EXISTS gigs_source_service_id_idx
  ON public.gigs (source_service_id)
  WHERE source_service_id IS NOT NULL;

-- A service advert must never itself be assigned or funded. Nothing in the
-- product writes this any more, but the constraint is what makes that true
-- rather than merely intended -- the inverted model above went unnoticed for
-- 407 listings precisely because no rule contradicted it.
--
-- NOT VALID: enforced for every new and updated row, without scanning the
-- existing table. The 407 live adverts already satisfy it (zero were ever
-- assigned), so this is about speed of deployment, not about tolerating
-- exceptions -- validate it separately if you want the historical guarantee too.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gigs_service_advert_never_assigned'
  ) THEN
    ALTER TABLE public.gigs
      ADD CONSTRAINT gigs_service_advert_never_assigned
      CHECK (
        upper(coalesce(listing_type, '')) <> 'SERVICE'
        OR (assigned_worker_id IS NULL AND coalesce(payment_status, '') <> 'ESCROW_FUNDED')
      ) NOT VALID;
  END IF;
END $$;
