-- Add flagged_for_review column to messages for Hybrid AI Moderation
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT FALSE;

-- Index for querying flagged messages for admin dashboard
CREATE INDEX IF NOT EXISTS idx_messages_flagged ON public.messages(flagged_for_review);
