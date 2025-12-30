-- RPC: freeze_wallet_amount
create or replace function freeze_wallet_amount(
  user_id_input uuid,
  amount_input numeric
)
returns void
language plpgsql
as $$
begin
  update wallets
  set balance = balance - amount_input,
      frozen_amount = coalesce(frozen_amount,0) + amount_input
  where user_id = user_id_input;
end;
$$;
