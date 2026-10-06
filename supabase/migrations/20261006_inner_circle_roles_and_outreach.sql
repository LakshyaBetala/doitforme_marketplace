-- The Inner Circle has two roles, and outreach needs somewhere to keep its work.
--
-- 20261005_inner_circle.sql gave the tier an application trail. It assumed one
-- kind of member. There are two, and they do unrelated jobs:
--
--   TECH      — delivers the work. Takes company briefs, builds, ships.
--   OUTREACH  — finds the companies in the first place. Pipeline work.
--
-- The distinction has to exist in the data because it decides what a member is
-- shown and what they are allowed to read. An outreach member has no business
-- in a delivery queue, and a tech member has no business in a lead list holding
-- other people's contact details.
--
-- WHAT THIS DELIBERATELY DOES NOT ADD: a workflow table for TECH. The delivery
-- pipeline is already modelled — gigs.status, gigs.payment_status,
-- gigs.managed_status, escrow, payout_queue — and CLAUDE.md records that
-- managed_status being a second state machine parallel to status is already a
-- thing that has to be manually kept in sync. A third would be strictly worse.
-- The tech workflow is therefore DERIVED from the gig row at read time (see
-- lib/innerCircle.ts), not stored. Outreach gets a table because its pipeline
-- genuinely has no existing home.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Which role an application is for, and which role a member holds.
-- ---------------------------------------------------------------------------

ALTER TABLE public.inner_circle_applications
  ADD COLUMN IF NOT EXISTS role text;

-- Backfill before the constraint: rows written by the first version of the
-- apply form predate the choice, and TECH is what that form described.
UPDATE public.inner_circle_applications SET role = 'TECH' WHERE role IS NULL;

ALTER TABLE public.inner_circle_applications
  ALTER COLUMN role SET DEFAULT 'TECH';

