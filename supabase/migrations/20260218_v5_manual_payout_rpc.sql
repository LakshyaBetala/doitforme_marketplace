-- RPC to handle Manual Payout Release (Compliance)
create or replace function manual_release_escrow(p_gig_id uuid)
returns json as $$
declare
  v_escrow_record record;
  v_worker_upi text;
begin
  -- 1. Lock and Get Escrow Record
  select * into v_escrow_record
  from public.escrow
  where gig_id = p_gig_id and status = 'HELD'
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Escrow not found or not in HELD status');
  end if;

  -- 2. Get Worker UPI
  select upi_id into v_worker_upi
  from public.users
  where id = v_escrow_record.worker_id;

  -- 3. Update Escrow Status
  update public.escrow
  set status = 'RELEASED',
      updated_at = now()
  where id = v_escrow_record.id;

  -- 4. Update Gig Status (Optional, keeping consistent)
  update public.gigs
  set status = 'completed'
  where id = p_gig_id;

  -- 5. Insert into Payout Queue for Manual Processing
  insert into public.payout_queue (worker_id, gig_id, amount, upi_id, status)
  values (
    v_escrow_record.worker_id,
    p_gig_id,
    v_escrow_record.amount,
    v_worker_upi,
    'PENDING'
  );

  return json_build_object('success', true);
exception when others then
  return json_build_object('success', false, 'error', sqlerrm);
end;
$$ language plpgsql security definer;
