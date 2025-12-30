-- 04_escrow_events_table.sql
-- Audit log for escrow state transitions and fees
CREATE TABLE IF NOT EXISTS public.escrow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid,
  worker_id uuid,
  poster_id uuid,
  amount numeric,
  platform_fee numeric DEFAULT 0,
  type text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escrow_events_gig_id ON public.escrow_events(gig_id);
