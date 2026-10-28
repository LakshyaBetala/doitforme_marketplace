-- Inner Circle · Sales · Round 1 selection sprint.
--
-- The 607 people who ticked "Put me forward for the Inner Circle" on the hold
-- page are in Cloudflare D1 (the waitlist table), not Postgres. They are not
-- signed-up users: inner_circle_applications.user_id is a Postgres FK into
-- public.users and there is no user row to attach them to. So Round 1 lives
-- here, co-located with the waitlist, and the candidate authenticates with
-- email + DOB rather than a Supabase session.
--
-- Round 1 is a 24-hour lead-list task. The campaign window is 7 days: new
-- starts allowed up to day 7, the last 24h windows close on day 8. Reminders
-- fire from the cron Worker at T-12h, T-6h, T-3h, T-30m.
--
-- One table covers the current cohort and future rounds via `cohort`. The
-- `round` number isn't a column because R2/R3 copy and timing aren't locked —
-- when they are, we add a column or a sibling table rather than guessing now.
--
-- Apply with:
--   npx wrangler d1 execute doitforme-waitlist --remote --file=supabase/d1/inner_circle_round1.sql
--   npx wrangler d1 execute doitforme-waitlist --local  --file=supabase/d1/inner_circle_round1.sql

CREATE TABLE IF NOT EXISTS inner_circle_round1 (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Campaign tag. New rounds reuse this table under a different cohort key.
  cohort              TEXT    NOT NULL DEFAULT 'sales-2026-10',

  -- Who they are. Copied from the waitlist row on invite, so the portal does
  -- not have to re-join against waitlist on every request.
  email               TEXT    NOT NULL,
  name                TEXT,
  phone               TEXT,
  college             TEXT,

  -- Secret in the invite URL. 32 random bytes, base64url. The only way a
  -- stranger learns a candidate's identity, so it is not guessable and is
  -- never reused.
  token               TEXT    NOT NULL UNIQUE,

  -- Return-login secret. sha256(dob || pepper || token) rather than the DOB
  -- in plaintext — a D1 dump without the pepper (a Worker secret) cannot be
  -- rainbow-tabled, and salting with the token means the same DOB on two
  -- candidates produces two different hashes. Set on first visit, when the
  -- candidate enters their DOB alongside clicking "Start".
  dob_hash            TEXT,

  -- Lifecycle timestamps, unix seconds. Deadline is set only when the
  -- candidate clicks "Start my 24 hours" — not when the invite is emailed —
  -- so someone who opens the mail at a bad moment doesn't burn the window.
  invited_at          INTEGER NOT NULL,
  started_at          INTEGER,
  deadline_at         INTEGER,                   -- started_at + 86400
  -- Hard end of the campaign for THIS candidate. Set at invite time so the
  -- rule "new starts allowed up to day 7" is a plain integer compare, not an
  -- outer campaign table lookup.
  campaign_closes_at  INTEGER NOT NULL,

  status              TEXT    NOT NULL DEFAULT 'invited'
    CHECK (status IN (
      'invited',             -- email sent, link not clicked
      'started',             -- claimed, 24h timer running
      'submitted',           -- Google Sheet URL in, awaiting review
      'expired',             -- deadline passed without submission
      'advanced',            -- admin passed them to Round 2
      'rejected',            -- admin rejected with a written note
      'switched_to_tech'     -- opted into the Tech cohort instead
    )),

  -- Submission artefact. Validated at the API: must be a Google Sheets URL
  -- (host match). We don't open-and-parse it — admin reviews visually.
  submission_url      TEXT,
  submitted_at        INTEGER,

  -- Reminder scheduling, driven by the cron.
  -- next_reminder_at pins the next tick we want to fire; cron scans
  -- candidates where status='started' AND next_reminder_at <= now().
  next_reminder_at    INTEGER,
  -- JSON array of bucket keys we've already sent: ['12h','6h','3h','30m'].
  -- Idempotency net: the cron can re-run safely because we skip any bucket
  -- already in this list.
  reminders_sent      TEXT    NOT NULL DEFAULT '[]',

  -- Admin review.
  score               INTEGER,
  admin_note          TEXT,
  decided_at          INTEGER,
  decided_by          TEXT,

  -- Login rate limit, kept on the row itself rather than a KV namespace we'd
  -- have to add to wrangler.jsonc just for this. 5 wrong DOBs per 15 min per
  -- email, and the error message never confirms whether the email exists.
  login_fail_count         INTEGER NOT NULL DEFAULT 0,
  login_fail_window_start  INTEGER,

  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),

  -- One row per (cohort, email). Running the invite route twice doesn't
  -- double-send; it's a no-op for already-invited rows.
  UNIQUE (cohort, email)
);

-- Admin list filters by status; cron reminder/expiry scans both touch
-- status='started' plus a time comparison. Partial indexes keep them tiny.
CREATE INDEX IF NOT EXISTS idx_round1_status
  ON inner_circle_round1 (status);
CREATE INDEX IF NOT EXISTS idx_round1_next_reminder
  ON inner_circle_round1 (next_reminder_at)
  WHERE status = 'started' AND next_reminder_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_round1_deadline
  ON inner_circle_round1 (deadline_at)
  WHERE status = 'started';
CREATE INDEX IF NOT EXISTS idx_round1_token
  ON inner_circle_round1 (token);
CREATE INDEX IF NOT EXISTS idx_round1_email
  ON inner_circle_round1 (lower(email));
