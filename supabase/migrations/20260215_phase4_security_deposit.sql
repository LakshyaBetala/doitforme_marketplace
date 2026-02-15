-- Add security_deposit column to gigs table for Phase 4 (Rentals)
ALTER TABLE public.gigs ADD COLUMN IF NOT EXISTS security_deposit numeric DEFAULT 0;
