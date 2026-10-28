-- The Inner Circle grows by adding a ROW, not by editing a CHECK constraint.
--
-- Both roles were hardcoded twice:
--
--   users_inner_circle_role_known   CHECK (... IN ('TECH','OUTREACH'))
--   inner_circle_role_known         CHECK (role IN ('TECH','OUTREACH'))
--
-- plus a TypeScript union and a hand-written list on the apply page. Opening a
-- third role therefore meant a migration and four edits, which is the same
-- shape as the admin whitelist that lived in eight files — and the plan is
-- explicitly to keep adding roles as this grows.
--
-- So the roles become a table the application flow reads. Opening a role is an
-- INSERT; closing one is an UPDATE. The two CHECKs become foreign keys, which
-- is a stronger guarantee than the CHECK was: a role can no longer be assigned
-- unless it actually exists.
--
-- WHAT CODE STILL HAS TO CHANGE FOR A NEW ROLE, HONESTLY
--
-- A role's own WORKSPACE is code — TECH has a brief tracker, OUTREACH has a
-- CRM — so a new role needs a page and a nav entry before it has somewhere to
-- land. What this makes free is everything around that: advertising the role,
-- taking applications, screening them, approving someone into it. A role with
-- no workspace yet is still perfectly usable as 'planned', which is the point:
-- applicants can see what is coming instead of being told "two roles, that's
-- it".
--
-- SCREENING
--
-- The decision was approve/reject plus a note, which is a verdict with no
-- trail. The three columns added to inner_circle_applications are FACTS, not a
-- state machine: when it was screened, when a practical task went out, what it
-- scored. The applicant-visible stage is DERIVED from them in
-- lib/innerCircle.ts, for the same reason the tech workflow is derived — this
-- repo already carries three state machines for one gig and a fourth that has
-- to be hand-synced is how the UI ends up disagreeing with reality.

begin;

create table if not exists public.inner_circle_roles (
  value       text primary key,
  label       text not null,
  tagline     text not null,
  blurb       text not null,
  -- open    = accepting applications now
  -- planned = advertised so people know it is coming; cannot be applied for
  -- closed  = existing members keep it, no new applications
  status      text not null default 'planned'
                check (status in ('open', 'planned', 'closed')),
  -- Target cohort size, shown only when we actually know it. Honest scarcity;
  -- null means "we have not decided", which is better than inventing a number.
  seats       int check (seats is null or seats > 0),
  sort        int not null default 100,
  created_at  timestamptz not null default now()
);

-- Seed the two that exist, then the ones that are genuinely next. Both planned
-- roles are things the product already half-does: managed mode promises that
-- DoItForMe QAs the work before it reaches the client, and a campus marketplace
-- grows campus by campus.
insert into public.inner_circle_roles (value, label, tagline, blurb, status, seats, sort)
values
  ('TECH', 'Build', 'You do the work',
   'You take company briefs and ship them — code, design, writing, research. Paid per brief, money held in escrow before you start.',
   'open', 20, 10),
  ('OUTREACH', 'Outreach', 'You bring the work in',
   'You find the companies and open the conversation. You get a pipeline to work, and credit for what you close.',
   'open', 5, 20),
  ('QA', 'Review', 'You are the last check before a client sees it',
   'You read delivered work against the brief and say whether it is ready. Managed briefs are supposed to be checked before they reach the company — this is the person who checks them.',
   'planned', null, 30),
  ('CAMPUS', 'Campus lead', 'You run DoItForMe at your college',
   'One person per campus who brings students in, knows who is actually good, and is the face of it on the ground.',
   'planned', null, 40)
on conflict (value) do nothing;

-- Anyone may read the registry: it is the role list on a public-facing page,
-- and it holds nothing private. Writes are service-role only, so a role cannot
-- be opened from the browser.
alter table public.inner_circle_roles enable row level security;

drop policy if exists inner_circle_roles_readable on public.inner_circle_roles;
create policy inner_circle_roles_readable
  on public.inner_circle_roles for select
  using (true);

revoke all on public.inner_circle_roles from public, anon, authenticated;
grant select on public.inner_circle_roles to anon, authenticated;
grant all on public.inner_circle_roles to service_role;

-- The CHECKs become foreign keys. Seeded above, so nothing is orphaned.
alter table public.users
  drop constraint if exists users_inner_circle_role_known;
alter table public.users
  drop constraint if exists users_inner_circle_role_fkey;
alter table public.users
  add constraint users_inner_circle_role_fkey
  foreign key (inner_circle_role) references public.inner_circle_roles (value)
  on update cascade on delete restrict;

alter table public.inner_circle_applications
  drop constraint if exists inner_circle_role_known;
alter table public.inner_circle_applications
  drop constraint if exists inner_circle_applications_role_fkey;
alter table public.inner_circle_applications
  add constraint inner_circle_applications_role_fkey
  foreign key (role) references public.inner_circle_roles (value)
  on update cascade on delete restrict;

-- Screening trail. Facts, from which the stage is derived.
alter table public.inner_circle_applications
  add column if not exists screened_at   timestamptz,
  add column if not exists task_sent_at  timestamptz,
  add column if not exists score         int check (score is null or (score >= 0 and score <= 100));

comment on column public.inner_circle_applications.screened_at is
  'When a human first read this application. Drives the applicant-visible stage; see applicationStage() in lib/innerCircle.ts.';
comment on column public.inner_circle_applications.task_sent_at is
  'When the practical assessment went out. The rubric is scored out of 100 into score.';
comment on column public.inner_circle_applications.score is
  'Screening score out of 100. Null until the practical has been marked.';

do $$
declare
  v_roles int;
  v_open int;
begin
  select count(*), count(*) filter (where status = 'open')
    into v_roles, v_open
    from public.inner_circle_roles;

  if v_roles < 4 then
    raise exception 'role registry not seeded: % rows', v_roles;
  end if;
  if v_open <> 2 then
    raise exception 'expected exactly 2 open roles, found %', v_open;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conname = 'inner_circle_applications_role_fkey'
       and conrelid = 'public.inner_circle_applications'::regclass
  ) then
    raise exception 'application role FK was not created';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'inner_circle_applications'
       and column_name = 'score'
  ) then
    raise exception 'screening columns were not added';
  end if;

  raise notice 'role registry live: % roles, % open', v_roles, v_open;
end $$;

commit;
