-- The agency program: accepted terms, outreach commissions, and paid probation.
--
-- WHY. DoItForMe had supply and no demand — 1,254 gigs posted, 12 ever
-- assigned, because there was never a buyer. Almmatix becomes the buyer: it
-- sells software services to clients and hires students through this platform
-- to build them. That needs three things the schema cannot currently express:
--
--   1. WHO AGREED TO WHAT, AND WHEN. Under Indian copyright law the author owns
--      the work unless it is assigned in writing. Without a dated acceptance of
--      a specific version of the terms, a client paying 1.5L is buying software
--      whose copyright sits with a student who signed nothing, and we cannot
--      give the IP warranty a serious client asks for. This is the clause that
--      voids a deal after the invoice is paid.
--
--   2. WHAT AN OUTREACH MEMBER IS OWED. The attribution chain that looked
--      obvious — outreach_leads.converted_company_id -> companies ->
--      gigs.company_id — does not work for this model, because the END CLIENT
--      NEVER TRANSACTS ON THE PLATFORM. Almmatix sells to them off-platform;
--      on DoItForMe the only poster is Almmatix, so every gig's company_id is
--      Almmatix and the chain cannot tell which lead produced which project.
--      The commission is its own gig, and the link from lead to that gig has to
--      be recorded explicitly or "what am I owed" is not computable at all.
--
--   3. WHETHER SOMEONE ACTUALLY DELIVERS, TWICE. You cannot screen for
--      consistency — a test measures ability, consistency is a time series. So
--      the filter is two paid rounds with the second one's timing unannounced,
--      and the rounds need somewhere to live.
--
-- WHAT THIS DELIBERATELY DOES NOT ADD: a status column on either new table.
-- A probation task's state is the state of its gig (assigned, funded,
-- delivered, approved) and a commission tranche's state is the state of its
-- gig. CLAUDE.md records what happens when a second state machine has to be
-- hand-synced with the first: the one the UI reads goes stale. So both tables
-- store facts — which gig, how much, when it was due, what it scored — and
-- everything else is derived at read time, the same way lib/innerCircle.ts
-- derives the delivery workflow.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1. Accepted terms.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_term_acceptances (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- The exact version of lib/programTerms.ts the person read. Stored rather
  -- than referenced so that editing the file can never silently change what
  -- somebody is recorded as having agreed to; a bumped version re-asks them.
  version     text NOT NULL,

  -- TECH or OUTREACH: the clause set differs, so which one they saw is part of
  -- what they accepted. Not an FK to inner_circle_roles because terms are
  -- accepted BEFORE an application is decided, and a role may be renamed later
  -- without changing the historical fact of what was shown.
  role        text NOT NULL CHECK (role IN ('TECH', 'OUTREACH')),

  -- Evidence, for the one conversation where it matters. Nullable because a
  -- proxy can withhold both and an acceptance is still an acceptance.
  ip          text,
  user_agent  text,

  accepted_at timestamptz NOT NULL DEFAULT now()
);

-- One row per person per version per role. Re-accepting the same version is a
-- no-op rather than a duplicate, so the API route can upsert without first
-- reading.
CREATE UNIQUE INDEX IF NOT EXISTS program_terms_one_per_version
  ON public.program_term_acceptances (user_id, role, version);

CREATE INDEX IF NOT EXISTS program_terms_user_idx
  ON public.program_term_acceptances (user_id, accepted_at DESC);

-- ---------------------------------------------------------------------------
-- 2. What a sold deal was, and what the finder is owed for it.
-- ---------------------------------------------------------------------------

-- Which catalogue service was sold, and what it actually sold for. value_estimate
-- already exists and stays what it is: a guess used to order the pipeline.
-- won_value is the signed number, and commission is computed from it.
ALTER TABLE public.outreach_leads
  ADD COLUMN IF NOT EXISTS service_key text,
  ADD COLUMN IF NOT EXISTS won_value   integer;

COMMENT ON COLUMN public.outreach_leads.service_key IS
  'Catalogue key from lib/agency.ts SERVICES (WEB_PLATFORM, AI_ASSISTANT, ...). Free text, not a FK: the catalogue is code, and a price list should not need a migration to change.';
