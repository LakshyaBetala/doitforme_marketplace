-- Close three live holes found by the Supabase security linter and confirmed
-- exploitable with nothing but the public anon key.
--
-- 1. ANONYMOUS CALLERS COULD RELEASE ESCROW.
--    Every SECURITY DEFINER function in `public` is exposed at /rest/v1/rpc/<name>
--    and EXECUTE defaults to PUBLIC, so manual_release_escrow was reachable by
--    anyone on the internet. Its own guard does not save it:
--
--      if auth.uid() is distinct from v_poster_id and not public.is_admin()
--
--    For an anonymous caller auth.uid() is NULL, so the left side is TRUE; the
--    JWT carries no email, so is_admin() returns NULL and `not NULL` is NULL.
--    `TRUE and NULL` is NULL, and `if NULL then` does not fire — the guard is
--    skipped and the release proceeds. Verified live: the call returned 200 with
--    "Gig not found", i.e. it ran the lookup and would have continued on a real
--    gig id. Same exposure for the refund and wallet functions.
--
-- 2. ANONYMOUS CALLERS COULD REWRITE WORKER STATS.
--    increment_worker_stats returned 204 to an anonymous POST — anyone could
--    inflate any student's jobs_completed and total_earned to any number.
--
-- 3. ANYONE COULD LIST EVERY STUDENT'S RESUME.
--    A broad SELECT policy on storage.objects let an anonymous caller enumerate
--    the `resumes` bucket. Verified live: the listing returned real object names.
--    Public buckets do not need a SELECT policy to serve object URLs — that
--    policy only enables listing, so dropping it closes enumeration while every
--    existing resume link keeps working.
--
-- Safe to run more than once.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Money and state: server-only.
--
-- Every one of these is called exclusively from an API route using the SERVICE
-- ROLE, which bypasses grants entirely — so revoking from anon and authenticated
-- costs the application nothing. Verified by grepping every .rpc( call site.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.manual_release_escrow(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_escrow_transactional(uuid, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.release_escrow_transactional(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.freeze_wallet_amount(uuid, numeric) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.unfreeze_wallet_amount(uuid, numeric) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_worker_stats(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.increment_worker_stats(uuid, numeric) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Trigger functions are not an API.
--
-- These exist to be fired by triggers, which run as the table owner and are
-- unaffected by EXECUTE grants. Being callable directly over HTTP only ever
-- let someone fire a side effect out of context.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.dispatch_push_on_notification() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_company_free_tier() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_interested_on_new_gig() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_gig_status() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_message() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_recommendation_count() FROM anon, authenticated;

-- The one RPC the browser genuinely calls (app/company/post) — a signed-in
-- company incrementing its own counter. Signed-in users keep it; anonymous
-- callers never needed it.
REVOKE ALL ON FUNCTION public.increment_company_lifetime_gigs(uuid) FROM anon;

-- is_admin() is deliberately left executable. It is referenced inside RLS
-- policies, which are evaluated as the querying role, so revoking EXECUTE would
-- break every policy that calls it. It leaks nothing: it reports only whether
-- the caller's own JWT is on the whitelist.

-- ---------------------------------------------------------------------------
-- 3. Pin search_path on every SECURITY DEFINER function.
--
-- A definer function that resolves unqualified names through the CALLER's
-- search_path can be hijacked: create a schema earlier in the path holding your
-- own `users` table, call the function, and it operates on yours with the
-- owner's privileges. manual_release_escrow was already pinned; the rest were
-- not.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.dispatch_push_on_notification() SET search_path = public, pg_temp;
ALTER FUNCTION public.enforce_company_free_tier() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_interested_on_new_gig() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_gig_status() SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_on_message() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_recommendation_count() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_company_lifetime_gigs(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_worker_stats(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_worker_stats(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.freeze_wallet_amount(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.unfreeze_wallet_amount(uuid, numeric) SET search_path = public, pg_temp;
ALTER FUNCTION public.refund_escrow_transactional(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.release_escrow_transactional(uuid) SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 4. Stop bucket enumeration.
--
-- Nothing in the application calls storage .list() — verified by grep — so
-- these policies served no purpose but to let outsiders index the buckets.
-- Object URLs on a public bucket are unaffected.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Read Access Resumes" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view gig images" ON storage.objects;
DROP POLICY IF EXISTS "Public View" ON storage.objects;

COMMIT;
