-- Fix for V4 Requirements:
-- 1. negotiated_price should be on the APPLICATION (per worker), not just the GIG.
-- 2. handshake_code should be on the ESCROW record (secure), not just the GIG (public).

ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS negotiated_price numeric DEFAULT NULL;

ALTER TABLE public.escrow
ADD COLUMN IF NOT EXISTS handshake_code text DEFAULT NULL;

-- Index for faster lookup if needed
CREATE INDEX IF NOT EXISTS idx_escrow_handshake ON public.escrow(handshake_code);
