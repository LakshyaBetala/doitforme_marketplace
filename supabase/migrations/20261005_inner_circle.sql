-- The Inner Circle: a curated tier, with an actual application trail.
--
-- The capability already half-existed. users.is_elite has been in the schema
-- since the managed-mode pivot, where the admin assignment UI sorts elite
-- students first — but nothing ever set it (0 rows flagged) and nothing in the
-- product ever mentioned it. So the tier was real in the database and invisible
-- to everyone it was meant to reward.
--
-- What was missing is the membership lifecycle. is_elite is a boolean an admin
-- flips; it records that someone is in, not that they asked, when, why, or that
-- they were turned down. Without that there is no queue to review and no way to
-- tell a student anything other than silence.
--
-- Deliberately a separate table rather than more columns on users: this is an
-- application with a lifecycle, and users is already 44 columns wide and read
-- on nearly every page.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.inner_circle_applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- pending -> approved | rejected | withdrawn
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),

  -- What they want to be picked for, in their words. This is the only thing an
  -- admin has to judge on beyond their delivery record.
  pitch       text,
  -- Links that show the work. Kept separate from users.portfolio_links so a
  -- student can put their strongest three forward rather than everything.
  links       text[] NOT NULL DEFAULT '{}',

  -- Set when an admin decides. The note is shown to the student, so it has to
  -- be written as something a person should read.
  decided_at  timestamptz,
  decided_by  text,
  decision_note text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One live application per student. Re-applying after a rejection is allowed —
-- the partial index only constrains the open ones.
CREATE UNIQUE INDEX IF NOT EXISTS inner_circle_one_open_per_user
  ON public.inner_circle_applications (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS inner_circle_status_idx
  ON public.inner_circle_applications (status, created_at);

ALTER TABLE public.inner_circle_applications ENABLE ROW LEVEL SECURITY;

-- A student sees and writes only their own row. Admins see everything through
-- is_admin(), the same SQL-side whitelist every other admin policy uses.
DROP POLICY IF EXISTS inner_circle_select_own ON public.inner_circle_applications;
CREATE POLICY inner_circle_select_own ON public.inner_circle_applications
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS inner_circle_insert_own ON public.inner_circle_applications;
CREATE POLICY inner_circle_insert_own ON public.inner_circle_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Students may withdraw. They may not approve themselves, so status is pinned
-- to the two values they are allowed to move between.
DROP POLICY IF EXISTS inner_circle_update_own ON public.inner_circle_applications
;
CREATE POLICY inner_circle_update_own ON public.inner_circle_applications
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'withdrawn'));

-- anon gets nothing. Column privileges are the pattern here, not RLS alone —
-- see 20260903_users_column_privileges.sql for why.
REVOKE ALL ON public.inner_circle_applications FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.inner_circle_applications TO authenticated;

COMMENT ON TABLE public.inner_circle_applications IS
  'Applications to the Inner Circle. Membership itself is users.is_elite, flipped by an admin on approval.';
