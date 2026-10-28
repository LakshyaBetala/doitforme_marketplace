-- Stop firing an HTTP request per notification for users who cannot receive one.
--
-- dispatch_push_on_notification runs on EVERY row inserted into notifications and
-- unconditionally calls net.http_post against /api/push/dispatch. It never checks
-- whether the recipient has a push subscription.
--
-- Measured on the live database:
--
--   notifications inserted in 24h      11,934
--   distinct users ever notified        2,908
--   users with a push subscription        615   (21%)
--
-- So roughly 9,400 HTTP requests a day reach the Worker, cost an invocation and
-- some CPU, query push_subscriptions, find nothing, and return {ok:true,sent:0}.
-- On the Workers free tier that is ~9% of the entire 100k/day request budget
-- spent delivering nothing; on the paid plan it is billed CPU.
--
-- The fan-out itself is fine and is left alone: notify_interested_on_new_gig
-- targets only users whose `preferences` contain the gig's category, excludes the
-- poster and companies, and de-duplicates through gig_alerts_sent. The volume is
-- real interest, not a broadcast.
--
-- This adds the one missing precondition. In-app notifications are unaffected —
-- the row is still inserted and still shows in the bell. Only the *push* leg is
-- skipped, and only for people with nowhere to push to.
--
-- The secret stays inline because that is how the function was already written
-- and changing it needs a coordinated env rotation; it is noted here so it is not
-- mistaken for a value safe to leave in place forever. Anyone able to read
-- pg_proc can read it, so it should be rotated when convenient — see
-- PUSH_DISPATCH_SECRET in CLAUDE.md.
--
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public.dispatch_push_on_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  -- Nothing to deliver to: skip the HTTP call entirely.
  if not exists (
    select 1 from public.push_subscriptions ps where ps.user_id = NEW.user_id
  ) then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://www.doitforme.in/api/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', 'dbbe2ae28ca6cdfd505abbc9bb61747ad8cbd8260ee52ca7'
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'type', NEW.type,
      'content', NEW.content,
      'link', NEW.link
    )
  );
  return NEW;
exception when others then
  -- Deliberately swallowed: a push failure must never roll back the
  -- notification insert that triggered it.
  return NEW;
end;
$function$;

-- The lookup this guard performs on every insert needs to be cheap.
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);
