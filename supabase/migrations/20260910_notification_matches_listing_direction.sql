-- Stop telling students a job is available when somebody advertised themselves.
--
-- notify_interested_on_new_gig fires on any gig reaching status='open' and
-- writes: 'New <category> gig: "<title>" — ₹<price>'. It never looks at
-- listing_type.
--
-- There are two opposite kinds of listing:
--
--   HUSTLE / COMPANY_TASK   the poster is paying. Work is genuinely available,
--                           and "new gig" is the right words.
--   SERVICE / MARKET        the poster is being paid. They are advertising what
--                           they can do. No work is available; the reader is a
--                           potential CUSTOMER, not an applicant.
--
-- Live counts: 407 SERVICE against 32 HUSTLE. So ~92% of these alerts told
-- people a job had appeared when nothing of the sort had, and every one of them
-- fanned out to the whole matching-category audience. 787 people acted on that
-- and reached a dead end — zero of those listings ever funded, assigned or paid.
--
-- The fix is only the wording and the link framing; the targeting is unchanged
-- and was already correct (category matched against each user's preferences,
-- poster excluded, de-duplicated through gig_alerts_sent).
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
