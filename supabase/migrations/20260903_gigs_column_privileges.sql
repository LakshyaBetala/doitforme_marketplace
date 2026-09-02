-- Take the private half of a gig out of anonymous reach.
--
-- gigs is a public listing table and its row policy should stay permissive —
-- /talent and /u/<username> are browsable without a session, by design. But the
-- table carries far more than a listing, and a bare `select=*` with the anon key
-- returned all of it for 366 gigs:
--
--   handshake_code   the 4-digit proof-of-handover PIN for in-person SELL/RENT
--                    deals. Published to the world, it proves nothing — anyone
--                    could read the code for any gig and claim the handover.
--   delivery_link    the delivered work itself, plus delivery_files. A worker
--   delivery_files   submits, and before the poster has even reviewed it the
--                    artifact is fetchable by a stranger. The poster paid for
--                    that; the worker did not agree to publish it.
--   dispute_reason   one party's written complaint about the other, readable by
--                    anyone who can guess a URL.
--   escrow_order_id, gateway_order_id, payment_session_id, payment_gateway
--                    payment-provider identifiers.
--   escrow_amount, gateway_fee, platform_fee, net_worker_pay
--                    the money breakdown behind the listed price.
--
-- Same shape of fix as 20260903_users_column_privileges.sql, and the same
-- deliberate scope: the line is drawn at anon, because the anon key is public
-- and the breach is unauthenticated reads. `authenticated` keeps the table so
-- that the poster's and worker's own `select("*")` calls on /feed, /gig/<id>,
-- /activity and /messages are untouched.
--
-- /feed and /gig/<id> are auth-gated in proxy.ts, so no anonymous page needs the
-- withheld columns. The one public page that read `select("*")` was
-- app/talent/page.tsx; it now names its columns.
--
-- Safe to run more than once.

BEGIN;

REVOKE SELECT ON public.gigs FROM anon;

-- The listing surface: what GigCard renders and what /u/<username> lists.
GRANT SELECT (
  id, poster_id, company_id, assigned_worker_id,
  title, description, category, images,
  price, currency, security_deposit,
  listing_type, market_type, item_condition,
  is_physical, location, github_link,
  status, deadline, max_workers, trust_based,
  is_featured, is_highlighted, highlight_expires_at, is_managed,
  created_at
) ON public.gigs TO anon;

-- Withheld from anon on purpose:
--   handshake_code, delivery_link, delivery_files, delivered_at,
--   dispute_reason, auto_release_at, managed_status,
--   escrow_order_id, gateway_order_id, payment_session_id, payment_gateway,
--   escrow_status, escrow_amount, escrow_locked_at, payment_status,
--   gateway_fee, platform_fee, net_worker_pay,
--   poster_nudged_at, cancelled_at, expired_at

GRANT SELECT ON public.gigs TO authenticated;

COMMIT;
