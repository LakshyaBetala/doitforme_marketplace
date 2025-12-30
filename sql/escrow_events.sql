-- Table to log escrow events such as RELEASED, CANCELED
create table if not exists escrow_events (
  id uuid default gen_random_uuid() primary key,
  gig_id uuid not null,
  worker_id uuid,
  poster_id uuid,
  amount numeric not null,
  platform_fee numeric default 0,
  type text not null,
  created_at timestamptz default now()
);
