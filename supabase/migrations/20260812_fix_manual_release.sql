-- Fix manual_release_escrow (2026-08-12). The previous version had three bugs,
-- any one of which is serious on a money path.
--
-- 1. NO AUTHORIZATION. It is `security definer` and checked nothing, so any
--    authenticated user could release escrow on any gig by passing its id.
-- 2. WRONG COLUMN. It read `v_escrow_record.amount`; the escrow table has
--    `amount_held` / `original_amount` and no `amount` at all. That raised,
--    was swallowed by `exception when others`, rolled the whole release back,
--    and returned success:false — which the API route never inspected, so the
--    poster was told the release succeeded while nothing happened.
-- 3. NULL UPI. It inserted whatever upi_id it found, including NULL, producing
--    unpayable rows in payout_queue that had to be chased down by hand.
--
-- Also: the blanket `exception when others` is removed. Swallowing every error
-- into a success-shaped JSON is what hid bug 2 for months. Real failures now
-- surface to the caller.

create or replace function manual_release_escrow(p_gig_id uuid)
returns json as $$
declare
  v_escrow_record record;
  v_worker_upi text;
  v_poster_id uuid;
  v_net numeric;
begin
  -- Authorization: only the gig's poster may release its escrow, or an admin.
  select poster_id into v_poster_id from public.gigs where id = p_gig_id;
  if v_poster_id is null then
    return json_build_object('success', false, 'error', 'Gig not found');
  end if;

  if auth.uid() is distinct from v_poster_id and not public.is_admin() then
    return json_build_object('success', false, 'error', 'Only the poster can release this payment');
  end if;

  -- Lock the held escrow row so two concurrent releases cannot both queue a payout.
  select * into v_escrow_record
  from public.escrow
  where gig_id = p_gig_id and status = 'HELD'
  for update;

  if not found then
    return json_build_object('success', false, 'error', 'Escrow not found or already released');
  end if;

  -- The worker must have a payout destination. UPI is deliberately not required
  -- to apply for work any more, so it has to be enforced HERE instead — at the
  -- one moment the user has money waiting and every reason to provide it.
  select upi_id into v_worker_upi
  from public.users
  where id = v_escrow_record.worker_id;

  if v_worker_upi is null or btrim(v_worker_upi) = '' then
    return json_build_object(
      'success', false,
      'error', 'The worker has not added a UPI ID yet. They have been asked to add one; try again once they do.',
      'code', 'WORKER_UPI_MISSING'
    );
  end if;

  -- Worker receives the task price minus the platform fee. The deposit portion
  -- of amount_held (rentals) is refunded separately and must not be paid out.
  v_net := coalesce(v_escrow_record.original_amount, 0) - coalesce(v_escrow_record.platform_fee, 0);

  if v_net <= 0 then
    return json_build_object('success', false, 'error', 'Computed payout is not positive');
  end if;

  update public.escrow
  set status = 'RELEASED',
      released_at = now()
  where id = v_escrow_record.id;

  update public.gigs
  set status = 'completed',
      payment_status = 'PAYOUT_PENDING',
      escrow_status = 'RELEASED'
  where id = p_gig_id;

  insert into public.payout_queue (worker_id, gig_id, amount, upi_id, status)
  values (v_escrow_record.worker_id, p_gig_id, v_net, v_worker_upi, 'PENDING');

  return json_build_object('success', true, 'amount', v_net);
end;
$$ language plpgsql security definer;

-- security definer functions should not trust a caller-supplied search_path.
alter function manual_release_escrow(uuid) set search_path = public, pg_temp;

-- Backstop: no payout row may ever carry an empty UPI, whatever writes it.
alter table public.payout_queue drop constraint if exists payout_queue_upi_present;
alter table public.payout_queue add constraint payout_queue_upi_present
  check (upi_id is not null and btrim(upi_id) <> '');
