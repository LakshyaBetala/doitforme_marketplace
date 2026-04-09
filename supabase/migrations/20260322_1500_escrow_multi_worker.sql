-- Drop the old unique constraint on gig_id if it exists
-- The name might be escrow_gig_id_key depending on how it was created
DO $$ 
BEGIN
  BEGIN
    ALTER TABLE public.escrow DROP CONSTRAINT escrow_gig_id_key;
  EXCEPTION
    WHEN undefined_object THEN null;
  END;
END $$;

-- Add a new unique constraint on gig_id and worker_id
ALTER TABLE public.escrow ADD CONSTRAINT escrow_gig_id_worker_id_key UNIQUE (gig_id, worker_id);
