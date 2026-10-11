-- Inner Circle interest, captured on the hold page.
--
-- The hold page already describes the Inner Circle on its one filled surface
-- and tells the reader "this list is where the invitations come from" — and
-- then gives them no way to put their hand up. So the panel makes a promise the
-- page cannot keep, and we learn nothing about who actually wants it.
--
-- Interest is NOT an application. The real flow — two roles, a practical, a
-- rubric — is deliberately still being designed, and the role registry in
-- Postgres (20261011_inner_circle_role_registry.sql) is the groundwork for it.
-- What this captures is "tell me when it opens, and here is the side I care
-- about", which is honest about where the product actually is and still gives
-- the 592 people on this list something to say yes to.
--
-- Stored in D1 beside the rest of the waitlist rather than in Postgres, because
-- these people do not have accounts yet. inner_circle_applications.user_id is a
-- foreign key to public.users, so there is nothing to attach an application to
-- until they finish signup — which is exactly the replay this table exists for.

ALTER TABLE waitlist ADD COLUMN inner_circle INTEGER NOT NULL DEFAULT 0;

-- 'TECH' | 'OUTREACH', matching inner_circle_roles.value in Postgres so the
-- replay is a straight mapping. Null means "interested, no preference" — which
-- is a real answer and should not be forced into one of the two.
ALTER TABLE waitlist ADD COLUMN inner_circle_role TEXT;

CREATE INDEX IF NOT EXISTS waitlist_inner_circle_idx
  ON waitlist (inner_circle) WHERE inner_circle = 1;
