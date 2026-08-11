-- Managed Mode + Elite pool.
--
-- Strategy pivot: stop being a zero-commission connection hub (which leaked every
-- successful match off-platform) and offer a *managed* delivery option where
-- DoItForMe assigns a vetted student and QAs the work. Managed gigs carry the
-- higher take rate in lib/fees.ts. `is_elite` flags the hand-picked top students
-- that managed assignment draws from.

-- Gig is handled by DoItForMe (we assign the worker, we QA). Drives the fee tier.
alter table public.gigs
  add column if not exists is_managed boolean not null default false;

-- Lifecycle for the managed queue, separate from the public gig `status`.
--   UNASSIGNED -> admin hasn't picked a student yet
--   ASSIGNED   -> a student has been assigned and notified
--   DELIVERED  -> work submitted, awaiting client/admin sign-off
--   CLOSED     -> released/completed
alter table public.gigs
  add column if not exists managed_status text
    check (managed_status is null or managed_status in ('UNASSIGNED','ASSIGNED','DELIVERED','CLOSED'));

-- Hand-picked Elite pool — manually curated for now (response speed, reliability).
alter table public.users
  add column if not exists is_elite boolean not null default false;

-- Admin queue lookup: managed gigs still waiting on assignment.
create index if not exists idx_gigs_managed_unassigned
  on public.gigs (created_at)
  where is_managed = true and managed_status = 'UNASSIGNED';
