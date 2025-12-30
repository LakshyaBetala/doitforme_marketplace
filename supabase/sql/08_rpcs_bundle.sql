-- 08_rpcs_bundle.sql
-- Installs the RPCs for escrow and wallet management. If you already have these separate files, run them in order.

-- Release escrow (idempotent behavior depends on table state)
CREATE OR REPLACE FUNCTION public.release_escrow_transactional(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  e_row RECORD;
  platform_fee numeric := 0;
  worker_amount numeric := 0;
BEGIN
  SELECT * INTO e_row FROM escrow WHERE gig_id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow not found for gig %', p_gig_id;
  END IF;
  IF e_row.status IS NULL OR e_row.status <> 'HOLDING' THEN
    RAISE EXCEPTION 'Escrow not in HOLDING state';
  END IF;
  platform_fee := round((COALESCE(e_row.amount,0) * 0.10)::numeric, 2);
  worker_amount := round((COALESCE(e_row.amount,0) - platform_fee)::numeric, 2);
  INSERT INTO wallets(user_id, balance)
  VALUES (e_row.worker_id, worker_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + EXCLUDED.balance;
  UPDATE escrow
  SET amount = 0, status = 'RELEASED', released_at = now()
  WHERE gig_id = p_gig_id;
  UPDATE gigs
  SET status = 'COMPLETED', payment_status = 'RELEASED', released_at = now()
  WHERE id = p_gig_id;
  INSERT INTO escrow_events(gig_id, worker_id, poster_id, amount, platform_fee, type, created_at)
  VALUES (p_gig_id, e_row.worker_id, e_row.poster_id, worker_amount, platform_fee, 'RELEASED', now());
  INSERT INTO transactions(gig_id, user_id, amount, type, status, created_at)
  VALUES (p_gig_id, e_row.worker_id, worker_amount, 'ESCROW_RELEASE', 'COMPLETED', now());
  RETURN jsonb_build_object('success', true, 'worker_amount', worker_amount, 'platform_fee', platform_fee);
END;
$$;

-- Refund escrow
CREATE OR REPLACE FUNCTION public.refund_escrow_transactional(p_gig_id uuid, p_poster_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  e_row RECORD;
  g_row RECORD;
  refund_amount numeric := 0;
  platform_fee numeric := 0;
BEGIN
  SELECT * INTO e_row FROM escrow WHERE gig_id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow not found for gig %', p_gig_id;
  END IF;
  SELECT * INTO g_row FROM gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found %', p_gig_id;
  END IF;
  IF g_row.user_id IS DISTINCT FROM p_poster_id THEN
    RAISE EXCEPTION 'Poster id does not match gig owner';
  END IF;
  IF e_row.status IS NULL OR e_row.status <> 'HOLDING' THEN
    RAISE EXCEPTION 'Escrow not in HOLDING state';
  END IF;
  platform_fee := round((COALESCE(e_row.amount,0) * 0.10)::numeric, 2);
  refund_amount := round((COALESCE(e_row.amount,0) - platform_fee)::numeric, 2);
  INSERT INTO wallets(user_id, balance)
  VALUES (p_poster_id, refund_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + EXCLUDED.balance;
  UPDATE escrow
  SET amount = 0, status = 'REFUNDED', refunded_at = now()
  WHERE gig_id = p_gig_id;
  UPDATE gigs
  SET status = 'CANCELLED', payment_status = 'REFUNDED'
  WHERE id = p_gig_id;
  INSERT INTO escrow_events(gig_id, worker_id, poster_id, amount, platform_fee, type, created_at)
  VALUES (p_gig_id, e_row.worker_id, p_poster_id, refund_amount, platform_fee, 'REFUND', now());
  INSERT INTO transactions(gig_id, user_id, amount, type, status, created_at)
  VALUES (p_gig_id, p_poster_id, refund_amount, 'REFUND', 'COMPLETED', now());
  RETURN jsonb_build_object('success', true, 'refund_amount', refund_amount, 'platform_fee', platform_fee);
END;
$$;

-- Freeze wallet amount
CREATE OR REPLACE FUNCTION public.freeze_wallet_amount(user_id_input uuid, amount_input numeric)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF amount_input <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  UPDATE wallets
  SET balance = balance - amount_input,
      frozen = COALESCE(frozen,0) + amount_input,
      updated_at = now()
  WHERE user_id = user_id_input AND balance >= amount_input;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient funds or wallet not found for user %', user_id_input;
  END IF;
END;
$$;

-- Unfreeze wallet amount
CREATE OR REPLACE FUNCTION public.unfreeze_wallet_amount(user_id_input uuid, amount_input numeric)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF amount_input <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  UPDATE wallets
  SET frozen = frozen - amount_input,
      balance = balance + amount_input,
      updated_at = now()
  WHERE user_id = user_id_input AND COALESCE(frozen,0) >= amount_input;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient frozen funds or wallet not found for user %', user_id_input;
  END IF;
END;
$$;
