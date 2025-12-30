-- unfreeze_wallet_amount: move funds from frozen back to balance
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
      balance = balance + amount_input
  WHERE user_id = user_id_input AND COALESCE(frozen,0) >= amount_input;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient frozen funds or wallet not found for user %', user_id_input;
  END IF;
END;
$$;
