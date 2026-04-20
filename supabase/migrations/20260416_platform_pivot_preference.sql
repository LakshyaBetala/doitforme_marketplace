-- Add payment_preference to applications table
ALTER TABLE public.applications
ADD COLUMN payment_preference text DEFAULT 'DIRECT' CHECK (payment_preference IN ('ESCROW', 'DIRECT'));
