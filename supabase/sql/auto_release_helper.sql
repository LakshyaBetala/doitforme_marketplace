-- Helper SQL for Auto-Release cron

-- Index to speed up queries that filter by delivered_at
CREATE INDEX IF NOT EXISTS idx_gigs_delivered_at ON gigs (delivered_at);

-- Optional: RLS policy exception for a cron/service role (service role bypasses RLS by default)
-- If you use a less-privileged role for this endpoint, you may create a policy like below.
-- Replace 'service_role' with the appropriate role name if needed.
--
-- Example (only run if you manage RLS and roles):
-- CREATE POLICY auto_release_cron_policy ON gigs
--   FOR SELECT
--   USING (true);

-- Note: The Vercel cron will call the server route which uses the Supabase SERVICE_ROLE_KEY,
-- so the service role already bypasses RLS. This helper only creates an index.
