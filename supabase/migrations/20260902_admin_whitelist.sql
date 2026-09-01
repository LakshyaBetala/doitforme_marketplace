-- Admin whitelist: add Mouriyan Gandhi, and stop repeating the list.
--
-- The TypeScript side now lives in lib/admins.ts. SQL cannot import it, so
-- public.is_admin() is the database's single copy — keep the two in step.
--
-- Two problems this fixes beyond the new address:
--
--   1. payout_queue's RLS policies carried their OWN hardcoded list
--      ('lakshya.betala@gmail.com', 'betala911@gmail.com') which had already
--      drifted: doitforme.in@gmail.com is an admin everywhere else but could
--      not select from payout_queue. The API routes use the service role, so
--      this stayed invisible — until someone queried the table as themselves.
--
--   2. is_admin() compared the JWT email case-sensitively. Supabase stores the
--      casing the user typed at signup, so an admin who registered as
--      "Betala911@gmail.com" silently failed every RLS check.
--
-- Safe to run more than once.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (
    lower(auth.jwt() ->> 'email') IN (
      'betala911@gmail.com',
      'doitforme.in@gmail.com',
      'gandhimouriyan1234@gmail.com'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Route payout_queue through is_admin() so there is one list to maintain.
DROP POLICY IF EXISTS "Admins can view all payouts" ON public.payout_queue;
CREATE POLICY "Admins can view all payouts"
    ON public.payout_queue FOR SELECT
    USING (public.is_admin() OR auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Admins can update payouts" ON public.payout_queue;
CREATE POLICY "Admins can update payouts"
    ON public.payout_queue FOR UPDATE
    USING (public.is_admin() OR auth.jwt() ->> 'role' = 'service_role');

COMMIT;
