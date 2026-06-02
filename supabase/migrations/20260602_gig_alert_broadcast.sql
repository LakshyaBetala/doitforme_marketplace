-- New-gig broadcast: resumable/idempotent log of who has been alerted about a
-- gig, per channel. Only the service role writes here (RLS on, no policies).
create table if not exists public.gig_alerts_sent (
  gig_id uuid not null references public.gigs(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  channel text not null check (channel in ('inapp','email')),
  created_at timestamptz not null default now(),
  primary key (gig_id, user_id, channel)
);
alter table public.gig_alerts_sent enable row level security;

-- The "engaged" student audience for new-gig alerts: anyone with email who has
-- picked interests, completed their profile, or ever applied/messaged. Excludes
-- company accounts. SECURITY DEFINER + locked to service role (it returns emails).
create or replace function public.engaged_alert_audience()
returns table(id uuid, email text, name text, profile_complete boolean)
language sql stable security definer set search_path = public as $$
  select u.id, u.email, u.name,
    (u.name is not null and u.college is not null and u.phone is not null) as profile_complete
  from public.users u
  where u.email is not null
    and coalesce(u.role, 'STUDENT') <> 'COMPANY'
    and (
      array_length(u.preferences, 1) >= 1
      or (u.name is not null and u.college is not null and u.phone is not null)
      or exists (select 1 from public.applications a where a.worker_id = u.id)
      or exists (select 1 from public.messages m where m.sender_id = u.id)
    );
$$;

revoke all on function public.engaged_alert_audience() from public, anon, authenticated;
