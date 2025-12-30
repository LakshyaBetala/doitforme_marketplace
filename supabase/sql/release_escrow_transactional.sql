-- release_escrow_transactional: atomically release escrow for a gig
CREATE OR REPLACE FUNCTION public.release_escrow_transactional(p_gig_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  e_row RECORD;
  g_row RECORD;
  platform_fee numeric := 0;
  worker_amount numeric := 0;
BEGIN
  -- Lock escrow row for update
  SELECT * INTO e_row FROM escrow WHERE gig_id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Escrow not found for gig %', p_gig_id;
  END IF;

  IF e_row.status IS NULL OR e_row.status <> 'HOLDING' THEN
    RAISE EXCEPTION 'Escrow not in HOLDING state';
  END IF;

  SELECT * INTO g_row FROM gigs WHERE id = p_gig_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gig not found %', p_gig_id;
  END IF;

  platform_fee := round((COALESCE(e_row.amount,0) * 0.10)::numeric, 2);
  worker_amount := round((COALESCE(e_row.amount,0) - platform_fee)::numeric, 2);

  -- Credit or create worker wallet (upsert)
  INSERT INTO wallets(user_id, balance)
  VALUES (e_row.worker_id, worker_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = wallets.balance + EXCLUDED.balance;

  -- Update escrow row
  UPDATE escrow
  SET amount = 0, status = 'RELEASED', released_at = now()
  WHERE gig_id = p_gig_id;

  -- Update gig status
  UPDATE gigs
  SET status = 'COMPLETED', payment_status = 'RELEASED', released_at = now()
  WHERE id = p_gig_id;

  -- Log escrow event
  INSERT INTO escrow_events(gig_id, worker_id, poster_id, amount, platform_fee, type, created_at)
  VALUES (p_gig_id, e_row.worker_id, e_row.poster_id, worker_amount, platform_fee, 'RELEASED', now());

  -- Create transaction record for worker
  INSERT INTO transactions(gig_id, user_id, amount, type, status, created_at)
  VALUES (p_gig_id, e_row.worker_id, worker_amount, 'ESCROW_RELEASE', 'COMPLETED', now());

  RETURN jsonb_build_object('success', true, 'worker_amount', worker_amount, 'platform_fee', platform_fee);
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;
