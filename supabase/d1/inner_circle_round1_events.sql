-- Event stream for the Inner Circle · Round 1 campaign.
--
-- Status transitions (invited → started → submitted → ...) live on the
-- inner_circle_round1 row as discrete columns; this table is the finer-
-- grained event log *between* those transitions: who opened their invite,
-- who clicked the template link but didn't start, who hit the dashboard
-- at 2am and bounced, who tried to submit with an invalid URL.
--
-- Append-only — no row is ever updated or deleted. The admin funnel reads
-- counts out of this; nothing in the product is driven by it, so a lost
-- write never breaks the flow.
--
-- Apply with:
--   npx wrangler d1 execute doitforme-waitlist --remote --file=supabase/d1/inner_circle_round1_events.sql
--   npx wrangler d1 execute doitforme-waitlist --local  --file=supabase/d1/inner_circle_round1_events.sql

CREATE TABLE IF NOT EXISTS inner_circle_round1_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Null when the event fires before the candidate authenticates (e.g. an
  -- invite_opened on an unknown token). Attached to the row otherwise, so a
  -- single candidate's full timeline is one JOIN away.
  candidate_id  INTEGER,
  cohort        TEXT    NOT NULL DEFAULT 'sales-2026-10',
  event         TEXT    NOT NULL,
  -- Free-form JSON for anything the admin funnel might want to show later —
  -- the previous page, a submission URL that failed validation, the hours
  -- left when a dashboard revisit happened. Keep it small; this table will
  -- get long.
  metadata      TEXT,
  -- The invite token (truncated if present) and user agent are useful for
  -- debugging a specific candidate's path. We store user agent whole because
  -- it's not sensitive and the strings are short.
  token_prefix  TEXT,
  user_agent    TEXT,
  occurred_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_r1_events_candidate ON inner_circle_round1_events (candidate_id);
CREATE INDEX IF NOT EXISTS idx_r1_events_event     ON inner_circle_round1_events (event);
CREATE INDEX IF NOT EXISTS idx_r1_events_cohort    ON inner_circle_round1_events (cohort, event);
CREATE INDEX IF NOT EXISTS idx_r1_events_time      ON inner_circle_round1_events (occurred_at);
