-- Realtime was decoding every notification insert for an audience of nobody.
--
-- Supabase Realtime reads the WAL, converts each change to JSON, and evaluates
-- it against every live subscription. That work happens for any table in the
-- `supabase_realtime` publication whether or not a single client is listening.
--
-- pg_stat_statements, measured:
--
--   8,198,576 calls   59,761s   SELECT wal->>... as type, schema, table ...
--   4,000,767 calls   21,268s   (same decoder)
--     892,430 calls    5,298s   (same decoder)
--
-- Thirteen million calls and over sixteen hours of CPU, and it is the single
-- largest consumer in the database by both measures. It is also why Log
-- Ingestion sat at 157% of the free tier: every decode is a log line.
--
-- The publication carried five tables. The application subscribes to three, all
-- with server-side filters:
--
--   messages   RealtimeListener (receiver_id), /messages, /chat/[roomId]
--   gigs       RealtimeListener (poster_id, assigned_worker_id), /messages
--   users      /profile (id = own)
--
-- The other two have no subscriber anywhere in the codebase — verified by
-- grepping every `table: '...'` binding in app/ and components/:
--
--   notifications    was taking ~45,000 inserts a day before the fan-out cap,
--                    each one decoded and matched against every open socket,
--                    for a table no client has ever listened to.
--   applications     no subscriber either.
--
-- Removing a table from the publication does not drop it, change its data, or
-- affect ordinary queries. It only stops the WAL decoder doing work nobody
-- asked for. Adding one back is a single ALTER if a feature ever needs it.
--
-- Safe to run more than once.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.applications;
  END IF;
END $$;
