// Reclaim Supabase free-tier quota: prune notification bookkeeping and dead files.
//
//   node scripts/prune-usage.mjs              # measure only, change nothing
//   node scripts/prune-usage.mjs --apply      # do it
//   node scripts/prune-usage.mjs --apply --db-only
//   node scripts/prune-usage.mjs --apply --storage-only
//
// WHY THIS EXISTS
//
// The database held ~2.6 MILLION rows across two notification tables against
// 5,646 users, 1,190 gigs and 5,449 messages. Posting one gig fans a row out to
// every user whose preferences match its category — about 1,092 of them — and
// writes that twice: once as a `notifications` row and once as a
// `gig_alerts_sent` row for de-duplication. 1,190 gigs is the whole 2.6M.
//
// Neither table is a record of anything. `gig_alerts_sent` exists only to stop
// double-alerting on a gig while it is live; a week later the gig is stale and
// the row is dead weight. A notification nobody opened in two weeks will never
// be opened.
//
// Storage was at 137% of the 1 GB tier, and most of the excess is genuinely
// dead: images for gigs that were deleted, resume and ID versions that were
// superseded by a re-upload, and — the big one — identity documents belonging
// to students who were verified long ago.
//
// ON DELETING APPROVED STUDENTS' ID IMAGES
//
// Verified against the code before writing this: the only screen that renders
// an ID is the admin review desk, which queries `kyc_status = 'manual_review'`.
// /verify-id redirects an approved student away before it reads anything. So
// once a student is approved their ID image has no reader at all.
//
// The verification DECISION stays on the row — kyc_status, kyc_institution,
// kyc_confidence, kyc_reviewed_at. What goes is the photograph of a government
// or college identity document we no longer have a reason to hold. That is data
// minimisation, not just housekeeping, and holding the images indefinitely is
// the bigger liability under the DPDP Act.
//
// Students still in manual_review are NEVER touched — their document is the
// thing an admin is about to look at.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const DB_ONLY = argv.includes("--db-only");
const STORAGE_ONLY = argv.includes("--storage-only");

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MB = (b) => (b / 1048576).toFixed(1);
const ago = (days) => new Date(Date.now() - days * 86400e3).toISOString();

// PostgREST caps a select at 1000 rows. Paging is not optional here: reading
// 1,000 of 5,646 users makes every file belonging to the other 4,646 look
// orphaned, which is exactly the wrong conclusion to act on with a delete.
async function all(table, cols, tweak = (q) => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(s.from(table).select(cols)).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

// Delete in slices. One DELETE over a million rows hits the statement timeout
// and rolls back the whole thing, reclaiming nothing.
//
// `notifications` has an `id`; `gig_alerts_sent` does not — it is keyed by
// (gig_id, user_id, channel). So each table needs its own handle: slice by id
// where there is one, and by gig_id where there isn't.
async function deleteOlderThan(table, isoCutoff, keyCol, label) {
  let removed = 0;

  if (keyCol === "id") {
    // 200, not 1000. PostgREST puts the id list in the query string, and a
    // thousand UUIDs makes a ~37 KB URL — the server answers "Bad Request" and
    // nothing gets deleted.
    const BATCH = 200;
    for (;;) {
      const { data, error } = await s.from(table).select("id").lt("created_at", isoCutoff).limit(BATCH);
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data.length) break;
      const { error: delErr } = await s.from(table).delete().in("id", data.map((r) => r.id));
      if (delErr) throw new Error(`${table} delete: ${delErr.message}`);
      removed += data.length;
      if (removed % 50000 === 0) console.log(`    ${label}: ${removed.toLocaleString()} removed…`);
    }
  } else {
    // No surrogate key: work gig by gig. Each gig contributes ~1,100 rows, so a
    // single gig_id is a naturally sized batch.
    for (;;) {
      const { data, error } = await s.from(table).select(keyCol).lt("created_at", isoCutoff).limit(1000);
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data.length) break;
      const ids = [...new Set(data.map((r) => r[keyCol]))];
      const { error: delErr } = await s.from(table).delete().in(keyCol, ids).lt("created_at", isoCutoff);
      if (delErr) throw new Error(`${table} delete: ${delErr.message}`);
      removed += data.length;
      process.stdout.write(`\r    ${label}: ~${removed.toLocaleString()} scanned…   `);
    }
  }

  process.stdout.write("\r");
  return removed;
}

async function countOlderThan(table, isoCutoff) {
  const { count, error } = await s.from(table).select("*", { count: "exact", head: true }).lt("created_at", isoCutoff);
  if (error) return null;
  return count;
}

console.log(`\nSUPABASE QUOTA RECLAIM — ${APPLY ? "APPLYING" : "DRY RUN (add --apply)"}\n`);

// ---------------------------------------------------------------- database
const DB_RULES = [
  // Its only job is to stop a second alert for a gig that is still live.
  { table: "gig_alerts_sent", days: 7, key: "gig_id", why: "dedupe ledger for live gigs" },
  // Nobody opens a two-week-old notification.
  { table: "notifications", days: 14, key: "id", why: "unread after two weeks is never read" },
];

if (!STORAGE_ONLY) {
  console.log("DATABASE");
  for (const r of DB_RULES) {
    const n = await countOlderThan(r.table, ago(r.days));
    console.log(`  ${r.table.padEnd(18)} older than ${String(r.days).padStart(2)}d: ${n === null ? "(count timed out — table is large)" : n.toLocaleString().padStart(10)}   ${r.why}`);
    if (APPLY) {
      const removed = await deleteOlderThan(r.table, ago(r.days), r.key, r.table);
      console.log(`    -> removed ${removed.toLocaleString()}`);
    }
  }
  console.log();
}

