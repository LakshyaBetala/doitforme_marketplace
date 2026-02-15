-- Create chat_blocked_logs if not exists
CREATE TABLE IF NOT EXISTS public.chat_blocked_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  room_id text, -- Combined ID or Gig ID
  sender_id uuid,
  message text,
  reason text,
  blocked_at timestamp with time zone DEFAULT now(),
  CONSTRAINT chat_blocked_logs_pkey PRIMARY KEY (id)
);

-- Ensure RLS is enabled (or not, since it's a log table, maybe admin only)
ALTER TABLE public.chat_blocked_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (via API)
-- No public policies needed for now.
