-- Extend the new-gig alert audience with "related field" targeting.
--   has_interest -> the gig's own category is in the student's interests
--   has_related  -> one of the admin-chosen related categories is in their interests
-- Used by the admin broadcast to send three personalized email designs
-- (interested / related fields / all engaged).

drop function if exists public.gig_alert_audience(text);
drop function if exists public.gig_alert_audience(text, text[]);

create or replace function public.gig_alert_audience(p_category text, p_extra_categories text[] default '{}')
returns table(id uuid, email text, name text, profile_complete boolean, has_interest boolean, has_related boolean)
language sql stable security definer set search_path = public as $$
  select u.id, u.email, u.name,
    (u.name is not null and u.college is not null and u.phone is not null) as profile_complete,
    (p_category is not null and p_category = any(u.preferences)) as has_interest,
    (coalesce(array_length(p_extra_categories, 1), 0) > 0 and u.preferences && p_extra_categories) as has_related
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

revoke all on function public.gig_alert_audience(text, text[]) from public, anon, authenticated;
