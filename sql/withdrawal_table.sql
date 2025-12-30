-- Create withdrawal_requests table
create table if not exists withdrawal_requests (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references users(id) on delete cascade,
  amount numeric not null,
  upi_id text not null,
  status text default 'PENDING', -- PENDING / APPROVED / REJECTED
  admin_note text,
  created_at timestamptz default now(),
  processed_at timestamptz
);
