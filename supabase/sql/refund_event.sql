-- Helper SQL for refund event logging

-- Index to speed queries by gig status or escrow status
CREATE INDEX IF NOT EXISTS idx_gigs_status ON gigs (status);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow (status);

-- Template insert for refund events
-- Example usage:
-- INSERT INTO escrow_events (gig_id, worker_id, poster_id, amount, platform_fee, type)
-- VALUES ('<gig_uuid>', '<worker_uuid>', '<poster_uuid>', 90.00, 10.00, 'REFUND');
