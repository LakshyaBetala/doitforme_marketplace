-- Create Payout Queue Table for Manual Processing
create table if not exists public.payout_queue (
    id uuid not null default gen_random_uuid(),
    worker_id uuid not null references public.users(id),
    gig_id uuid references public.gigs(id),
    amount numeric not null,
    upi_id text,
    status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'FAILED')),
    created_at timestamptz not null default now(),
    processed_at timestamptz,
    primary key (id)
);

-- Enable RLS
alter table public.payout_queue enable row level security;

-- Policies
create policy "Admins can view all payouts"
    on public.payout_queue for select
    using (auth.jwt() ->> 'email' IN ('lakshya.betala@gmail.com', 'betala911@gmail.com') OR auth.jwt() ->> 'role' = 'service_role');

create policy "Admins can update payouts"
    on public.payout_queue for update
    using (auth.jwt() ->> 'email' IN ('lakshya.betala@gmail.com', 'betala911@gmail.com') OR auth.jwt() ->> 'role' = 'service_role');
