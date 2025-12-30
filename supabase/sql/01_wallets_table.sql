-- 01_wallets_table.sql
-- Creates wallets table used to track user balances and frozen amounts
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY,
  balance numeric DEFAULT 0 NOT NULL,
  frozen numeric DEFAULT 0 NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
