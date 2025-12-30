-- refund_escrow_transactional: atomically refund escrow to poster
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
  -- Lock escrow
  SELECT * INTO e_row FROM escrow WHERE gig_id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow not found for gig %', p_gig_id;
  END IF;

  SELECT * INTO g_row FROM gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found %', p_gig_id;
  END IF;

  -- Validate poster matches gig owner
  IF g_row.user_id IS DISTINCT FROM p_poster_id THEN
    RAISE EXCEPTION 'Poster id does not match gig owner';
  END IF;

  IF e_row.status IS NULL OR e_row.status <> 'HOLDING' THEN
    RAISE EXCEPTION 'Escrow not in HOLDING state';
  END IF;

  platform_fee := round((COALESCE(e_row.amount,0) * 0.10)::numeric, 2);
  refund_amount := round((COALESCE(e_row.amount,0) - platform_fee)::numeric, 2);

  -- Credit or create poster wallet
  INSERT INTO wallets(user_id, balance)
  VALUES (p_poster_id, refund_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + EXCLUDED.balance;

  -- Update escrow
  UPDATE escrow
  SET amount = 0, status = 'REFUNDED', refunded_at = now()
  WHERE gig_id = p_gig_id;

  -- Update gig
  UPDATE gigs
  SET status = 'CANCELLED', payment_status = 'REFUNDED'
  WHERE id = p_gig_id;

  -- Log escrow event
  INSERT INTO escrow_events(gig_id, worker_id, poster_id, amount, platform_fee, type, created_at)
  VALUES (p_gig_id, e_row.worker_id, p_poster_id, refund_amount, platform_fee, 'REFUND', now());

  -- Insert transaction for poster
  INSERT INTO transactions(gig_id, user_id, amount, type, status, created_at)
  VALUES (p_gig_id, p_poster_id, refund_amount, 'REFUND', 'COMPLETED', now());

  RETURN jsonb_build_object('success', true, 'refund_amount', refund_amount, 'platform_fee', platform_fee);
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
