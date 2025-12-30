-- Patch: Add delivered_at if missing
ALTER TABLE public.gigs
ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Now create index safely
CREATE INDEX IF NOT EXISTS idx_gigs_delivered_at 
ON public.gigs(delivered_at);
