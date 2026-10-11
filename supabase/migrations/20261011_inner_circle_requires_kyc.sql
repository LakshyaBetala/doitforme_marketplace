-- Only a verified student can apply to the Inner Circle.
--
-- The Inner Circle is the group we put in front of paying companies and vouch
-- for by name. Screening somebody we cannot even confirm is a student is
-- backwards, and the check belongs in the database rather than only in the
-- form: applications are inserted straight from the browser client against RLS
-- (deliberately — there is no authorization an API route could add that the
-- policies do not already enforce), so a hidden button is not a control.
--
-- WHY A SECURITY DEFINER FUNCTION AND NOT A SUBQUERY
--
-- A subquery against public.users inside this policy would itself be subject to
-- RLS on public.users, which is the shape that produces either recursion or a
-- policy that silently evaluates to NULL. is_admin() and is_outreach() already
-- exist in this codebase for exactly this reason, and this follows them.
--
-- EXECUTE IS GRANTED TO authenticated ON PURPOSE
--
-- CLAUDE.md's rule is to revoke EXECUTE from PUBLIC, anon and authenticated and
-- grant back only to service_role. is_admin() is the documented exception
-- because EXECUTE is checked against the CALLING role even inside a policy, so
-- revoking it makes the policy fail with 42501 instead of returning a verdict.
-- The same applies here: authenticated must be able to execute this or every
-- Inner Circle application is refused with a permission error rather than a
-- clear "verify your ID first". anon is still revoked — an anonymous caller has
-- no application to insert.
--
-- It leaks nothing. It reads auth.uid() and answers only about the caller, so
-- the most anyone can learn is their own verification status, which they are
-- shown on their own profile anyway.

begin;

create or replace function public.is_kyc_approved()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select kyc_status = 'approved' from public.users where id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_kyc_approved() from public, anon;
grant execute on function public.is_kyc_approved() to authenticated, service_role;

-- The insert policy gains the requirement. Still own-row only.
drop policy if exists inner_circle_insert_own on public.inner_circle_applications;
create policy inner_circle_insert_own
  on public.inner_circle_applications for insert
  with check (auth.uid() = user_id and public.is_kyc_approved());

do $$
declare
  v_check text;
begin
  select pg_get_expr(polwithcheck, polrelid) into v_check
    from pg_policy
   where polrelid = 'public.inner_circle_applications'::regclass
     and polname = 'inner_circle_insert_own';

  if v_check is null or v_check not like '%is_kyc_approved%' then
    raise exception 'insert policy does not require KYC: %', coalesce(v_check, '(missing)');
  end if;

  if not has_function_privilege('authenticated', 'public.is_kyc_approved()', 'EXECUTE') then
    raise exception 'authenticated cannot execute is_kyc_approved(); every application would 42501';
  end if;

  if has_function_privilege('anon', 'public.is_kyc_approved()', 'EXECUTE') then
    raise exception 'anon should not be able to execute is_kyc_approved()';
  end if;

  raise notice 'Inner Circle applications now require kyc_status = approved';
end $$;

commit;
