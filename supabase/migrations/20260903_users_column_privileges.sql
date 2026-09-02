-- Stop the users table from handing out every student's contact and payment
-- details to anyone holding the public anon key.
--
-- THE BREACH. public.users had TWO duplicate SELECT policies, both
-- `USING (true)` and both granted to PUBLIC, and no column privileges. RLS was
-- enabled, so it looked locked down. It was not: row security that returns
-- every row, combined with a table-wide SELECT grant, is the same as no
-- security. Verified live with nothing but the anon key that ships inside the
-- browser bundle:
--
--   GET /rest/v1/users?select=email,phone,upi_id  ->  200, and
--   Content-Range: 0-0/3152 — the whole table, unauthenticated.
--
-- That exposed, for 3152 students: email, phone, upi_id (a payment identifier),
-- id_card_url (the KYC document itself), telegram_chat_id, kyc_rejection_reason
-- and kyc_confidence, plus the signup_* attribution columns.
--
-- THE FIX. Profiles genuinely are public — the feed, gig pages and
-- /u/<username> read names, avatars, colleges and ratings with no session at
-- all — so the row policy stays permissive and the restriction goes on
-- COLUMNS, which is what actually separates "public profile" from "private
-- contact detail". RLS is row-level and cannot express this; column privileges
-- can.
--
-- SCOPE. This migration draws the line at anon, and deliberately leaves
-- `authenticated` with the full table. The anon key is the breach: it is
-- published in every page load and usable by anyone with curl. Narrowing
-- `authenticated` as well is worth doing, but it is a different job — a dozen
-- `select("*")` call sites and embedded `users!fk(... email ...)` joins would
-- all have to move to my_profile first, and getting that wrong logs everyone
-- out of their dashboard. my_profile is created below so that work has
-- somewhere to land; nothing depends on it yet.
--
-- Safe to run more than once.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. One SELECT policy, not two identical ones.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.users;

CREATE POLICY "Profiles are viewable by everyone" ON public.users
  FOR SELECT USING (true);

-- Same for the duplicated INSERT policy.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2. Column privileges for anon.
--
-- Revoke the table-wide grant, then hand back an explicit safe list. A column
-- added to users later is private to anonymous callers by default, which is the
-- right way round — the previous setup exposed every new column automatically.
--
-- This list is exactly what the anonymous surfaces read: the feed, /gig/<id>,
-- /u/<username> (see PUBLIC_FIELDS in app/u/[username]/page.tsx) and the
-- opengraph image.
-- ---------------------------------------------------------------------------
REVOKE SELECT ON public.users FROM anon;

GRANT SELECT (
  id, name, username, display_name, avatar_url, bio,
  college, year_of_study, branch, country, role,
  skills, portfolio_links, experience, preferences,
  rating, rating_count, jobs_completed, recommendation_count,
  kyc_verified, kyc_status, kyc_institution,
  is_elite, is_verified_company,
  created_at, updated_at, profile_last_edited_at
) ON public.users TO anon;

-- Withheld from anon, and this is the whole point:
--   email, phone, upi_id, id_card_url, telegram_chat_id,
--   kyc_rejection_reason, kyc_confidence, kyc_reviewed_at,
--   total_earned, points_balance, referred_by, referral_code, resume_url,
--   signup_source, signup_source_detail, signup_referrer, signup_landing

-- Signed-in users keep the table as before; see SCOPE above.
GRANT SELECT ON public.users TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. A place for own-row reads to move to.
--
-- security_invoker is off (the default), so the view reads with its owner's
-- rights and is unaffected by column revokes on the base table. The WHERE
-- clause is what keeps it honest: a caller only ever sees their own row.
-- Unused today — it exists so tightening `authenticated` later is a
-- find-and-replace rather than a redesign.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.my_profile;
CREATE VIEW public.my_profile AS
  SELECT
    id, email, name, username, display_name, avatar_url, bio,
    phone, upi_id, college, year_of_study, branch, country, role,
    skills, portfolio_links, experience, resume_url,
    rating, rating_count, jobs_completed, total_earned, points_balance,
    kyc_verified, kyc_status, kyc_rejection_reason, kyc_institution,
    kyc_confidence, kyc_reviewed_at, id_card_url,
    telegram_chat_id, preferences, referral_code, referred_by,
    is_elite, is_verified_company, recommendation_count,
    created_at, updated_at, profile_last_edited_at
  FROM public.users
  WHERE id = auth.uid();

REVOKE ALL ON public.my_profile FROM PUBLIC;
GRANT SELECT ON public.my_profile TO authenticated;

COMMIT;
