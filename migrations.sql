-- Task 3: Trust-Based Flow
ALTER TABLE public.gigs 
  ADD COLUMN IF NOT EXISTS trust_based BOOLEAN DEFAULT FALSE;

-- Task 4: Public student profile
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS year_of_study INT,
  ADD COLUMN IF NOT EXISTS branch TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

CREATE INDEX IF NOT EXISTS users_username_idx ON public.users(username);

-- Task 5: Company onboarding
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS company_type TEXT 
    CHECK (company_type IN ('startup', 'agency', 'enterprise', 'ngo', 'other')),
  ADD COLUMN IF NOT EXISTS free_credits INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.gigs 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='companies' 
    AND policyname='Company owners manage own record'
  ) THEN
    CREATE POLICY "Company owners manage own record"
      ON public.companies FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='companies' 
    AND policyname='Anyone can view active companies'
  ) THEN
    CREATE POLICY "Anyone can view active companies"
      ON public.companies FOR SELECT TO anon, authenticated
      USING (is_active = true);
  END IF;
END $$;
