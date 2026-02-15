-- 1. Ensure receiver_id exists on messages (Idempotent)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiver_id') THEN 
        ALTER TABLE public.messages ADD COLUMN receiver_id uuid REFERENCES public.users(id); 
    END IF; 
END $$;

-- 2. Enable RLS on specific tables if not already enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

-- 3. Create/Replace Policies for USERS (Public Read for Profiles)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);

-- 4. Create/Replace Policies for MESSAGES
-- Users can read messages where they are sender OR receiver
DROP POLICY IF EXISTS "Users can read their own messages" ON public.messages;
CREATE POLICY "Users can read their own messages" ON public.messages 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Users can insert messages if they are the sender
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 5. Fix for existing messages with NULL receiver_id (Optional: try to infer from Gig)
-- This is a best-effort backfill for legacy messages
UPDATE public.messages m
SET receiver_id = (
  CASE 
    WHEN m.sender_id = g.poster_id THEN g.assigned_worker_id -- If sender is poster, receiver is worker
    ELSE g.poster_id -- If sender is worker (or other), receiver is poster
  END
)
FROM public.gigs g
WHERE m.gig_id = g.id
AND m.receiver_id IS NULL;
