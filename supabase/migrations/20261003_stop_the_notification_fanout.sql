-- The new-gig fan-out was 79% of the database.
--
-- MEASURED, not estimated:
--
--   notifications      377 MB   649,708 rows   648,814 of them type 'gig'
--   gig_alerts_sent    214 MB
--   everything else     12 MB   <- users, gigs, messages, applications, escrow,
--                                  transactions, the entire actual product
--   database total     750 MB   against a 500 MB free tier
--
-- Rate: ~45,000 notification rows per day. Read rate: 15,304 of 649,708 = 2.4%.
-- So 97.6% of the largest table in the database was never opened by anyone.
--
-- Two changes, both about who is worth telling.
--
-- 1. ADVERTS NO LONGER FAN OUT AT ALL.
--
-- A SERVICE listing is a shopfront advert — someone publishing what they can do
-- (see lib/gigRoles.ts). It is not work becoming available, and 858 of 1,190
-- gigs are adverts, so they were ~72% of the volume for the content least
-- likely to be acted on. Adverts are found by browsing /talent, which is what
-- that page is for.
--
-- 2. REAL TASKS NOTIFY AT MOST 200 PEOPLE, NEAREST FIRST.
--
-- Telling 1,092 students about one ₹400 gig is not reach, it is noise: the
-- applicant cap is 10 (50 for a Pro company), so at most 10 of those 1,092 can
-- ever act on it. Ordering by same-college first and most-recently-active next
-- means the 200 who are told are the 200 most likely to be useful to the poster.
--
-- Expected effect: ~45,000 rows/day -> under 4,000.
--
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public.notify_interested_on_new_gig()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_content text;
  v_poster_college text;
begin
  if NEW.status is distinct from 'open' or NEW.category is null then
    return NEW;
  end if;

  -- A gig created by hiring someone from their advert is addressed to one named
  -- person (20260911_direct_requests_are_not_public_listings.sql).
  if NEW.source_service_id is not null then
    return NEW;
  end if;

  -- An advert is not an opening. Nobody needs an alert that a classmate has
  -- listed a service; that is what /talent is for.
  if upper(coalesce(NEW.listing_type, '')) in ('SERVICE', 'MARKET') then
    return NEW;
  end if;

  v_content := 'New ' || NEW.category || ' task: "' || NEW.title || '"' ||
               case when NEW.price is not null then ' — ₹' || NEW.price::text else '' end;

  select college into v_poster_college from public.users where id = NEW.poster_id;

  begin
    with targets as (
      select u.id
      from public.users u
      where u.email is not null
        and coalesce(u.role, 'STUDENT') <> 'COMPANY'
        and u.id <> NEW.poster_id
        and NEW.category = any(u.preferences)
        and not exists (
          select 1 from public.gig_alerts_sent s
          where s.gig_id = NEW.id and s.user_id = u.id and s.channel = 'inapp'
        )
      -- Same campus first, then whoever has been active most recently. A gig
      -- can take 10 applicants; there is no value in telling the 1,000th
      -- person, and a real cost in storing that we did.
      order by
        (u.college is not distinct from v_poster_college) desc,
        u.updated_at desc nulls last
      limit 200
    ),
    ins as (
      insert into public.notifications (user_id, type, content, link, is_read)
      select id, 'gig', v_content, '/gig/' || NEW.id, false from targets
      returning user_id
    )
    insert into public.gig_alerts_sent (gig_id, user_id, channel)
    select NEW.id, user_id, 'inapp' from ins;
  exception when others then
    -- Never block the gig insert on a notification failure.
    null;
  end;

  return NEW;
end;
$function$;

-- Retention. Without this the table simply refills: at the old rate it was back
-- to a million rows in three weeks.
--
-- gig_alerts_sent exists only to stop a second alert for a gig that is still
-- live, so a week is generous. A notification nobody opened in two weeks will
-- not be opened.
CREATE OR REPLACE FUNCTION public.prune_notification_tables()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_alerts integer;
  v_notifs integer;
begin
  delete from public.gig_alerts_sent where created_at < now() - interval '7 days';
  get diagnostics v_alerts = row_count;

  delete from public.notifications where created_at < now() - interval '14 days';
  get diagnostics v_notifs = row_count;

  -- A read notification has done its job.
  delete from public.notifications where is_read = true and created_at < now() - interval '3 days';

  return json_build_object('gig_alerts_sent', v_alerts, 'notifications', v_notifs);
end;
$function$;

REVOKE ALL ON FUNCTION public.prune_notification_tables() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_notification_tables() TO service_role;

CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at);
CREATE INDEX IF NOT EXISTS gig_alerts_sent_created_at_idx ON public.gig_alerts_sent (created_at);
