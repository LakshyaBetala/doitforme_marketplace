-- Add receiver_id to messages to support 1:1 conversations
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS receiver_id uuid REFERENCES public.users(id);

-- Create index for faster querying of user's chats
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON public.messages(sender_id, receiver_id);
