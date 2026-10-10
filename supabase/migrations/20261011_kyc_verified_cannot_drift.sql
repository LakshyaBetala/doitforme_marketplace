-- users.kyc_verified is a cache of (kyc_status = 'approved'). Make that true in
-- the database instead of in a comment.
--
-- The legacy boolean is what the product actually reads: /api/gig/apply gates
-- applications on it, /gig/[id] gates COMPANY_TASK on it, the profile and the
-- public /u/<username> page render the verified tick from it, and the OG image
-- bakes it into the share card. kyc_status drives the admin queue and the UI
-- copy. CLAUDE.md says the two are "kept in sync (true only when approved)".
-- They were not:
--
--   2 users  kyc_status='rejected'       kyc_verified=true   (reviewed 2026-05-30)
--   1 user   kyc_status='manual_review'  kyc_verified=true   (never reviewed)
--
-- So three people held a verified tick, the right to apply, and access to
-- company tasks, on an application that had been refused or never decided. It
-- is a small number and it was unfindable by reading code: both write paths
-- that matter (api/kyc/upload, api/admin/review-kyc) set the pair in a single
-- UPDATE and cannot drift.
--
-- The hole is /api/auth/create-user. It upserts the user row on every profile
-- edit and carries the boolean forward by READING it first
-- (`finalKyc = existingUser?.kyc_verified || false`) while never writing
-- kyc_status. A read-then-write of a field you are only trying to preserve is a
-- lost update: a student who is approved in the moment between that SELECT and
-- the UPSERT has the fresh approval overwritten with the stale value. The route
-- no longer sends the column at all — an upsert only updates the columns it
-- names, and the column default is false, so a new row is correct too.
--
-- Written as coalesce(...) rather than a plain equality because kyc_verified is
-- nullable. A bare `kyc_verified = (kyc_status = 'approved')` evaluates to NULL
-- for a NULL boolean, and a CHECK that returns NULL PASSES — so the one shape
-- worth preventing, a NULL masquerading as approved, would have slipped through
-- the constraint meant to stop it.

begin;

-- 1. Repair. kyc_status is the reviewed decision and therefore the truth; the
--    boolean is the cache, so the cache loses.
update public.users
   set kyc_verified = (kyc_status = 'approved')
 where coalesce(kyc_verified, false) <> (kyc_status = 'approved');

-- 2. Enforce, so it cannot drift again from a path nobody is looking at.
alter table public.users
  drop constraint if exists users_kyc_verified_matches_status;

alter table public.users
  add constraint users_kyc_verified_matches_status
  check (coalesce(kyc_verified, false) = (kyc_status = 'approved'));

-- 3. Assert, rather than trust that the two statements above did anything.
--    A migration that reports success while changing nothing is the specific
--    failure this repo has been bitten by more than once.
do $$
declare
  v_bad int;
  v_has_constraint boolean;
begin
  select count(*) into v_bad
    from public.users
   where coalesce(kyc_verified, false) <> (kyc_status = 'approved');
  if v_bad > 0 then
    raise exception 'kyc repair failed: % rows still disagree', v_bad;
  end if;

  select exists (
    select 1 from pg_constraint
     where conrelid = 'public.users'::regclass
       and conname = 'users_kyc_verified_matches_status'
  ) into v_has_constraint;
  if not v_has_constraint then
    raise exception 'users_kyc_verified_matches_status was not created';
  end if;

  raise notice 'kyc_verified now matches kyc_status for every row, and is constrained';
end $$;

commit;