DO $$
BEGIN
  ALTER TABLE public.inner_circle_applications
    ADD CONSTRAINT inner_circle_role_known CHECK (role IN ('TECH', 'OUTREACH'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Membership itself stays on users.is_elite — that is what the managed
-- assignment desk already sorts by, and splitting it would break that. The role
-- sits beside it rather than replacing it.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS inner_circle_role text;

DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_inner_circle_role_known
      CHECK (inner_circle_role IS NULL OR inner_circle_role IN ('TECH', 'OUTREACH'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.users.inner_circle_role IS
  'TECH or OUTREACH for Inner Circle members. NULL for everyone else. Set by an admin on approval, alongside is_elite.';

-- The one-open-application index has to key on the role too, or asking to join
-- as OUTREACH would be blocked by a pending TECH application and vice versa.
DROP INDEX IF EXISTS public.inner_circle_one_open_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS inner_circle_one_open_per_user_role
  ON public.inner_circle_applications (user_id, role)
  WHERE status = 'pending';

-- A helper, so every outreach policy below is one call rather than a repeated
-- subquery that can drift. SECURITY DEFINER because an outreach member cannot
-- necessarily read their own users row column-by-column, and STABLE so the
-- planner calls it once per statement.
CREATE OR REPLACE FUNCTION public.is_outreach()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.is_elite IS TRUE
      AND u.inner_circle_role = 'OUTREACH'
  );
$$;

-- Postgres grants EXECUTE on a new function to PUBLIC, and anon/authenticated
-- inherit it from there — so revoking "FROM anon" would remove a grant they
-- never separately held. Take it from PUBLIC. See
-- 20260902_revoke_rpc_from_public.sql for the incident this encodes.
REVOKE ALL ON FUNCTION public.is_outreach() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_outreach() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. The outreach CRM.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.outreach_leads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who is working it. An unassigned lead is the shared pool.
  owner_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,

  company_name  text NOT NULL,
  website       text,
  contact_name  text,
  contact_email text,
  contact_phone text,
  -- Where it came from: 'inbound', 'linkedin', 'campus', 'referral', 'cold'…
  -- Free text on purpose; a CHECK here would be a migration every time someone
  -- tries a new channel, which is the opposite of what outreach needs.
  source        text,

  -- new -> contacted -> replied -> meeting -> won | lost
  -- 'lost' is terminal but not deleted: the reason is the only thing that makes
  -- the next attempt at the same company smarter.
  stage         text NOT NULL DEFAULT 'new'
                CHECK (stage IN ('new', 'contacted', 'replied', 'meeting', 'won', 'lost')),
  lost_reason   text,

  -- Rough budget in rupees, for ordering the pipeline. Nullable because an
  -- honest unknown beats a number someone invented to fill the field.
  value_estimate integer,

  notes         text,
  -- The single most useful column in any CRM: when this needs touching again.
  -- Everything overdue is the day's work.
  next_action_at timestamptz,
  last_touch_at  timestamptz,

  -- Set when a lead becomes a real company account, so the pipeline can be
  -- measured against actual posted work rather than self-reported wins.
  converted_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,

  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One row per company, case- and whitespace-insensitively. Two outreach members
-- cold-emailing the same company in the same week is the failure mode that
-- makes a campus team look amateur to the exact people it is courting.
CREATE UNIQUE INDEX IF NOT EXISTS outreach_leads_one_per_company
  ON public.outreach_leads (lower(btrim(company_name)));

CREATE INDEX IF NOT EXISTS outreach_leads_stage_idx
  ON public.outreach_leads (stage, next_action_at NULLS LAST);
CREATE INDEX IF NOT EXISTS outreach_leads_owner_idx
  ON public.outreach_leads (owner_id, stage);

-- A touch log, so "we spoke to them" is a fact with a date on it rather than a
-- paragraph in a notes field that the next person has to parse.
CREATE TABLE IF NOT EXISTS public.outreach_touches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid NOT NULL REFERENCES public.outreach_leads(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  kind       text NOT NULL DEFAULT 'note'
             CHECK (kind IN ('note', 'email', 'call', 'meeting', 'stage_change')),
  body       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_touches_lead_idx
  ON public.outreach_touches (lead_id, created_at DESC);

-- Keep updated_at honest without every caller having to remember it.
CREATE OR REPLACE FUNCTION public.touch_outreach_lead()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS outreach_leads_touch ON public.outreach_leads;
CREATE TRIGGER outreach_leads_touch
  BEFORE UPDATE ON public.outreach_leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_outreach_lead();

-- ---------------------------------------------------------------------------
-- 3. RLS. These tables hold third-party contact details, so the default is no.
-- ---------------------------------------------------------------------------

ALTER TABLE public.outreach_leads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_touches ENABLE ROW LEVEL SECURITY;

-- The whole outreach team can see the pipeline — a CRM where you cannot see
-- that a teammate already contacted someone is worse than no CRM. But only the
-- team: not every student, and never anon.
DROP POLICY IF EXISTS outreach_leads_read ON public.outreach_leads;
CREATE POLICY outreach_leads_read ON public.outreach_leads
  FOR SELECT USING (public.is_outreach() OR public.is_admin());

DROP POLICY IF EXISTS outreach_leads_insert ON public.outreach_leads;
CREATE POLICY outreach_leads_insert ON public.outreach_leads
  FOR INSERT WITH CHECK (public.is_outreach() OR public.is_admin());

-- Edits are restricted to the owner (or an admin), and claiming an unowned lead
-- is allowed. Anyone being able to rewrite anyone's pipeline is how CRM data
-- stops being trusted.
DROP POLICY IF EXISTS outreach_leads_update ON public.outreach_leads;
CREATE POLICY outreach_leads_update ON public.outreach_leads
  FOR UPDATE USING (
    public.is_admin()
    OR (public.is_outreach() AND (owner_id = auth.uid() OR owner_id IS NULL))
  )
  WITH CHECK (public.is_outreach() OR public.is_admin());

-- Deletes are admin-only. A lost lead is set to 'lost' with a reason; losing
-- the row loses the reason.
DROP POLICY IF EXISTS outreach_leads_delete ON public.outreach_leads;
CREATE POLICY outreach_leads_delete ON public.outreach_leads
  FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS outreach_touches_read ON public.outreach_touches;
CREATE POLICY outreach_touches_read ON public.outreach_touches
  FOR SELECT USING (public.is_outreach() OR public.is_admin());

DROP POLICY IF EXISTS outreach_touches_insert ON public.outreach_touches;
CREATE POLICY outreach_touches_insert ON public.outreach_touches
  FOR INSERT WITH CHECK (
    (public.is_outreach() OR public.is_admin()) AND author_id = auth.uid()
  );

-- A touch is a log entry. It is not editable, which is the point of a log.
DROP POLICY IF EXISTS outreach_touches_delete ON public.outreach_touches;
CREATE POLICY outreach_touches_delete ON public.outreach_touches
  FOR DELETE USING (public.is_admin());

-- RLS is row-level and cannot say "this row is visible but this column is not",
-- so the grant is the other half. anon gets nothing at all here: these rows are
-- other people's names, emails and phone numbers.
REVOKE ALL ON public.outreach_leads   FROM anon;
REVOKE ALL ON public.outreach_touches FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.outreach_leads   TO authenticated;
GRANT SELECT, INSERT          ON public.outreach_touches TO authenticated;

COMMENT ON TABLE public.outreach_leads IS
  'Outreach CRM pipeline. Readable by Inner Circle OUTREACH members and admins only — holds third-party contact details.';
COMMENT ON TABLE public.outreach_touches IS
  'Append-only contact log per lead. Not editable by design; a log you can rewrite is not a log.';
