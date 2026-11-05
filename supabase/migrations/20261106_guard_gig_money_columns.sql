-- A poster could rewrite the money on their own gig straight through the REST API.
--
-- The UPDATE policies on gigs are `USING (auth.uid() = poster_id)` with no
-- WITH CHECK and no column restriction, and `authenticated` holds a table-wide
-- UPDATE grant. So with nothing but their own session, a poster could
--   PATCH /rest/v1/gigs?id=eq.<their gig>
-- and set price, payment_status, escrow_status, assigned_worker_id, the fees,
-- the delivery fields or dispute_reason to anything. Concretely:
--
--   * payment_status = 'ESCROW_FUNDED' without paying. A worker sees a funded
--     task, does the work, and release later finds no HELD escrow row.
--   * price changed after funding. The admin dispute SPLIT then computes
--     against a number nobody agreed to. This is the exact reason
--     /api/gig/update-price was deleted (CLAUDE.md, "An uncalled route.ts is
--     still a public endpoint"); the route was gone but the table was not shut.
--   * status flipped to 'completed' on a gig holding escrow. The escrow stays
--     HELD, nothing queues a payout, and the only exit is a dispute the
--     POSTER alone can open.
-- INSERT had the same gap: a gig could be created already funded and assigned,
-- or posted under a company the poster does not own.
--
-- WHY A TRIGGER AND NOT COLUMN GRANTS. Two server routes legitimately write gig
-- columns through the caller's own session, not the service role:
--   payments/create-order  -> gateway_order_id, payment_gateway, escrow_amount
--   gig/hire               -> payment_gateway, gateway_order_id
-- and two client paths write status (closing a direct, off-platform gig) and
-- is_featured (Company Pro). A trigger can allow exactly those and refuse the
-- rest, and can tell an escrow gig from a direct one, which a grant cannot.
--
-- WHO IT APPLIES TO. Only the PostgREST user roles (`authenticated`, `anon`)
-- and only when the caller is not an admin. The service role -- which every
-- route that actually moves money uses -- and the SECURITY DEFINER escrow
-- functions (manual_release_escrow, release_/refund_escrow_transactional),
-- which run as their owner, are not touched by it.
--
-- Every write path was audited before this was written: 2026-11-06, every
-- `.from('gigs').update(` and `.insert(` in app/, components/ and mobile/, and
-- every server route classified by which client performs the write. See
-- scripts/gig-guard-test.mjs, which proves both sides inside a rolled-back
-- transaction.

CREATE OR REPLACE FUNCTION public.guard_gig_money_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  bad text;
BEGIN
  -- Trusted callers: the service role, the table owner / migrations, and the
  -- definer escrow functions (which run as their owner). Admins are trusted too;
  -- is_admin() reads the JWT and is NULL-safe via coalesce.
  IF current_user NOT IN ('authenticated', 'anon') OR coalesce(public.is_admin(), false) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    bad := CASE
      WHEN NEW.price              IS DISTINCT FROM OLD.price              THEN 'price'
      WHEN NEW.payment_status     IS DISTINCT FROM OLD.payment_status     THEN 'payment_status'
      WHEN NEW.escrow_status      IS DISTINCT FROM OLD.escrow_status      THEN 'escrow_status'
      WHEN NEW.escrow_locked_at   IS DISTINCT FROM OLD.escrow_locked_at   THEN 'escrow_locked_at'
      WHEN NEW.escrow_order_id    IS DISTINCT FROM OLD.escrow_order_id    THEN 'escrow_order_id'
      WHEN NEW.assigned_worker_id IS DISTINCT FROM OLD.assigned_worker_id THEN 'assigned_worker_id'
      WHEN NEW.platform_fee       IS DISTINCT FROM OLD.platform_fee       THEN 'platform_fee'
      WHEN NEW.gateway_fee        IS DISTINCT FROM OLD.gateway_fee        THEN 'gateway_fee'
      WHEN NEW.net_worker_pay     IS DISTINCT FROM OLD.net_worker_pay     THEN 'net_worker_pay'
      WHEN NEW.security_deposit   IS DISTINCT FROM OLD.security_deposit   THEN 'security_deposit'
      WHEN NEW.auto_release_at    IS DISTINCT FROM OLD.auto_release_at    THEN 'auto_release_at'
      WHEN NEW.delivered_at       IS DISTINCT FROM OLD.delivered_at       THEN 'delivered_at'
      WHEN NEW.delivery_link      IS DISTINCT FROM OLD.delivery_link      THEN 'delivery_link'
      WHEN NEW.delivery_files     IS DISTINCT FROM OLD.delivery_files     THEN 'delivery_files'
      WHEN NEW.handshake_code     IS DISTINCT FROM OLD.handshake_code     THEN 'handshake_code'
      WHEN NEW.dispute_reason     IS DISTINCT FROM OLD.dispute_reason     THEN 'dispute_reason'
      WHEN NEW.poster_id          IS DISTINCT FROM OLD.poster_id          THEN 'poster_id'
      WHEN NEW.company_id         IS DISTINCT FROM OLD.company_id         THEN 'company_id'
      WHEN NEW.is_managed         IS DISTINCT FROM OLD.is_managed         THEN 'is_managed'
      WHEN NEW.managed_status     IS DISTINCT FROM OLD.managed_status     THEN 'managed_status'
      WHEN NEW.listing_type       IS DISTINCT FROM OLD.listing_type       THEN 'listing_type'
      WHEN NEW.source_service_id  IS DISTINCT FROM OLD.source_service_id  THEN 'source_service_id'
      -- status stays writable for direct gigs (the "Close task" path), but not
      -- once escrow is involved: then it moves only with the money.
      WHEN NEW.status IS DISTINCT FROM OLD.status
           AND (coalesce(OLD.escrow_status, 'NONE') <> 'NONE'
                OR coalesce(OLD.payment_status, 'PENDING') NOT IN ('PENDING', 'UNPAID')) THEN 'status'
      ELSE NULL
    END;
  ELSE -- INSERT: a new gig starts unpaid, unassigned and undelivered.
    bad := CASE
      WHEN coalesce(NEW.payment_status, 'PENDING') NOT IN ('PENDING', 'UNPAID') THEN 'payment_status'
      WHEN coalesce(NEW.escrow_status, 'NONE') <> 'NONE'      THEN 'escrow_status'
      WHEN NEW.assigned_worker_id IS NOT NULL                  THEN 'assigned_worker_id'
      WHEN NEW.escrow_amount      IS NOT NULL                  THEN 'escrow_amount'
      WHEN NEW.escrow_locked_at   IS NOT NULL                  THEN 'escrow_locked_at'
      WHEN coalesce(NEW.platform_fee, 0)   <> 0                THEN 'platform_fee'
      WHEN coalesce(NEW.net_worker_pay, 0) <> 0                THEN 'net_worker_pay'
      WHEN NEW.auto_release_at    IS NOT NULL                  THEN 'auto_release_at'
      WHEN NEW.delivered_at       IS NOT NULL                  THEN 'delivered_at'
      WHEN NEW.delivery_link      IS NOT NULL                  THEN 'delivery_link'
      WHEN NEW.handshake_code     IS NOT NULL                  THEN 'handshake_code'
      WHEN NEW.dispute_reason     IS NOT NULL                  THEN 'dispute_reason'
      -- Posting under a company you do not own. The INSERT policy checks only
      -- poster_id, so anyone could put a task out in a real company's name.
      -- The company post page sets company_id to the poster's own company, and
      -- managed work is assigned through the service role, so neither is hit.
      WHEN NEW.company_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.companies co
              WHERE co.id = NEW.company_id AND co.user_id = auth.uid()) THEN 'company_id'
      ELSE NULL
    END;
  END IF;

  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'gigs.% can only be changed by the server', bad
      USING ERRCODE = '42501',
            HINT = 'Money, escrow, assignment and delivery fields move through the API routes, not direct table writes.';
  END IF;
  RETURN NEW;
END;
$$;

-- A trigger function is never called over REST, but it is still a function in
-- an exposed schema: take EXECUTE away from the API roles explicitly (CLAUDE.md,
-- "REVOKE ... FROM PUBLIC is only half the fix on Supabase").
REVOKE ALL ON FUNCTION public.guard_gig_money_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_gig_money_columns ON public.gigs;
CREATE TRIGGER guard_gig_money_columns
  BEFORE INSERT OR UPDATE ON public.gigs
  FOR EACH ROW EXECUTE FUNCTION public.guard_gig_money_columns();
