-- 05_chat_blocked_logs.sql
-- Stores logs of messages blocked by safety filters
CREATE TABLE IF NOT EXISTS public.chat_blocked_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid,
  sender_id uuid,
  message text,
  reason text,
  blocked_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_blocked_logs_room ON public.chat_blocked_logs(room_id);
