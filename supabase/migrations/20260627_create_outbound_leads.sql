-- Migration: 20260627_create_outbound_leads.sql
CREATE TABLE public.outbound_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    url TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL, -- 'upwork', 'linkedin'
    budget TEXT,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'scraped', -- 'scraped', 'pitched', 'approved', 'ignored'
    personalized_pitch TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexing for rapid queries on script execution
CREATE INDEX idx_leads_status ON public.outbound_leads(status);
CREATE INDEX idx_leads_url ON public.outbound_leads(url);

-- Enable RLS
ALTER TABLE public.outbound_leads ENABLE ROW LEVEL SECURITY;

-- Allow admins full access (service role key bypasses RLS automatically)
CREATE POLICY "Allow admin full access" ON public.outbound_leads 
    FOR ALL USING (is_admin());
