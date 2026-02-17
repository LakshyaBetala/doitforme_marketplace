-- Add negotiated_price to applications table to support V5 Offer Engine
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS negotiated_price numeric DEFAULT NULL;
