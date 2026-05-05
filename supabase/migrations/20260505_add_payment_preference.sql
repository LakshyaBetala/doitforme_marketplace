-- Add payment_preference column to applications (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'applications' AND column_name = 'payment_preference'
  ) THEN
    ALTER TABLE public.applications
    ADD COLUMN payment_preference text DEFAULT 'DIRECT' CHECK (payment_preference IN ('ESCROW', 'DIRECT'));
  END IF;
END $$;
