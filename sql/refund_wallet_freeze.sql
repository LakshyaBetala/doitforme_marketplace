-- RPC: refund_wallet_freeze (move frozen_amount back to balance)
create or replace function refund_wallet_freeze(
  user_id_input uuid,
  amount_input numeric
)
returns void
language plpgsql
as $$
begin
  update wallets
  set frozen_amount = coalesce(frozen_amount,0) - amount_input,
      balance = coalesce(balance,0) + amount_input
  where user_id = user_id_input;
end;
$$;
