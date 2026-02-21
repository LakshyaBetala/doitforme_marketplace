-- Add unique constraint to applications table to support upsert in V5 Offer Engine
ALTER TABLE public.applications 
ADD CONSTRAINT applications_gig_id_worker_id_key UNIQUE (gig_id, worker_id);
