-- CRITICAL SCHEMA FIX & RLS
-- 1. Add missing avatar_url column
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'avatar_url') THEN 
        ALTER TABLE public.users ADD COLUMN avatar_url text; 
    END IF; 
END $$;

-- 2. Ensure receiver_id exists on messages
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'receiver_id') THEN 
        ALTER TABLE public.messages ADD COLUMN receiver_id uuid REFERENCES public.users(id); 
    END IF; 
END $$;

-- 3. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. USERS POLICIES (Public Read for Name/Avatar/Rating)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);

-- 5. MESSAGES POLICIES (Private Chat)
DROP POLICY IF EXISTS "Users can read their own messages" ON public.messages;
CREATE POLICY "Users can read their own messages" ON public.messages 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 6. Backfill receiver_id (Best Effort)
UPDATE public.messages m
SET receiver_id = (
  CASE 
    WHEN m.sender_id = g.poster_id THEN g.assigned_worker_id
    ELSE g.poster_id
  END
)
FROM public.gigs g
WHERE m.gig_id = g.id
AND m.receiver_id IS NULL;
