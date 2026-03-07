-- Migration to add profile_last_edited_at to track edit cooldown without locking new signups
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_last_edited_at TIMESTAMPTZ;
