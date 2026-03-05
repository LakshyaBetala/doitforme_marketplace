-- handle_new_user_trigger.sql
-- Auto-creates public.users + public.wallets rows when any user signs up
-- (Google OAuth, OTP, or Password). Safe to run on production.
-- Run this in your Supabase SQL Editor.

-- 1. Create the trigger function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create public.users row from auth metadata
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;  -- Don't overwrite existing users

  -- Create wallet row so escrow/payout systems don't crash
  INSERT INTO public.wallets (user_id, balance, frozen)
  VALUES (new.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind trigger to auth.users (fires on every new signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
