-- Signups captured while Supabase is restricted (402 exceed_storage_size_quota).
--
-- Supabase Auth and REST both refuse requests, so nobody can create an account
-- during the outage. Without somewhere to put them, every student who arrives
-- this week is simply lost. This table is that somewhere: Cloudflare D1, free,
-- bound natively to the app Worker, and exportable.
--
-- It deliberately stores NO password. Collecting credentials into a side
-- database and replaying them later is how you end up with plaintext or
-- mis-hashed passwords in two systems. These people get an email invite to
-- finish signup properly through Supabase Auth once service returns, which also
-- means a working email address is verified by the act of returning.
--
-- Shaped to match what app/login/page.tsx asks for, so the replay into
-- public.users is a straight mapping rather than a guess.

CREATE TABLE IF NOT EXISTS waitlist (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL,
  name          TEXT,
  phone         TEXT,
  college       TEXT,
  -- 'student' | 'company' — which side of the marketplace they arrived for.
  intent        TEXT    NOT NULL DEFAULT 'student',
  -- Free text: what they want to earn from or hire for. Useful for the first
  -- outreach, and it is the only signal we get about demand this week.
  looking_for   TEXT,
  referral_code TEXT,
  source        TEXT,
  user_agent    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  -- Set when the row has been turned into a real account, so a replay can be
  -- re-run safely without inviting anyone twice.
  invited_at    TEXT
);

-- One row per address. A student refreshing the page should update their
-- details, not create a second entry.
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_email_idx ON waitlist (lower(email));
CREATE INDEX IF NOT EXISTS waitlist_created_idx ON waitlist (created_at);
