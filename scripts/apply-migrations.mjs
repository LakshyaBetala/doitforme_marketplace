// Apply SQL migrations directly to the live database.
//
// PostgREST cannot run DDL and the service-role key does not help, so for a
// long time the only way to apply a migration was to paste it into the Supabase
// SQL editor by hand. That is exactly why supabase/migrations/ drifted out of
// step with the real schema — 20260322 declared a UNIQUE that the database
// never got, and settlement failed silently for months as a result.
//
// Needs DATABASE_URL (Supabase → Settings → Database → Connection string).
// It lives in .env.local, which is gitignored, and is used by nothing at
// runtime — only by this script.
//
//   node scripts/apply-migrations.mjs                    # list pending files
//   node scripts/apply-migrations.mjs <file> [<file>...] # apply those files
//
// Each file is expected to be idempotent and to manage its own transaction.
import "dotenv/config";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

config({ path: ".env.local" });

const URL_ = process.env.DATABASE_URL;
if (!URL_) {
  console.error("DATABASE_URL is not set. Supabase → Settings → Database → Connection string (URI).");
  process.exit(1);
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/apply-migrations.mjs <migration.sql> [...]");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: URL_,
  // Supabase terminates TLS with its own CA; verifying it needs the cert bundle
  // and buys nothing here since the host is pinned in the connection string.
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  const { rows: who } = await client.query(
    "select current_database() db, current_user usr, version() v"
  );
  console.log(`\nConnected: ${who[0].db} as ${who[0].usr}`);
  console.log(`${who[0].v.split(",")[0]}\n`);

  let failed = 0;
  for (const f of files) {
    const p = path.resolve(f);
    const sql = readFileSync(p, "utf8");
    const name = path.basename(p);
    process.stdout.write(`  ${name} ... `);
    try {
      await client.query(sql);
      console.log("applied");
    } catch (e) {
      failed++;
      console.log("FAILED");
      console.log(`      ${e.code || ""} ${e.message}`);
      if (e.detail) console.log(`      detail: ${e.detail}`);
      // A file that manages its own transaction may have left one open and
      // aborted; clear it so the remaining files still get a chance.
      try { await client.query("rollback"); } catch {}
    }
  }

  await client.end();
  console.log(`\n  ${files.length - failed}/${files.length} applied\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("\nconnection failed:", e.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
