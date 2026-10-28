-- A leftover profile row must not make an email permanently unable to sign up.
--
-- handle_new_user runs on every auth.users INSERT and copies the account into
-- public.users. It guards with ON CONFLICT (id) DO NOTHING — but public.users
-- also carries UNIQUE (email), and that constraint is NOT covered by an
-- ON CONFLICT targeting (id).
--
-- So if a profile row already holds that address under a DIFFERENT id — an
-- erased account, an abandoned test row, a half-finished migration — the INSERT
-- raises a unique violation. The trigger is part of the signup transaction, so
-- the whole signup rolls back: Supabase returns "Database error saving new
-- user", no auth row is created, and the person sees a generic server error
-- that no amount of retrying or incognito will get past.
--
-- There were 10 such rows in this database. Two were real addresses.
--
-- TWO failures, not one. Catching the unique violation alone is not enough:
-- wallets.user_id is a foreign key to public.users(id), so once the profile
-- insert is skipped the wallet insert dies with 23503 and the signup rolls back
-- anyway — same symptom, one line further down. Both inserts have to be
-- survivable, and the wallet has to be skipped when the profile was.
--
-- The handlers deliberately catch only these two conditions. A genuine fault (a
-- dropped column, a broken constraint) should still be loud rather than quietly
-- producing accounts with no profile row.
--
-- Whatever is skipped here is reconciled by /api/auth/create-user, which the
-- OAuth callback and the verify step both call after the account exists.
--
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_profile_exists boolean := false;
BEGIN
  BEGIN
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
    ON CONFLICT (id) DO NOTHING;

    v_profile_exists := EXISTS (SELECT 1 FROM public.users WHERE id = new.id);
  EXCEPTION WHEN unique_violation THEN
    -- Almost certainly the email unique index, hit by a stale row under a
    -- different id. Let the signup through.
    v_profile_exists := false;
    RAISE WARNING 'handle_new_user: profile insert skipped for % (unique violation)', new.email;
  END;

  -- Only attempt the wallet if the profile it references actually exists,
  -- otherwise this is a guaranteed foreign-key violation that would roll the
  -- signup back for the second time.
  IF v_profile_exists THEN
    BEGIN
      INSERT INTO public.wallets (user_id, balance, frozen)
      VALUES (new.id, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN unique_violation OR foreign_key_violation THEN
      RAISE WARNING 'handle_new_user: wallet insert skipped for %', new.email;
    END;
  END IF;

  RETURN new;
END;
$function$;

-- Release the addresses currently held hostage by rows with no auth account
-- behind them. The row itself stays — other people's gigs, messages and ratings
-- reference it — but the address it is squatting on is freed, which is the only
-- part that blocks a new signup.
--
-- Scoped to rows that have NO auth user: a live account's email is untouched.
-- The e2e-*@example.invalid fixtures are included deliberately; they are test
-- residue, not people.
UPDATE public.users u
SET email = NULL
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);
