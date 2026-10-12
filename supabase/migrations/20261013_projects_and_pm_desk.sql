-- A project: the thing a client bought, and the tasks that deliver it.
--
-- WHY. A 1,50,000 web platform is currently two or three unrelated gigs plus a
-- commission gig, and nothing joins them. So nobody can ask the questions that
-- running an agency consists of: is this project late, which task is blocking,
-- has the client accepted, has everyone been paid, was the care plan offered.
-- The PM is one human doing client contact, integration, QA and a second
-- developer's coding, and the failure mode of that job is not laziness — it is
-- losing track of the fourth project while firefighting the second.
--
-- A gig stays what it is: one person's paid task, with its own escrow. This adds
-- the layer above it.
--
-- NO STATUS COLUMN. CLAUDE.md records what happens when a second state machine
-- has to be hand-synced with the money: the one the UI reads goes stale. So
-- this table stores only FACTS — when the scope was signed, when the client
-- accepted, when it was handed over, when the care plan was offered — and
-- projectStage() in lib/projects.ts derives the PLAYBOOK stage from them plus
-- the state of the tasks' gigs. The same reason applicationStage() and
-- workflowFor() are derived.
--
-- THE ACCESS BOUNDARY IS THE POINT OF SPLITTING THE TABLES.
-- `projects` holds the client's identity and the deal value. `project_tasks`
-- holds what each builder is paid. The rule the whole program depends on is
-- that only the PM sees both: outreach sees the deal value of leads they found
-- (it is their commission base) and never a builder's fee; a builder sees their
-- own fee and never the deal value. Two tables with different policies is how
-- that becomes enforced rather than merely intended — hiding a column in the UI
-- is not access control.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. The project.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.projects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The client. Deliberately NOT a companies row: the end client never
  -- transacts on this platform — Almmatix sells to them off-platform and only
  -- pays students here — so forcing them into `companies` would create an
  -- account that can never log in and would break every assumption that a
  -- company row means a poster.
  client_name   text NOT NULL,
  contact_name  text,
  contact_email text,
  contact_phone text,

  -- Catalogue key from lib/agency.ts SERVICES. Free text, not an FK: the price
  -- list is code, and changing a price should not need a migration.
  service_key   text NOT NULL,

  -- What it actually sold for, which may be a founding-client price rather than
  -- list. Every fee is derived from this number, so it is the one that matters.
  deal_value    integer NOT NULL CHECK (deal_value > 0),
  is_founding   boolean NOT NULL DEFAULT false,

  -- Who found it, so the commission has something to hang off. NULL for inbound
  -- work, which earns nobody a commission and must not invent one.
  lead_id       uuid REFERENCES public.outreach_leads(id) ON DELETE SET NULL,

  -- The single point of contact. NOT NULL because a project without a named PM
  -- is the state in which a client's question has no owner.
  pm_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  starts_on     date,
  due_on        date,

  -- The scope, in the client's words, copied from the service's includes and
  -- excludes at quote time. Stored rather than read live from the catalogue
  -- because what was agreed must not change when the price list does.
  scope         text,
  exclusions    text,

  -- FACTS, not a stage. Each is the gate of one PLAYBOOK step.
  scope_signed_at   timestamptz,
  first_payment_at  timestamptz,
  kickoff_at        timestamptz,
  integrated_at     timestamptz,
  accepted_at       timestamptz,
  handed_over_at    timestamptz,
  care_offered_at   timestamptz,
  -- The answer is recorded even when it is no: an unasked question and a
  -- declined offer look identical otherwise, and only one of them is a mistake.
  care_answer       text CHECK (care_answer IS NULL OR care_answer IN ('yes', 'no', 'later')),

  cancelled_at   timestamptz,
  cancel_reason  text,

  created_by    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- The gates have an order, and a project that claims to have been accepted
