-- FIX: Users Table RLS for Profile Insert & Update
-- This fixes "new row violates row level security policy for table users"
-- Run this in the Supabase SQL Editor

-- 1. Drop the existing restrictive UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

-- 2. Create a proper INSERT policy (was missing entirely)
-- Allows authenticated users to insert ONLY their own row
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. Create a new UPDATE policy that:
--    - Allows users to update safe profile fields (name, phone, upi_id, college, preferences, etc.)
--    - Prevents users from changing admin-controlled fields (role, kyc_verified, points, rating, etc.)
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Admin-locked fields must remain unchanged
    role = (SELECT role FROM public.users WHERE id = auth.uid())
    AND kyc_verified = (SELECT kyc_verified FROM public.users WHERE id = auth.uid())
    AND points_balance = (SELECT points_balance FROM public.users WHERE id = auth.uid())
    AND rating = (SELECT rating FROM public.users WHERE id = auth.uid())
    AND rating_count = (SELECT rating_count FROM public.users WHERE id = auth.uid())
    AND jobs_completed = (SELECT jobs_completed FROM public.users WHERE id = auth.uid())
    AND total_earned = (SELECT total_earned FROM public.users WHERE id = auth.uid())
    AND referral_code = (SELECT referral_code FROM public.users WHERE id = auth.uid())
  );
