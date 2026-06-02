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

-- Tiered "engaged" student audience for new-gig alerts. Priority:
--   tier 1: interests include the gig's category   (has_interest)
--   tier 2: completed profile (name+college+phone)  (profile_complete)
--   tier 3: otherwise engaged (any interests / applied / messaged)
-- Returns every engaged student with the signals; the app assigns the tier.
-- SECURITY DEFINER + locked to service role (it returns emails).
create or replace function public.gig_alert_audience(p_category text)
returns table(id uuid, email text, name text, profile_complete boolean, has_interest boolean)
language sql stable security definer set search_path = public as $$
  select u.id, u.email, u.name,
    (u.name is not null and u.college is not null and u.phone is not null) as profile_complete,
    (p_category is not null and p_category = any(u.preferences)) as has_interest
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

revoke all on function public.gig_alert_audience(text) from public, anon, authenticated;

-- Auto in-app alert: on every new OPEN gig, instantly ping students whose
-- interests match the category (tier 1), for free. Exception-wrapped so a
-- notification failure can never block gig creation; logged so the admin
-- broadcast won't double-send the bell to them.
create or replace function public.notify_interested_on_new_gig()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_content text;
begin
  if NEW.status is distinct from 'open' or NEW.category is null then
    return NEW;
  end if;
  v_content := 'New ' || NEW.category || ' gig: "' || NEW.title || '"' ||
               case when NEW.price is not null then ' — ₹' || NEW.price::text else '' end;
  begin
    with targets as (
      select u.id from public.users u
      where u.email is not null
        and coalesce(u.role, 'STUDENT') <> 'COMPANY'
        and u.id <> NEW.poster_id
        and NEW.category = any(u.preferences)
        and not exists (
          select 1 from public.gig_alerts_sent s
          where s.gig_id = NEW.id and s.user_id = u.id and s.channel = 'inapp'
        )
    ),
    ins as (
      insert into public.notifications (user_id, type, content, link, is_read)
      select id, 'gig', v_content, '/gig/' || NEW.id, false from targets
      returning user_id
    )
    insert into public.gig_alerts_sent (gig_id, user_id, channel)
    select NEW.id, user_id, 'inapp' from ins;
  exception when others then
    null; -- never block gig creation on a notification error
  end;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_interested_on_new_gig on public.gigs;
create trigger trg_notify_interested_on_new_gig
after insert on public.gigs
for each row execute function public.notify_interested_on_new_gig();
