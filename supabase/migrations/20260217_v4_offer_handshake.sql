-- Migration for V4: The Handshake Upgrade
-- 1. Update messages table for Offer Engine
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS type text DEFAULT 'text',
ADD COLUMN IF NOT EXISTS offer_amount numeric DEFAULT NULL;

-- 2. Update gigs table for Handshake & Offers
ALTER TABLE public.gigs 
ADD COLUMN IF NOT EXISTS handshake_code text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS negotiated_price numeric DEFAULT NULL;

-- 3. Add RLS policies if needed (Assuming existing policies cover updates, but good to double check)
-- Users can update handshake_code if they are the poster? 
-- Actually, handshake_code is system generated or poster generated.
-- Negotiated price is updated by system via API (service role).

-- Done.
