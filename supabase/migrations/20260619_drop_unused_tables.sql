-- Cleanup: drop empty, unreferenced, off-strategy tables (applied 2026-06-19).
--
-- All four had 0 rows, no application-code references, and only outgoing FKs:
--   vasooli_bounties  -- off-strategy debt-collection feature
--   deliveries        -- superseded by gigs.delivery_link / delivery_files + messages
--   payout_methods    -- unused; UPI lives on users.upi_id, payouts are manual
--   chat_blocked_logs -- moderation audit log that was never wired to any writer

drop table if exists public.vasooli_bounties cascade;
drop table if exists public.deliveries cascade;
drop table if exists public.payout_methods cascade;
drop table if exists public.chat_blocked_logs cascade;
