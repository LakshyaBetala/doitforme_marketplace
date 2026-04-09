-- Add profile fields to users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS portfolio_links text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS experience text,
ADD COLUMN IF NOT EXISTS resume_url text,
ADD COLUMN IF NOT EXISTS is_verified_company boolean DEFAULT false;

-- Add max_workers to gigs
ALTER TABLE public.gigs
ADD COLUMN IF NOT EXISTS max_workers integer DEFAULT 1;

-- Modify the CHECK constraint on listing_type to allow COMPANY_TASK
ALTER TABLE public.gigs DROP CONSTRAINT IF EXISTS gigs_listing_type_check;
ALTER TABLE public.gigs ADD CONSTRAINT gigs_listing_type_check 
  CHECK (listing_type = ANY (ARRAY['HUSTLE'::text, 'MARKET'::text, 'COMPANY_TASK'::text]));
