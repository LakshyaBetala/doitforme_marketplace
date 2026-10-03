// Prune `notifications` over a direct Postgres connection, in bounded batches.
//
//   node scripts/prune-notifications-sql.mjs            # report only
//   node scripts/prune-notifications-sql.mjs --apply
//
// WHY NOT POSTGREST
//
// scripts/prune-usage.mjs does this over the REST API, which is fine for
// gig_alerts_sent (deletable by gig_id, ~1,100 rows a time) but hopeless here:
// notifications has a uuid primary key, PostgREST puts the id list in the query
// string, and a thousand uuids makes a ~37 KB URL the server rejects outright.
// Dropping to 200 per request means ~5,000 round trips for a million rows.
//
// Over a real connection it is one statement per batch. The batch exists only
// to stay under the statement timeout — a single DELETE across a million rows
// times out and rolls back, reclaiming nothing.
//
// `ctid` is Postgres's physical row address. Selecting a bounded set of them
// and deleting exactly those avoids both a full-table scan per batch and any
// dependence on an index over created_at.

import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const APPLY = process.argv.includes("--apply");
const KEEP_DAYS = 14;
const BATCH = 20000;

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});
await c.connect();

const cutoff = new Date(Date.now() - KEEP_DAYS * 86400e3).toISOString();

const total = (await c.query("select count(*)::bigint as n from notifications")).rows[0].n;
const old = (await c.query("select count(*)::bigint as n from notifications where created_at < $1", [cutoff])).rows[0].n;
console.log(`\nnotifications: ${Number(total).toLocaleString()} rows, ${Number(old).toLocaleString()} older than ${KEEP_DAYS} days`);

if (!APPLY) {
  console.log("\nDry run — re-run with --apply.\n");
  await c.end();
  process.exit(0);
}

let removed = 0;
for (;;) {
  const r = await c.query(
    `delete from notifications
      where ctid = any (array(
        select ctid from notifications where created_at < $1 limit ${BATCH}
      ))`,
    [cutoff]
  );
  if (r.rowCount === 0) break;
  removed += r.rowCount;
  console.log(`  removed ${removed.toLocaleString()}…`);
}

const after = (await c.query("select count(*)::bigint as n from notifications")).rows[0].n;
console.log(`\nremoved ${removed.toLocaleString()} — notifications now ${Number(after).toLocaleString()} rows\n`);

// Reclaim the pages to the OS. Postgres keeps deleted rows as dead tuples until
// a VACUUM runs, so the free-tier disk reading does not drop until this does.
console.log("running VACUUM (this is what actually returns the space)…");
await c.query("vacuum (analyze) notifications");
await c.query("vacuum (analyze) gig_alerts_sent");
console.log("done.\n");

await c.end();
