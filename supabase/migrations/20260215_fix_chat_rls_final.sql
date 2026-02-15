-- FINAL RLS FIX FOR CHAT & PROFILES
-- 1. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 2. USERS TABLE POLICIES (Public Read)
-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Create permissive read policy (Critical for Chat & Gig Details)
CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- 3. MESSAGES TABLE POLICIES (Private Chat)
DROP POLICY IF EXISTS "Users can read their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;

-- Read: Sender OR Receiver can read
CREATE POLICY "Users can read their own messages" ON public.messages 
FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Insert: Users can only insert as themselves
CREATE POLICY "Users can insert their own messages" ON public.messages 
FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 4. BACKFILL RECEIVER_ID (Self-Healing)
-- If receiver_id is missing, try to derive it from the Gig
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
