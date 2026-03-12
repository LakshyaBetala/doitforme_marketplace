-- SECURITY FIX: Restrict which columns users can update on their own profile.
-- This prevents users from escalating their role to "admin",
-- modifying their points_balance, kyc_verified, rating, or other privileged fields.
--
-- INSTRUCTIONS: Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- This replaces the existing "Users can update own profile" policy.

-- Step 1: Drop the existing overly permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- Step 2: Create a restricted UPDATE policy that only allows safe columns
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- The user can only update if privileged fields remain unchanged
    role = 'user'
    AND kyc_verified = (SELECT kyc_verified FROM public.users WHERE id = auth.uid())
    AND points_balance = (SELECT points_balance FROM public.users WHERE id = auth.uid())
    AND rating = (SELECT rating FROM public.users WHERE id = auth.uid())
    AND rating_count = (SELECT rating_count FROM public.users WHERE id = auth.uid())
    AND jobs_completed = (SELECT jobs_completed FROM public.users WHERE id = auth.uid())
    AND total_earned = (SELECT total_earned FROM public.users WHERE id = auth.uid())
  );

-- Verify with: SELECT * FROM pg_policies WHERE tablename = 'users';
