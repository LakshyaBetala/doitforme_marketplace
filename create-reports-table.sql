-- Create the reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL, -- Flexible ID for either a user or a gig
    target_type TEXT NOT NULL CHECK (target_type IN ('gig', 'user')),
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own reports
CREATE POLICY "Users can insert their own reports"
ON public.reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

-- Select policy: users can see their own reports
CREATE POLICY "Users can view their own reports"
ON public.reports FOR SELECT 
TO authenticated 
USING (auth.uid() = reporter_id);

-- Optional: Create an admin policy based on your admin flags.
-- Replace user_metadata->>'role' = 'admin' with your actual admin logic if applicable.
-- CREATE POLICY "Admins can view all reports" ON public.reports FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') IN ('your-admin-email@example.com'));

-- Create an index to help with the rate-limiting query
CREATE INDEX idx_reports_rate_limit ON public.reports (reporter_id, created_at);
