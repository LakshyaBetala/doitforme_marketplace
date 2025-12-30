-- freeze_wallet_amount: move funds from balance to frozen
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
      frozen = COALESCE(frozen,0) + amount_input
  WHERE user_id = user_id_input AND balance >= amount_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient funds or wallet not found for user %', user_id_input;
  END IF;
END;
$$;
