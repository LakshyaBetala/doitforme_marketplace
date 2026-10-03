// Delete files in `gig-images` that no gig points at.
//
//   node scripts/prune-unreferenced-gig-files.mjs            # report only
//   node scripts/prune-unreferenced-gig-files.mjs --apply
//
// `gigs.images` stores the exact object path ("<userId>/<ts>_<name>"), so the
// set of files worth keeping is knowable precisely rather than by guesswork.
//
// Measured before writing this: 536 objects in the bucket, 451 paths referenced
// across 1,191 gigs. The gap is re-uploads — editing a gig, or retrying a slow
// upload, writes a NEW timestamped object and repoints the row, leaving the old
// one behind forever. One brief (IndustrialWaterTreatment.pdf, 22.9 MB) sits in
// the bucket five times; another (ComputerSystemsBlueprint.pdf, 16.3 MB) five
// times. 136 redundant copies hold 205 MB.
//
// Note what this is NOT: `gig-images` holds the documents posters attach to a
// brief, not only photographs — 93 PDFs and PPTX files make up 365 MB of the
// 537 MB. An earlier attempt to shrink this bucket by re-encoding everything as
// JPEG would have destroyed every one of them. Deleting what nothing references
// is the safe operation; re-encoding a brief is not.
//
// Refuses to run if the reference set looks implausibly small, which is the
// shape a paging bug takes (PostgREST caps a read at 1,000 rows, and acting on
// a truncated list deletes live files).

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });
const APPLY = process.argv.includes("--apply");

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const MB = (b) => (b / 1048576).toFixed(1);

// Every gig, paged. A truncated read here means deleting live files.
const gigs = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await s.from("gigs").select("id, images, delivery_files").range(from, from + 999);
  if (error) throw error;
  gigs.push(...data);
  if (data.length < 1000) break;
}

const referenced = new Set();
for (const g of gigs) {
  for (const arr of [g.images, g.delivery_files]) {
    for (const v of arr || []) {
      if (!v) continue;
      // Rows hold a bare object path, but tolerate a full public URL too.
      const path = String(v).includes("/gig-images/") ? String(v).split("/gig-images/")[1] : String(v);
      referenced.add(path.replace(/^\/+/, ""));
    }
  }
}

const files = [];
const { data: top } = await s.storage.from("gig-images").list("", { limit: 2000 });
for (const entry of top || []) {
  if (entry.id) {
    files.push({ path: entry.name, size: entry.metadata?.size || 0 });
    continue;
  }
  const { data: inner } = await s.storage.from("gig-images").list(entry.name, { limit: 2000 });
  for (const f of inner || []) files.push({ path: `${entry.name}/${f.name}`, size: f.metadata?.size || 0 });
}

const unreferenced = files.filter((f) => !referenced.has(f.path));
const bytes = unreferenced.reduce((a, f) => a + f.size, 0);
const totalBytes = files.reduce((a, f) => a + f.size, 0);

console.log(`\ngigs read: ${gigs.length}   referenced paths: ${referenced.size}`);
console.log(`objects in bucket: ${files.length}  (${MB(totalBytes)} MB)`);
console.log(`unreferenced:      ${unreferenced.length}  (${MB(bytes)} MB)\n`);

// A reference set this small against this many objects means the gig read was
// truncated, not that the bucket is mostly garbage.
if (referenced.size < files.length * 0.3) {
  console.error("REFUSING: referenced paths look implausibly few — check the paging before deleting anything.\n");
  process.exit(1);
}

for (const f of [...unreferenced].sort((a, b) => b.size - a.size).slice(0, 12)) {
  console.log(`  ${MB(f.size).padStart(7)} MB  ${f.path}`);
}
if (unreferenced.length > 12) console.log(`  … and ${unreferenced.length - 12} more`);

if (!APPLY) {
  console.log("\nNothing changed. Re-run with --apply.\n");
  process.exit(0);
}

let removed = 0;
for (let i = 0; i < unreferenced.length; i += 100) {
  const slice = unreferenced.slice(i, i + 100).map((f) => f.path);
  const { error } = await s.storage.from("gig-images").remove(slice);
  if (error) console.log(`  ! ${error.message}`);
  else removed += slice.length;
}
console.log(`\nremoved ${removed}/${unreferenced.length} objects, reclaimed ${MB(bytes)} MB\n`);
