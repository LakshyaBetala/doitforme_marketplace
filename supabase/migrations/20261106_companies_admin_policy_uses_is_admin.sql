-- The companies admin policy was a third copy of the admin whitelist, and it had
-- drifted.
--
--   "Allow admins to manage companies"  FOR ALL
--     USING ((auth.jwt() ->> 'email') = ANY (ARRAY['betala911@gmail.com',
--                                                  'doitforme.in@gmail.com']))
--
-- CLAUDE.md is explicit that the whitelist lives in exactly two places,
-- lib/admins.ts and public.is_admin(), because "adding a person meant editing
-- ten places, and forgetting one produced ... an admin who can open a tab but
-- gets a 403 from the endpoint behind it". This literal missed the third admin,
-- gandhimouriyan1234@gmail.com, who IS in is_admin() and lib/admins.ts: the
-- admin desk showed him company clearance, and the database refused his writes.
-- It also compared case-sensitively, which is_admin() deliberately does not.
--
-- Same intent, now through the one definition. Found by auditing pg_policies
-- for literal email lists rather than by reading migrations.

DROP POLICY IF EXISTS "Allow admins to manage companies" ON public.companies;
CREATE POLICY "Allow admins to manage companies" ON public.companies
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Assert it, so the file fails loudly instead of reading as done while
-- changing nothing (the 20261006 pattern).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'companies'
       AND policyname = 'Allow admins to manage companies'
       AND (qual ILIKE '%@gmail.com%' OR coalesce(with_check, '') ILIKE '%@gmail.com%')
  ) THEN
    RAISE EXCEPTION 'companies admin policy still carries a literal email list';
  END IF;
END $$;