-- before the scope was signed is a data-entry error, not a workflow. Written
-- with coalesce-free explicit NULL handling because a CHECK that evaluates to
-- NULL PASSES — comparing two nullable timestamps directly would let any row
-- with one NULL walk straight through.
DO $$
BEGIN
  ALTER TABLE public.projects
    ADD CONSTRAINT projects_gates_in_order CHECK (
      (scope_signed_at IS NULL OR first_payment_at IS NULL OR first_payment_at >= scope_signed_at)
      AND (accepted_at IS NULL OR scope_signed_at IS NOT NULL)
      AND (handed_over_at IS NULL OR accepted_at IS NOT NULL)
      AND (care_offered_at IS NULL OR handed_over_at IS NOT NULL)
      AND (care_answer IS NULL OR care_offered_at IS NOT NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN check_violation THEN
    RAISE WARNING 'projects_gates_in_order not added: existing rows violate it. Fix them then re-run.';
END $$;

CREATE INDEX IF NOT EXISTS projects_pm_idx ON public.projects (pm_id, due_on NULLS LAST);
CREATE INDEX IF NOT EXISTS projects_lead_idx ON public.projects (lead_id);
-- The PM desk's main query: everything not finished, oldest due first.
CREATE INDEX IF NOT EXISTS projects_open_idx
  ON public.projects (due_on NULLS LAST)
  WHERE handed_over_at IS NULL AND cancelled_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. The tasks that deliver it.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- DeliveryRole from lib/agency.ts. One row per role slot on the service.
  role        text NOT NULL,
  title       text,

  -- The real gig that pays it, so escrow, delivery, request-changes and payout
  -- are the genuine flows rather than a parallel imitation. NULL means the slot
  -- exists but has not been raised yet, which is a visible and useful state:
  -- it is exactly what "unstaffed" means on the PM desk.
  gig_id      uuid REFERENCES public.gigs(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES public.users(id) ON DELETE SET NULL,

  -- Gross, before the platform fee. Derived from the deal value by quoteFor()
  -- and then stored, so repricing the catalogue cannot retroactively change
  -- what somebody was promised.
  fee         integer CHECK (fee IS NULL OR fee >= 0),

  -- THE TASK'S OWN DEADLINE, which is not the escrow clock.
  -- gigs.auto_release_at is about when the client's money stops being held; it
  -- says nothing about when the work was due, and nothing in the product has
  -- ever timed a worker. This is the column the nudge and the late flag read.
  due_on      date,
  sequence    smallint NOT NULL DEFAULT 0,

  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- One gig pays one task. Pointing two tasks at the same gig would double-count
-- both the progress and the money.
CREATE UNIQUE INDEX IF NOT EXISTS project_tasks_one_per_gig
  ON public.project_tasks (gig_id)
  WHERE gig_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS project_tasks_project_idx
  ON public.project_tasks (project_id, sequence);
CREATE INDEX IF NOT EXISTS project_tasks_assignee_idx
  ON public.project_tasks (assignee_id, due_on NULLS LAST);
-- Driving the late-task nudge from the task's own age, ordered, so no subset
-- can be starved the way an unordered LIMIT starved 316 gigs.
CREATE INDEX IF NOT EXISTS project_tasks_due_idx
  ON public.project_tasks (due_on NULLS LAST)
  WHERE gig_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS projects_touch ON public.projects;
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS project_tasks_touch ON public.project_tasks;
CREATE TRIGGER project_tasks_touch BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Am I the PM on this project?
-- ---------------------------------------------------------------------------
--
-- A function rather than a repeated subquery, so the policies below cannot
-- drift apart. SECURITY DEFINER because a PM cannot necessarily read the
-- projects row they are being authorized against — which is the whole point of
-- asking.

CREATE OR REPLACE FUNCTION public.is_project_pm(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id AND p.pm_id = auth.uid()
  );
$$;

-- Postgres grants EXECUTE on every new function to PUBLIC, and Supabase ALSO
-- grants it to anon and authenticated DIRECTLY via ALTER DEFAULT PRIVILEGES —
-- so revoking from PUBLIC alone leaves a direct grant untouched and the
-- migration reads as complete while changing nothing. Take it from all three.
REVOKE ALL ON FUNCTION public.is_project_pm(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_pm(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS — this is where the compartmentalisation is actually enforced.
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

-- A project is readable by its PM, by an admin, and by the outreach member who
-- found it. The last one matters: an outreach member whose client asks "how is
-- it going" currently has to ask the PM, and a salesperson who cannot answer
-- that question stops selling. They see the deal value — it is their own
-- commission base — and the client they personally found.
DROP POLICY IF EXISTS projects_read ON public.projects;
CREATE POLICY projects_read ON public.projects
  FOR SELECT USING (
    pm_id = auth.uid()
    OR public.is_admin()
    OR (
      public.is_outreach()
      AND lead_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.outreach_leads l
        WHERE l.id = projects.lead_id AND l.owner_id = auth.uid()
      )
    )
  );

-- Only an admin creates a project. The deal value and the client are the two
-- most consequential fields in the system, and a PM inventing a project is a
-- PM inventing a commission liability.
DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects
  FOR INSERT WITH CHECK (public.is_admin());

-- The PM runs their own project: dates, scope, and ticking the gates.
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects
  FOR UPDATE USING (pm_id = auth.uid() OR public.is_admin())
  WITH CHECK (pm_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects
  FOR DELETE USING (public.is_admin());

-- A TASK is readable by the person doing it, the PM of its project, and admins.
-- NOT by outreach: this table holds what each builder is paid, and an outreach
-- member who can see both the deal value and the build cost is holding the
-- entire arbitrage. That is the one combination reserved for the PM.
DROP POLICY IF EXISTS project_tasks_read ON public.project_tasks;
CREATE POLICY project_tasks_read ON public.project_tasks
  FOR SELECT USING (
    assignee_id = auth.uid()
    OR public.is_admin()
    OR public.is_project_pm(project_id)
  );

DROP POLICY IF EXISTS project_tasks_write ON public.project_tasks;
CREATE POLICY project_tasks_write ON public.project_tasks
  FOR ALL USING (public.is_admin() OR public.is_project_pm(project_id))
  WITH CHECK (public.is_admin() OR public.is_project_pm(project_id));

-- RLS is row-level and cannot say "this row is visible but this column is not",
-- so the grant is the other half. anon gets nothing at all: these are other
-- companies' contact details, deal values and people's pay.
REVOKE ALL ON public.projects      FROM anon;
REVOKE ALL ON public.project_tasks FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.projects      TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.project_tasks TO authenticated;

COMMENT ON TABLE public.projects IS
  'What a client bought. Holds the client identity and the deal value; stores facts not a stage, so lib/projects.ts can derive the PLAYBOOK stage. Readable by its PM, admins, and the outreach member who found it.';
COMMENT ON TABLE public.project_tasks IS
  'One role slot on a project, paid by its own gig. Holds builder fees, so deliberately NOT readable by outreach — only the PM sees deal value and build cost together. due_on is the WORKER deadline, which gigs.auto_release_at is not.';
