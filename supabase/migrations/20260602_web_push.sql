-- Web Push (PWA notifications). Stores each device's push subscription and, via
-- a pg_net trigger on `notifications`, fans every new notification out to the
-- user's devices automatically — so notifications created anywhere (DB triggers,
-- API routes, the admin broadcast) all reach the lock screen with zero extra code.

create extension if not exists pg_net;

-- One row per device/browser (keyed by its push endpoint).
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- Service-role only (the API routes use the service key). RLS on, no policies.
alter table public.push_subscriptions enable row level security;

-- On every new notification, async-POST it to our dispatch endpoint which sends
-- the Web Push. Exception-wrapped so a push failure can never block the insert.
create or replace function public.dispatch_push_on_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
  return NEW;
end;
$$;

drop trigger if exists trg_dispatch_push_on_notification on public.notifications;
create trigger trg_dispatch_push_on_notification
after insert on public.notifications
for each row execute function public.dispatch_push_on_notification();