// ---------------------------------------------------------------- storage
if (!DB_ONLY) {
  console.log("STORAGE");
  const users = await all("users", "id, id_card_url, resume_url, kyc_status");
  const gigs = await all("gigs", "id");
  const liveUsers = new Set(users.map((u) => u.id));
  const liveGigs = new Set(gigs.map((g) => g.id));

  const referenced = new Set();
  for (const u of users) {
    if (u.id_card_url) referenced.add(`kyc-ids/${u.id_card_url}`);
    if (u.resume_url) referenced.add(`resumes/${u.resume_url}`);
  }
  // Students whose document still has a reader: the admin review desk.
  const underReview = new Set(users.filter((u) => u.kyc_status === "manual_review").map((u) => u.id));
  const approved = users.filter((u) => u.kyc_status === "approved" && u.id_card_url);

  const toDelete = []; // { bucket, path, size, reason }

  // 1. Files under an owner that no longer exists, and superseded versions.
  //
  // Each bucket names its folders after a DIFFERENT thing, and getting this
  // wrong deletes live files. It already did once: an earlier version of this
  // script checked every bucket's folder against the user list, so
  // chat-attachments — which is foldered by roomId/gigId — looked entirely
  // orphaned and all 53 files were removed. They happened to be abandoned
  // uploads that no message referenced, so nothing was lost, but that was luck.
  // State the owner per bucket rather than assuming one shape.
  const OWNER_OF = {
    "kyc-ids": (folder) => liveUsers.has(folder), //           <userId>/<file>
    resumes: (folder) => liveUsers.has(folder), //             <userId>/<file>
    "gig-images": (folder) => liveGigs.has(folder) || liveUsers.has(folder), // <gigId|userId>/<file>
    "chat-attachments": (folder) => liveGigs.has(folder), //   <roomId == gigId>/<file>
  };

  for (const bucket of Object.keys(OWNER_OF)) {
    const { data: top } = await s.storage.from(bucket).list("", { limit: 2000 });
    for (const folder of top || []) {
      if (folder.id) continue; // a file at the root, not a folder
      const { data: inner } = await s.storage.from(bucket).list(folder.name, { limit: 2000 });
      const ownerGone = !OWNER_OF[bucket](folder.name);
      for (const f of inner || []) {
        const path = `${folder.name}/${f.name}`;
        const size = f.metadata?.size || 0;
        if (ownerGone) {
          toDelete.push({ bucket, path, size, reason: "owner deleted" });
        } else if (
          (bucket === "kyc-ids" || bucket === "resumes") &&
          !referenced.has(`${bucket}/${path}`)
        ) {
          toDelete.push({ bucket, path, size, reason: "superseded by a re-upload" });
        }
      }
    }
  }

  // 2. ID images for students already approved. Never those under review.
  let approvedBytes = 0;
  const clearIdFor = [];
  for (const u of approved) {
    if (underReview.has(u.id)) continue;
    const already = toDelete.find((d) => d.bucket === "kyc-ids" && `${d.bucket}/${d.path}` === `kyc-ids/${u.id_card_url}`);
    if (already) continue;
    const folder = u.id_card_url.split("/")[0];
    const name = u.id_card_url.split("/").slice(1).join("/");
    const { data: inner } = await s.storage.from("kyc-ids").list(folder, { limit: 100 });
    const match = (inner || []).find((f) => f.name === name);
    const size = match?.metadata?.size || 0;
    approvedBytes += size;
    toDelete.push({ bucket: "kyc-ids", path: u.id_card_url, size, reason: "student already approved" });
    clearIdFor.push(u.id);
  }

  const byReason = {};
  for (const d of toDelete) {
    byReason[d.reason] = byReason[d.reason] || { n: 0, bytes: 0 };
    byReason[d.reason].n++;
    byReason[d.reason].bytes += d.size;
  }
  for (const [reason, v] of Object.entries(byReason)) {
    console.log(`  ${reason.padEnd(28)} ${String(v.n).padStart(5)} files  ${MB(v.bytes).padStart(8)} MB`);
  }
  const totalBytes = toDelete.reduce((a, d) => a + d.size, 0);
  console.log(`  ${"TOTAL".padEnd(28)} ${String(toDelete.length).padStart(5)} files  ${MB(totalBytes).padStart(8)} MB`);
  console.log(`  (students still in manual_review: ${underReview.size} — their documents are untouched)`);

  if (APPLY) {
    const byBucket = {};
    for (const d of toDelete) (byBucket[d.bucket] ||= []).push(d.path);
    for (const [bucket, paths] of Object.entries(byBucket)) {
      let done = 0;
      for (let i = 0; i < paths.length; i += 100) {
        const slice = paths.slice(i, i + 100);
        const { error } = await s.storage.from(bucket).remove(slice);
        if (error) console.log(`    ! ${bucket}: ${error.message}`);
        else done += slice.length;
      }
      console.log(`    ${bucket}: removed ${done}/${paths.length}`);
    }
    // Drop the pointer too, or the row claims a document that is gone.
    for (let i = 0; i < clearIdFor.length; i += 200) {
      const slice = clearIdFor.slice(i, i + 200);
      const { error } = await s.from("users").update({ id_card_url: null }).in("id", slice);
      if (error) console.log(`    ! clearing id_card_url: ${error.message}`);
    }
    console.log(`    cleared id_card_url on ${clearIdFor.length} approved students`);
  }
}

console.log(APPLY ? "\nDone.\n" : "\nNothing changed. Re-run with --apply.\n");
