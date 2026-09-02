-- Fixes an incomplete lockdown in 20260902_lock_down_rpcs_and_storage.sql.
--
-- That migration did REVOKE ... FROM anon, authenticated and reported success,
-- but the functions stayed callable by an anonymous client. Verified after
-- applying it:
--
--   manual_release_escrow        200  {"success": false, "error": "Gig not found"}
--   refund_escrow_transactional  400  P0001 "No escrow record found for this gig."
--   freeze_wallet_amount         400  P0001 "Insufficient funds"
--   increment_worker_stats       204
--
-- Every one of those is the function's OWN error, raised from inside its body —
-- proof it executed. A 400 there is not a permission denial, which is exactly
-- how the first attempt looked like it had worked.
--
-- The cause: PostgreSQL grants EXECUTE on every new function to PUBLIC by
-- default. anon and authenticated inherit it from PUBLIC, so revoking it from
-- them directly removes a grant they never separately held and changes nothing.
-- The privilege has to be taken from PUBLIC itself.
--
-- Revoking from PUBLIC also removes it from service_role, which the API routes
-- depend on, so each function is granted back to service_role explicitly.
--
-- Safe to run more than once.

BEGIN;

-- ---------------------------------------------------------------------------
-- Money and worker state: service_role only.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.manual_release_escrow(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manual_release_escrow(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.refund_escrow_transactional(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refund_escrow_transactional(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.release_escrow_transactional(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_escrow_transactional(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.freeze_wallet_amount(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freeze_wallet_amount(uuid, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.unfreeze_wallet_amount(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unfreeze_wallet_amount(uuid, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.increment_worker_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_worker_stats(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.increment_worker_stats(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_worker_stats(uuid, numeric) TO service_role;

-- ---------------------------------------------------------------------------
-- Trigger functions. Triggers fire as the table owner and ignore EXECUTE
-- grants, so nothing needs granting back — they simply stop being an HTTP API.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dispatch_push_on_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_company_free_tier() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_interested_on_new_gig() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_on_gig_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_on_message() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_recommendation_count() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- The one RPC the browser genuinely calls: a signed-in company incrementing its
-- own counter (app/company/post). Signed-in users and the server keep it;
-- anonymous callers lose it.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.increment_company_lifetime_gigs(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_company_lifetime_gigs(uuid) TO authenticated, service_role;

-- is_admin() stays broadly executable on purpose: it is referenced inside RLS
-- policies, which are evaluated as the querying role, so revoking it would make
-- every policy that calls it fail. It discloses nothing beyond whether the
-- caller's own JWT is on the whitelist.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

COMMIT;
