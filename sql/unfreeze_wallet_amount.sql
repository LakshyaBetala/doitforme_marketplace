-- RPC: unfreeze_wallet_amount (reduce frozen_amount by amount)
create or replace function unfreeze_wallet_amount(
  user_id_input uuid,
  amount_input numeric
)
returns void
language plpgsql
as $$
begin
  update wallets
  set frozen_amount = coalesce(frozen_amount,0) - amount_input
  where user_id = user_id_input;
end;
$$;
