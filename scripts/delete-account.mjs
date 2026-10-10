// Erase a user's personal data on request (DPDP Act 2023, right to erasure).
//
//   npx tsx scripts/delete-account.mjs a@b.com c@d.com     # dry run, shows the plan
//   npx tsx scripts/delete-account.mjs a@b.com --apply     # actually does it
//
// Run with tsx, not node: the rules below are imported from
// lib/accountErasure.ts, which is TypeScript. That import is the point. The
// same rules now serve the self-serve route at /api/account/delete, and a
// second copy of "which columns identify a person" is exactly how the admin
// whitelist ended up in eight files and the KYC prompt in two.
//
// WHY THIS IS NOT `DELETE FROM users`
//
// Every foreign key into public.users is either ON DELETE CASCADE or NO ACTION,
// and both are wrong here:
//
//   CASCADE  would take the OTHER party's history with it — messages they sent,
//            ratings they wrote, gigs they posted. One person's erasure request
//            is not consent to delete somebody else's records.
//   NO ACTION on disputes.raised_by, payout_queue.worker_id and
//            notifications.user_id means a hard delete simply FAILS the moment
//            any of those rows exist.
//
// And transaction/escrow rows must be retained regardless: they are financial
// records, and India's tax and payment-gateway rules require keeping them.
//
// So: anonymise the profile in place, destroy the documents, and delete the auth
// identity — which is the part that actually constitutes "the account". What is
// left is a row with no personal data in it that other people's history can
// still point at. Three earlier deletions in this database already look exactly
// like this ("Deleted user", email NULL), so this matches precedent.
//
// REFUSES to erase anyone with money in flight. Funded escrow or a pending
// payout has to be settled first — erasing a party mid-transaction strands the
// other side with no counterparty and no way to dispute.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  DOC_BUCKETS,
  ERASE_COLUMNS,
  IN_FLIGHT_CHECKS,
  inFlightMessage,
  summarizeInFlight,
} from "../lib/accountErasure.ts";

config({ path: ".env.local", quiet: true });

const APPLY = process.argv.includes("--apply");
const emails = process.argv.slice(2).filter((a) => !a.startsWith("--"));

if (emails.length === 0) {
  console.error("Usage: node scripts/delete-account.mjs <email> [<email>...] [--apply]");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// The column list, the buckets and the money-in-flight rule all come from
// lib/accountErasure.ts so this script and /api/account/delete cannot drift.
const ERASE = ERASE_COLUMNS;

async function purgeBucket(bucket, userId) {
  const { data: files, error } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
  if (error || !files?.length) return 0;
  const paths = files.map((f) => `${userId}/${f.name}`);
  if (!APPLY) return paths.length;
  const { error: rmErr } = await supabase.storage.from(bucket).remove(paths);
  if (rmErr) {
    console.log(`      ! ${bucket}: ${rmErr.message}`);
    return 0;
  }
  return paths.length;
}

let erased = 0, refused = 0, missing = 0;

console.log(`\nACCOUNT ERASURE — ${APPLY ? "APPLYING" : "DRY RUN (add --apply)"}\n`);

for (const email of emails) {
  const { data: user } = await supabase
    .from("users")
    .select("id, email, name")
    .ilike("email", email)
    .maybeSingle();

  if (!user) {
    console.log(`  SKIP  ${email} — no account found`);
    missing++;
    continue;
  }

  // Money in flight is a hard stop, and the rule is shared with the route so
  // an operator and a user get the same answer. It also checks the escrow table
  // directly, not just the gig columns: a gig can sit at status 'assigned' while
  // its escrow row still reads HELD, which is the shape of the one payment that
  // has been stuck for over a month.
  const counts = {};
  for (const check of IN_FLIGHT_CHECKS) {
    const { count } = await supabase
      .from(check.table)
      .select("id", { count: "exact", head: true })
      .eq(check.userColumn, user.id)
      .eq(check.column, check.value);
    counts[check.key] = count ?? 0;
  }
  const flight = summarizeInFlight(counts);
  if (flight.blocked) {
    console.log(`  REFUSE ${email} — ${inFlightMessage(flight)}`);
    refused++;
    continue;
  }

  console.log(`  ${APPLY ? "ERASE " : "WOULD "} ${email}  (${user.id})`);

  let docs = 0;
  for (const b of DOC_BUCKETS) docs += await purgeBucket(b, user.id);
  console.log(`      documents: ${docs}`);

  if (APPLY) {
    // Push subscriptions are a device identifier — remove, don't blank.
    await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
    await supabase.from("notifications").delete().eq("user_id", user.id);

    const { error: updErr } = await supabase.from("users").update(ERASE).eq("id", user.id);
    if (updErr) {
      console.log(`      ! profile: ${updErr.message}`);
      continue;
    }

    // The account itself. Without this they could still sign in.
    const { error: authErr } = await supabase.auth.admin.deleteUser(user.id);
    if (authErr && !/not found/i.test(authErr.message)) {
      console.log(`      ! auth: ${authErr.message}`);
      continue;
    }
    console.log(`      profile anonymised, auth identity deleted`);
  }
  erased++;
}

console.log(
  `\n  ${erased} ${APPLY ? "erased" : "to erase"}, ${refused} refused, ${missing} not found\n`
);
if (!APPLY) console.log("  Nothing changed. Re-run with --apply to carry it out.\n");
