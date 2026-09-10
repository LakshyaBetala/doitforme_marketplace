-- A direct hire request is not a public listing, so it must not be announced.
--
-- Hiring someone from their service advert creates an engagement (see
-- 20260911_service_requests_create_engagements.sql): listing_type HUSTLE,
-- status 'open', no assigned worker yet, carrying source_service_id.
--
-- notify_interested_on_new_gig fires on ANY gig reaching status='open' with a
-- category, and fans a notification out to every user whose preferences match
-- it. That condition is an exact description of the engagement row — so a
-- private request between two people would be broadcast to the entire matching
-- audience as though a new job had been posted, and the people who acted on it
-- would arrive at a gig that already has its provider chosen.
--
-- The same shape leaked into the task board; app/feed/page.tsx now filters
-- source_service_id too. This is the notification half.
--
-- Only the guard changes. The listing-direction wording from
-- 20260910_notification_matches_listing_direction.sql is preserved exactly.
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
  v_is_supply boolean;
begin
  if NEW.status is distinct from 'open' or NEW.category is null then
    return NEW;
  end if;

  -- A gig spawned by hiring someone from their advert is addressed to one
  -- named person. Announcing it to a category audience invites applications
  -- to work that is not available.
  if NEW.source_service_id is not null then
    return NEW;
  end if;

  -- Does the poster get paid (supply) or pay (demand)?
  -- Mirrors posterIsRecipient() in lib/gigRoles.ts — keep the two in step.
  v_is_supply := upper(coalesce(NEW.listing_type, '')) in ('SERVICE', 'MARKET');

  if v_is_supply then
    -- Someone is offering. The reader might want to hire them.
    v_content := 'New ' || NEW.category || ' service available: "' || NEW.title || '"' ||
                 case when NEW.price is not null then ' — from ₹' || NEW.price::text else '' end;
  else
    -- Someone needs work done. The reader might want to apply.
    v_content := 'New ' || NEW.category || ' task: "' || NEW.title || '"' ||
                 case when NEW.price is not null then ' — ₹' || NEW.price::text else '' end;
  end if;

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
    -- Never block the gig insert on a notification failure.
    null;
  end;

  return NEW;
end;
$function$;
