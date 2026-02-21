-- Fix for gigs_market_type constraint to allow 'REQUEST'
-- Run this in the Supabase SQL Editor

-- 1. Drop potential existing constraints that might be causing the issue
ALTER TABLE public.gigs DROP CONSTRAINT IF EXISTS gigs_market_type_check;
ALTER TABLE public.gigs DROP CONSTRAINT IF EXISTS gigs_market_type;

-- 2. Add the correct constraint
-- Allows market_type to be NULL (for HUSTLE)
-- Allows market_type to be 'SELL', 'RENT', or 'REQUEST' (for MARKET)
ALTER TABLE public.gigs
ADD CONSTRAINT gigs_market_type_check
CHECK (
  market_type IS NULL OR
  market_type IN ('SELL', 'RENT', 'FREE', 'BUY_REQUEST', 'REQUEST')
);
