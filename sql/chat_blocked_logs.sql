-- Table to log blocked chat messages (safety)
create table if not exists chat_blocked_logs (
  id uuid default gen_random_uuid() primary key,
  room_id uuid not null,
  sender_id uuid not null,
  original_message text not null,
  reason text,
  created_at timestamptz default now()
);
