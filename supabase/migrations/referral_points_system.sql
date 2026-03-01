-- =============================================
-- REFERRAL POINTS SYSTEM - DATABASE MIGRATION
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add referral columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS points_balance INTEGER DEFAULT 0;

-- 2. Create referrals tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'SIGNED_UP' CHECK (status IN ('SIGNED_UP', 'FIRST_GIG_DONE')),
  signup_reward_paid BOOLEAN DEFAULT FALSE,
  gig_bonus_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create points transactions table
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('EARN', 'SPEND', 'EXPIRED')),
  reason TEXT NOT NULL,
  reference_id TEXT,
  expires_at TIMESTAMPTZ,
  redeemed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add highlighted column to gigs for boost feature
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS highlight_expires_at TIMESTAMPTZ;

-- 5. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_points_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_expires ON points_transactions(expires_at) WHERE type = 'EARN' AND redeemed = FALSE;
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

-- 6. Function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = code) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- 7. Function to atomically increment/decrement points balance
CREATE OR REPLACE FUNCTION increment_points(uid UUID, pts INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET points_balance = COALESCE(points_balance, 0) + pts WHERE id = uid;
END;
$$ LANGUAGE plpgsql;

-- 8. Auto-generate referral code for existing users who don't have one
UPDATE users SET referral_code = generate_referral_code() WHERE referral_code IS NULL;
