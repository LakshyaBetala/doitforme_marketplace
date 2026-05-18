-- Company Pro tier (₹299/mo)
-- Free company: 1 gig per lifetime, max 10 applicants per gig.
-- Pro company (pro_until > now()): unlimited gigs, unlimited applicants, featured pin.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS pro_until timestamptz,
  ADD COLUMN IF NOT EXISTS lifetime_gigs_posted integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS companies_pro_until_idx ON public.companies(pro_until);

COMMENT ON COLUMN public.companies.pro_until IS 'Pro subscription expiry — NULL or past = free tier.';
COMMENT ON COLUMN public.companies.lifetime_gigs_posted IS 'Cumulative gig count, used to enforce free-tier 1-gig limit.';

-- Add featured flag on gigs so pro posts can be pinned in the feed.
ALTER TABLE public.gigs
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS gigs_is_featured_idx ON public.gigs(is_featured) WHERE is_featured = true;

-- Atomic counter increment for free-tier gating.
CREATE OR REPLACE FUNCTION public.increment_company_lifetime_gigs(p_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.companies
     SET lifetime_gigs_posted = COALESCE(lifetime_gigs_posted, 0) + 1
   WHERE user_id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_company_lifetime_gigs(uuid) TO authenticated;

-- Defence in depth: trigger blocks free-tier companies from posting >1 lifetime gig
-- and a second gig when their current one is still open/active.
CREATE OR REPLACE FUNCTION public.enforce_company_free_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pro_until timestamptz;
  v_lifetime  integer;
BEGIN
  -- Only applies to COMPANY_TASK listings
  IF NEW.listing_type <> 'COMPANY_TASK' THEN
    RETURN NEW;
  END IF;

  SELECT pro_until, lifetime_gigs_posted
    INTO v_pro_until, v_lifetime
    FROM public.companies
   WHERE user_id = NEW.poster_id;

  -- Pro: no caps.
  IF v_pro_until IS NOT NULL AND v_pro_until > now() THEN
    RETURN NEW;
  END IF;

  -- Free tier: 1 lifetime gig max.
  IF COALESCE(v_lifetime, 0) >= 1 THEN
    RAISE EXCEPTION 'Free tier limit reached. Upgrade to Company Pro for unlimited posting.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_company_free_tier_trigger ON public.gigs;
CREATE TRIGGER enforce_company_free_tier_trigger
  BEFORE INSERT ON public.gigs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_company_free_tier();
