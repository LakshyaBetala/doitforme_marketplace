-- V6 MASTER MIGRATION: FRICTIONLESS MARKET & WALLET
-- Run this in the Supabase SQL Editor

-- 1. UPDATE RLS FOR PAYOUT QUEUE (Financial Dashboard)
-- Enable RLS on payout_queue if not already enabled
ALTER TABLE payout_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it conflicts (optional, safe to just create new one if unique name)
DROP POLICY IF EXISTS "Users can view their own payouts" ON payout_queue;

-- Create Policy: Allow users to view rows where they are the worker/recipient
CREATE POLICY "Users can view their own payouts"
ON payout_queue
FOR SELECT
USING (auth.uid() = worker_id);

-- 2. STORAGE BUCKET: CHAT ATTACHMENTS
-- Create the bucket if it doesn't exist (handled via UI usually, but SQL can do it)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Allow Authenticated Users to Upload
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;

CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments' AND
  (LOWER(storage.extension(name)) = 'jpg' OR
   LOWER(storage.extension(name)) = 'jpeg' OR
   LOWER(storage.extension(name)) = 'png' OR
   LOWER(storage.extension(name)) = 'webp' OR
   LOWER(storage.extension(name)) = 'pdf' OR -- Added for Hustle docs
   LOWER(storage.extension(name)) = 'doc' OR
   LOWER(storage.extension(name)) = 'docx')
);

-- Storage Policy: Allow Public Read (or Authenticated Read)
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;

CREATE POLICY "Anyone can view chat attachments"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'chat-attachments');
