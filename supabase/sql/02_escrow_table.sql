-- 02_escrow_table.sql
-- Escrow table to hold amounts per gig
CREATE TABLE IF NOT EXISTS public.escrow (
  gig_id uuid PRIMARY KEY,
  poster_id uuid,
  worker_id uuid,
  amount numeric DEFAULT 0 NOT NULL,
  status text DEFAULT 'HOLDING' NOT NULL,
  created_at timestamptz DEFAULT now(),
  released_at timestamptz,
  refunded_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_escrow_status ON public.escrow(status);
