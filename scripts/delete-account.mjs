// Erase a user's personal data on request (DPDP Act 2023, right to erasure).
//
//   node scripts/delete-account.mjs a@b.com c@d.com        # dry run, shows the plan
//   node scripts/delete-account.mjs a@b.com --apply        # actually does it
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

// Every column on public.users that identifies a person. Anything not listed
// here is either a counter, a timestamp, or a foreign key other rows depend on.
const ERASE = {
  email: null,
  name: "Deleted user",
  phone: null,
  college: null,
  avatar_url: null,
  username: null,
  display_name: null,
  bio: null,
  upi_id: null,
  id_card_url: null,
  resume_url: null,
  telegram_chat_id: null,
  experience: null,
  year_of_study: null,
  branch: null,
  skills: [],
  portfolio_links: [],
  preferences: [],
  referral_code: null,
  kyc_status: "none",
  kyc_verified: false,
  kyc_institution: null,
  kyc_rejection_reason: null,
  kyc_confidence: null,
  kyc_reviewed_at: null,
  signup_source: null,
  signup_source_detail: null,
  signup_referrer: null,
  signup_landing: null,
};

// Private buckets holding identity documents. Removing the storage.objects row
// is not enough on its own — go through the storage API so the file itself goes.
const DOC_BUCKETS = ["resumes", "kyc-ids", "verification-docs"];

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

  // Money in flight is a hard stop.
  const [{ count: postedFunded }, { count: workingFunded }, { count: payouts }] = await Promise.all([
    supabase.from("gigs").select("id", { count: "exact", head: true })
      .eq("poster_id", user.id).eq("payment_status", "ESCROW_FUNDED"),
    supabase.from("gigs").select("id", { count: "exact", head: true })
      .eq("assigned_worker_id", user.id).eq("payment_status", "ESCROW_FUNDED"),
    supabase.from("payout_queue").select("id", { count: "exact", head: true })
      .eq("worker_id", user.id).eq("status", "PENDING"),
  ]);

  if ((postedFunded || 0) + (workingFunded || 0) + (payouts || 0) > 0) {
    console.log(
      `  REFUSE ${email} — money in flight (funded posted ${postedFunded}, funded working ${workingFunded}, pending payouts ${payouts}). Settle first.`
    );
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