COMMENT ON COLUMN public.outreach_leads.won_value IS
  'What the deal actually closed at, in rupees. value_estimate is the pipeline guess; this is the number commission is computed from.';

-- A won lead must have a value, or the commission it earns is unknowable.
-- Written with coalesce because stage is NOT NULL but won_value is not, and a
-- CHECK that evaluates to NULL PASSES — a bare comparison would let a won lead
-- with no value walk straight through the constraint meant to stop it.
DO $$
BEGIN
  ALTER TABLE public.outreach_leads
    ADD CONSTRAINT outreach_won_has_value
      CHECK (stage <> 'won' OR coalesce(won_value, 0) > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  -- Existing rows may already violate it; report rather than fail the whole file.
  WHEN check_violation THEN
    RAISE WARNING 'outreach_won_has_value not added: existing won rows have no won_value. Backfill then re-run.';
END $$;

CREATE TABLE IF NOT EXISTS public.outreach_commissions (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id   uuid NOT NULL REFERENCES public.outreach_leads(id) ON DELETE CASCADE,

  -- Who gets paid. Denormalised from the lead on purpose: ownership of a lead
  -- can change hands after a deal closes, and that must not move the money
  -- somebody has already earned.
  earner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- 40% when the client's first payment clears, 60% on client acceptance.
  -- Splitting it is what makes the finder care whether the client is any good:
  -- a single payment on signature pays identically for a dream client and a
  -- nightmare one.
  tranche   text NOT NULL CHECK (tranche IN ('first', 'final')),

  -- Gross rupees, before the platform fee. The fee is deducted on payout like
  -- any other gig, so storing net here would be a second, drifting opinion
  -- about a number lib/fees.ts already owns.
  amount    integer NOT NULL CHECK (amount > 0),

  -- The gig that pays it. NULL means earned but not yet raised, which is a real
  -- and visible state: it is exactly what the member needs to see.
  gig_id    uuid REFERENCES public.gigs(id) ON DELETE SET NULL,

  note       text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One tranche of each kind per lead. Paying the same 40% twice is the mistake
-- a unique index is for.
CREATE UNIQUE INDEX IF NOT EXISTS outreach_commissions_one_per_tranche
  ON public.outreach_commissions (lead_id, tranche);

CREATE INDEX IF NOT EXISTS outreach_commissions_earner_idx
  ON public.outreach_commissions (earner_id, created_at DESC);

COMMENT ON TABLE public.outreach_commissions IS
  'What an outreach member is owed per closed deal, in two tranches. gig_id links to the gig that actually pays it; the payment state is that gig''s state, not a column here.';

-- ---------------------------------------------------------------------------
-- 3. Paid probation.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.program_probation_tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.inner_circle_applications(id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role           text NOT NULL CHECK (role IN ('TECH', 'OUTREACH')),

  -- 1 or 2. Round 2 is the actual filter: round 1 shows whether someone CAN do
  -- the work, round 2 shows whether they do it again, and its timing is
  -- deliberately not announced.
  round          smallint NOT NULL CHECK (round IN (1, 2)),

  -- The real gig this was posted as, so probation runs the genuine escrow,
  -- delivery and request-changes flow rather than a parallel imitation. An
  -- applicant's first experience of being paid should be the real thing.
  gig_id         uuid REFERENCES public.gigs(id) ON DELETE SET NULL,

  due_at         timestamptz,
  sent_at        timestamptz NOT NULL DEFAULT now(),

  -- SCORECARD marks from lib/agency.ts, e.g. {"on_time": true, "craft": false}.
  -- The score is kept alongside rather than only derived because the weights
  -- may be retuned, and a historical decision must stay explicable under the
  -- weights it was actually made with.
  marks          jsonb,
  score          smallint CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  reviewer_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  notes          text
);

CREATE UNIQUE INDEX IF NOT EXISTS probation_one_per_round
  ON public.program_probation_tasks (user_id, role, round);

CREATE INDEX IF NOT EXISTS probation_pending_idx
  ON public.program_probation_tasks (reviewed_at NULLS FIRST, due_at);

-- A reviewed task has a score, and a scored task has been reviewed. Half-filled
-- reviews are how a queue silently stops being trustworthy.
DO $$
BEGIN
  ALTER TABLE public.program_probation_tasks
    ADD CONSTRAINT probation_review_is_complete
      CHECK ((reviewed_at IS NULL) = (score IS NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON TABLE public.program_probation_tasks IS
  'Two paid rounds per applicant. Round 2 decides, because consistency can only be observed, never screened for. Task state is its gig''s state; only the facts and the score live here.';

-- ---------------------------------------------------------------------------
-- 4. RLS.
-- ---------------------------------------------------------------------------

ALTER TABLE public.program_term_acceptances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_commissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_probation_tasks   ENABLE ROW LEVEL SECURITY;

-- Terms: you can see what you agreed to. You cannot alter or withdraw it, which
-- is the entire point of keeping the record.
DROP POLICY IF EXISTS program_terms_read ON public.program_term_acceptances;
CREATE POLICY program_terms_read ON public.program_term_acceptances
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS program_terms_insert ON public.program_term_acceptances;
CREATE POLICY program_terms_insert ON public.program_term_acceptances
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Commissions: you see your own, admins see all. An outreach member seeing a
-- teammate's earnings turns a pipeline into a league table nobody asked for,
-- and the shared-pipeline argument that justifies outreach_leads being
-- team-readable does not apply to anybody's pay.
DROP POLICY IF EXISTS outreach_commissions_read ON public.outreach_commissions;
CREATE POLICY outreach_commissions_read ON public.outreach_commissions
  FOR SELECT USING (earner_id = auth.uid() OR public.is_admin());

-- Writes are admin-only. A commission is a statement about money owed; letting
-- the person owed it write the row is not a pipeline, it is an invoice generator.
DROP POLICY IF EXISTS outreach_commissions_write ON public.outreach_commissions;
CREATE POLICY outreach_commissions_write ON public.outreach_commissions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Probation: you see your own tasks and your own score. Silence is the failure
-- mode this product has already been bitten by on the applications side, so the
-- applicant can see the score that decided it.
DROP POLICY IF EXISTS probation_read ON public.program_probation_tasks;
CREATE POLICY probation_read ON public.program_probation_tasks
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS probation_write ON public.program_probation_tasks;
CREATE POLICY probation_write ON public.program_probation_tasks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- RLS is row-level and cannot say "this row is visible but this column is not",
-- so the grant is the other half. anon gets nothing: these are signed
-- agreements, people's pay, and third-party deal values.
REVOKE ALL ON public.program_term_acceptances FROM anon;
REVOKE ALL ON public.outreach_commissions     FROM anon;
REVOKE ALL ON public.program_probation_tasks  FROM anon;

GRANT SELECT, INSERT ON public.program_term_acceptances TO authenticated;
GRANT SELECT          ON public.outreach_commissions    TO authenticated;
GRANT SELECT          ON public.program_probation_tasks TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Has this person accepted the current terms?
-- ---------------------------------------------------------------------------
--
-- A function rather than a column on users, because a cached boolean is exactly
-- what drifted when kyc_verified was a copy of kyc_status: the product read the
-- cache, the queue read the truth, and three people held a verified tick on an
-- application that had been refused. The authoritative answer is "is there a row
-- for this version", so that is what gets asked.

CREATE OR REPLACE FUNCTION public.has_accepted_terms(p_version text, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_term_acceptances a
    WHERE a.user_id = auth.uid()
      AND a.version = p_version
      AND a.role    = p_role
  );
$$;

-- Postgres grants EXECUTE on every new function to PUBLIC, and Supabase ALSO
-- runs ALTER DEFAULT PRIVILEGES granting it to anon and authenticated DIRECTLY
-- — so revoking from PUBLIC alone leaves a direct grant the revoke never
-- touched, and the migration reads as complete while changing nothing. That is
-- how prune_notification_tables() stayed callable by anyone holding the anon
-- key. Take it from all three, then grant back explicitly.
REVOKE ALL ON FUNCTION public.has_accepted_terms(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_accepted_terms(text, text) TO authenticated, service_role;

-- Assert it, so a silent failure is a loud one.
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.has_accepted_terms(text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still EXECUTE has_accepted_terms — the revoke did not take';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.has_accepted_terms(text, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot EXECUTE has_accepted_terms — it is needed by the app';
  END IF;
END $$;
