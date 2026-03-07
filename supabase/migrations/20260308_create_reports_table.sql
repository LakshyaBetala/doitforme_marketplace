CREATE TABLE IF NOT EXISTS public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type = ANY (ARRAY['gig'::text, 'user'::text])),
  reason text NOT NULL,
  details text,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id)
);

-- RLS policies
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Admins can view all reports (assuming admins bypass RLS or have a specific role)
-- For now, users can only insert their own reports
CREATE POLICY "Users can insert their own reports" ON public.reports
    FOR INSERT 
    WITH CHECK (auth.uid() = reporter_id);

-- Optional: users can view the status of their own reports
CREATE POLICY "Users can view their own reports" ON public.reports
    FOR SELECT
    USING (auth.uid() = reporter_id);
