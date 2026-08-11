-- Peer recommendations (2026-08-12).
--
-- Ratings (1-5 stars) require a completed, paid gig, and there have been zero of
-- those — so every profile on the platform shows the same empty trust signal and
-- a poster has nothing to choose between applicants on.
--
-- A recommendation is the lighter primitive: "I'd work with them again." It is
-- public, attributable, and one-per-pair, which makes it hard to farm and
-- meaningful at low volume. It gives a brand-new marketplace a trust signal that
-- does not depend on transaction history existing first.

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  -- Who is vouching.
  recommender_id uuid not null references public.users(id) on delete cascade,
  -- Who is being vouched for.
  recommended_id uuid not null references public.users(id) on delete cascade,
  -- Optional context: the gig they worked together on.
  gig_id uuid references public.gigs(id) on delete set null,
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),

  -- One vouch per pair. Without this a single person could inflate someone's
  -- count indefinitely and the number would mean nothing.
  constraint recommendations_unique_pair unique (recommender_id, recommended_id),
  -- Nobody recommends themselves.
  constraint recommendations_not_self check (recommender_id <> recommended_id)
);

create index if not exists idx_recommendations_recommended
  on public.recommendations (recommended_id, created_at desc);

alter table public.recommendations enable row level security;

-- Public trust signal: anyone can read them, including logged-out visitors
-- landing on a shared /u/<username> page.
drop policy if exists "recommendations are public" on public.recommendations;
create policy "recommendations are public"
  on public.recommendations for select
  using (true);

-- You may only write a recommendation AS yourself.
drop policy if exists "users write their own recommendations" on public.recommendations;
create policy "users write their own recommendations"
  on public.recommendations for insert
  with check (auth.uid() = recommender_id);

drop policy if exists "users remove their own recommendations" on public.recommendations;
create policy "users remove their own recommendations"
  on public.recommendations for delete
  using (auth.uid() = recommender_id);

-- Denormalised count on users so profile cards and lists don't need a subquery
-- per row. Maintained by trigger; never written by application code.
alter table public.users add column if not exists recommendation_count integer not null default 0;

create or replace function public.sync_recommendation_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.users
    set recommendation_count = recommendation_count + 1
    where id = new.recommended_id;
  elsif tg_op = 'DELETE' then
    update public.users
    set recommendation_count = greatest(recommendation_count - 1, 0)
    where id = old.recommended_id;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_sync_recommendation_count on public.recommendations;
create trigger trg_sync_recommendation_count
  after insert or delete on public.recommendations
  for each row execute function public.sync_recommendation_count();

-- Backfill in case rows exist from a previous run.
update public.users u
set recommendation_count = coalesce(c.n, 0)
from (select recommended_id, count(*) n from public.recommendations group by 1) c
where u.id = c.recommended_id;
