// One-off: move resumes behind a private bucket.
//
// Before: users.resume_url held a permanent PUBLIC url, rendered straight into
// an <a href>. Anyone who ever saw the link kept read access forever, and 13 of
// the files were sitting in `gig-images` — the bucket that serves public gig
// photos and therefore must stay public — because the API upload path named the
// wrong bucket.
//
// After: every resume lives in `resumes` under `<user id>/<file>`, and
// users.resume_url holds just that path. Reads go through /api/profile/resume,
// which checks the caller and mints a 5-minute signed url.
//
// Order matters. This script must run to completion BEFORE the bucket is
// flipped private (supabase/migrations/20260903_private_resume_bucket.sql), or
// links break for the window in between.
//
// Idempotent: rows already stored as a bare path are skipped.
//
//   node scripts/maintenance/migrate-resumes-private.mjs          # dry run
//   node scripts/maintenance/migrate-resumes-private.mjs --apply

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const PUBLIC_PREFIX = "/storage/v1/object/public/";

/** Splits a stored value into { bucket, path }, or null if it is already a path. */
function parse(stored) {
  if (!stored.startsWith("http")) return null; // already a bare path
  const i = stored.indexOf(PUBLIC_PREFIX);
  if (i === -1) return { bucket: null, path: null }; // foreign url, leave alone
  const rest = decodeURIComponent(stored.slice(i + PUBLIC_PREFIX.length).split("?")[0]);
  const slash = rest.indexOf("/");
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

const { data: users, error } = await db
  .from("users")
  .select("id, resume_url")
  .not("resume_url", "is", null);

if (error) {
  console.error("Could not read users:", error.message);
  process.exit(1);
}

console.log(`${users.length} rows with a resume_url.${APPLY ? "" : "  (dry run — pass --apply to write)"}\n`);

const counts = { alreadyPath: 0, normalized: 0, moved: 0, foreign: 0, failed: 0 };

for (const u of users) {
  const parsed = parse(u.resume_url);

  if (parsed === null) {
    counts.alreadyPath++;
    continue;
  }
  if (!parsed.bucket) {
    console.warn(`  ? ${u.id}  unrecognised url, left as-is: ${u.resume_url.slice(0, 70)}`);
    counts.foreign++;
    continue;
  }

  let { bucket, path } = parsed;

  // The 13 misfiled ones: gig-images/resumes/<file> -> resumes/<user id>/<file>
  if (bucket === "gig-images") {
    const file = path.split("/").pop();
    const dest = `${u.id}/${file}`;
    if (APPLY) {
      const { error: copyErr } = await db.storage
        .from("gig-images")
        .copy(path, dest, { destinationBucket: "resumes" });
      if (copyErr && !/exists/i.test(copyErr.message)) {
        console.error(`  ! ${u.id}  copy failed: ${copyErr.message}`);
        counts.failed++;
        continue;
      }
      // Only remove the public copy once the private one is confirmed there.
      const { error: rmErr } = await db.storage.from("gig-images").remove([path]);
      if (rmErr) console.warn(`  ~ ${u.id}  copied, but removing the public original failed: ${rmErr.message}`);
    }
    console.log(`  moved  gig-images/${path}  ->  resumes/${dest}`);
    path = dest;
    counts.moved++;
  } else {
    counts.normalized++;
  }

  if (APPLY) {
    const { error: upErr } = await db.from("users").update({ resume_url: path }).eq("id", u.id);
    if (upErr) {
      console.error(`  ! ${u.id}  row update failed: ${upErr.message}`);
      counts.failed++;
    }
  }
}

console.log("\n---");
console.log(`  already a path : ${counts.alreadyPath}`);
console.log(`  url -> path    : ${counts.normalized}`);
console.log(`  moved buckets  : ${counts.moved}`);
console.log(`  left alone     : ${counts.foreign}`);
console.log(`  failed         : ${counts.failed}`);
if (!APPLY) console.log("\nDry run. Re-run with --apply to write.");
else if (counts.failed === 0) console.log("\nDone. The bucket can be flipped private now.");
else console.log("\nFinished with failures — fix those before flipping the bucket private.");
