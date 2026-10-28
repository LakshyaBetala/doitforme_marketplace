-- REVOKE FROM PUBLIC is not enough on Supabase. anon is also granted directly.
--
-- CLAUDE.md records a trap: "REVOKE ... FROM anon does nothing; the grant comes
-- from PUBLIC." That is true, and it is only half of it. Supabase additionally
-- runs ALTER DEFAULT PRIVILEGES granting EXECUTE on every new function in
-- `public` to anon and authenticated *directly*. So a function hardened the
-- documented way keeps a direct grant to anon that the PUBLIC revoke never
-- touches, and the hardening reads as complete while changing nothing.
--
-- Found by auditing pg_proc against information_schema.routine_privileges after
-- adding is_outreach(). Two functions were affected:
--
--   prune_notification_tables()  — SECURITY DEFINER, and it DELETES. It was
--     reachable at POST /rest/v1/rpc/prune_notification_tables by anyone
--     holding the anon key, which ships inside every page load. One
--     unauthenticated call wipes every user's notifications older than 14 days
--     and every read notification older than 3 days. Its only legitimate caller
--     is /api/cron/prune-data, which uses the service role behind x-cron-secret.
--     20261003_stop_the_notification_fanout.sql revoked it FROM PUBLIC and
--     granted service_role, which is exactly the documented pattern, and anon
--     kept EXECUTE the whole time.
--
--   is_outreach()  — added minutes ago with the same mistake. Harmless in
--     itself (auth.uid() is NULL without a JWT, so it returns false and leaks
--     nothing) but it has no business being callable anonymously.
--
-- is_admin() is deliberately LEFT executable by anon. RLS policies on
-- anon-readable tables are written as `USING (... OR is_admin())`, and EXECUTE
-- is checked against the calling role even inside a policy — so revoking it
-- would make anonymous reads of /talent and public profiles fail with 42501
-- rather than return rows. It is a boolean predicate over auth.uid() and
-- discloses nothing.
--
-- The rule to carry forward: revoke FROM PUBLIC, anon, authenticated, then
-- grant back explicitly to the roles that genuinely need it. Verify with
-- has_function_privilege, not by reading the migration.
--
-- Safe to run more than once.

-- Deletes rows. Service role only; the cron route is the sole caller.
REVOKE ALL ON FUNCTION public.prune_notification_tables()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_notification_tables() TO service_role;

-- Read-only predicate, but only signed-in callers evaluate the policies that
-- use it, so authenticated is the floor.
REVOKE ALL ON FUNCTION public.is_outreach()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_outreach() TO authenticated, service_role;

-- Fail loudly if either revoke did not take. A migration that reports success
-- while changing nothing is the entire problem this file exists to fix.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.prune_notification_tables()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon still has EXECUTE on prune_notification_tables()';
  END IF;
  IF has_function_privilege('anon', 'public.is_outreach()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon still has EXECUTE on is_outreach()';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.prune_notification_tables()', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role LOST EXECUTE on prune_notification_tables() — the cron would break';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.is_outreach()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated LOST EXECUTE on is_outreach() — outreach RLS would 42501';
  END IF;
END $$;
