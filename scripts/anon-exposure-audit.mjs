// What can a stranger read with the public anon key?
//
// The anon key ships inside every page load, so anything it can reach is
// effectively published. This asserts the opposite of the usual test: it fails
// when something is READABLE.
//
// It exists because the leak it checks for was invisible from the dashboard.
// public.users had RLS enabled and two `USING (true)` SELECT policies, which
// reads as "protected" at a glance; in fact every student's email, phone,
// upi_id and KYC document URL came back to an unauthenticated curl, 3152 rows
// of it. Row-level security cannot express "public row, private column" —
// column privileges can, and this checks they are still in place.
//
//   npm run db:anon-audit
//
// Exit code 1 on any exposure, so it can gate a deploy.

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!URL_ || !ANON) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
  process.exit(1);
}

const H = { apikey: ANON, Authorization: `Bearer ${ANON}` };
let failures = 0;
let checks = 0;

function record(ok, label, detail) {
  checks++;
  if (!ok) failures++;
  console.log(`  ${ok ? "ok  " : "LEAK"}  ${label}${detail ? `  ${detail}` : ""}`);
}

/** A column is safe when the anon role has no grant for it (Postgres 42501). */
async function mustDenyColumns(table, columns) {
  for (const col of columns) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(col)}&limit=1`, { headers: H });
    const body = await r.text();
    record(/42501/.test(body), `${table}.${col} denied`, /42501/.test(body) ? "" : `-> ${r.status} ${body.slice(0, 60)}`);
  }
}

/** A public surface must keep working, or the lockdown broke the product. */
async function mustAllow(label, table, select) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`, { headers: H });
  const body = await r.text();
  record(r.status === 200, `${label} still readable`, r.status === 200 ? "" : `-> ${r.status} ${body.slice(0, 60)}`);
}

/** Whole tables that must return nothing at all to a stranger. */
async function mustBeEmpty(table) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, { headers: H });
  const body = await r.text();
  const exposed = r.status === 200 && body.startsWith("[") && body.length > 2;
  record(!exposed, `${table} returns nothing`, exposed ? `-> ${body.slice(0, 60)}` : "");
}

/** Money and state functions must be unreachable without the service role. */
async function mustDenyRpc(name, args) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await r.text();
  // Only 42501 is a denial. The function's own error (P0001) means it RAN —
  // that distinction is what made an earlier "fix" look like it had worked.
  const denied = /42501/.test(body);
  const ranAnyway = /P0001/.test(body);
  record(denied, `rpc ${name} denied`, denied ? "" : `-> ${r.status} ${ranAnyway ? "EXECUTED (P0001)" : body.slice(0, 50)}`);
}

/** Storage buckets holding private documents must not enumerate. */
async function mustNotList(bucket) {
  const r = await fetch(`${URL_}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 3 }),
  });
  const body = await r.text();
  const listed = r.status === 200 && body.startsWith("[") && body.length > 2;
  record(!listed, `bucket ${bucket} does not enumerate`, listed ? `-> ${body.slice(0, 60)}` : "");
}

const Z = "00000000-0000-0000-0000-000000000000";

// PREFLIGHT: is the API actually answering?
//
// Every "must be denied" check below passes by matching Postgres error 42501.
// When the Supabase project is restricted (402) or paused (503), the gateway
// answers before Postgres ever sees the request, so NONE of those checks can
// match and all of them report as leaks. That is exactly backwards — the API is
// returning nothing to anyone — and it buries the handful of checks that are
// still meaningful.
//
// So: establish that the API responds at all before drawing any conclusion from
// what it says.
{
  const r = await fetch(`${URL_}/rest/v1/gigs?select=id&limit=1`, { headers: H });
  if (r.status === 402 || r.status === 503) {
    const body = await r.text();
    console.error(
      `\nCANNOT AUDIT — the Supabase API is answering ${r.status}, not Postgres.\n\n` +
        `  ${body.slice(0, 180)}\n\n` +
        `Every "denied" check in this script passes by matching Postgres error 42501.\n` +
        `A gateway-level ${r.status} never reaches Postgres, so those checks would all\n` +
        `report LEAK while the API is in fact returning nothing to anyone.\n\n` +
        `This is NOT a pass and NOT a failure: the audit did not run. Re-run it once\n` +
        `the project is unrestricted. To check grants and policies in the meantime,\n` +
        `query information_schema directly over DATABASE_URL.\n`
    );
    process.exit(2); // distinct from 1, which means real exposures were found
  }
}

console.log("\nAnonymous exposure audit — anything READABLE here is published.\n");

console.log("users — contact details and KYC");
await mustDenyColumns("users", [
  "email", "phone", "upi_id", "id_card_url", "telegram_chat_id",
  "kyc_rejection_reason", "kyc_confidence", "total_earned", "signup_source", "*",
]);
await mustAllow("public profile", "users", "id, name, username, avatar_url, college, rating, jobs_completed");

console.log("\ngigs — delivered work, disputes, handover PIN, fees");
await mustDenyColumns("gigs", [
  "handshake_code", "delivery_link", "delivery_files", "dispute_reason",
  "platform_fee", "net_worker_pay", "gateway_order_id", "escrow_amount", "*",
]);
await mustAllow("public listing", "gigs", "id, title, price, status, listing_type, created_at");

console.log("\ntables that must be fully private");
for (const t of [
  "applications", "messages", "ratings", "notifications", "escrow",
  "transactions", "payout_queue", "wallets", "push_subscriptions",
  // Inner Circle. inner_circle_applications holds someone's pitch and a
  // screening score; outreach_leads and outreach_touches hold third-party
  // company contact details that were never ours to publish. All three were
  // added after this audit was written, so it was passing on a surface that no
  // longer matched the product — the exact way a list like this rots.
  "inner_circle_applications", "outreach_leads", "outreach_touches",
  // The agency program. program_term_acceptances is a signed agreement with an
  // IP address attached; outreach_commissions is somebody's pay and the value
  // of a third party's deal; program_probation_tasks is a person's score before
  // anyone has told them. Added here in the same change that created them,
  // rather than after an audit pass found them missing.
  "program_term_acceptances", "outreach_commissions", "program_probation_tasks",
  // The PM desk. `projects` holds a third party's contact details and what
  // they paid; `project_tasks` holds what each builder is paid. Together they
  // are the whole arbitrage, which is why they are two tables with different
  // policies rather than one — and why neither may be reachable by a stranger
  // holding the anon key that ships in every page load.
  "projects", "project_tasks",
]) await mustBeEmpty(t);

// The role registry is the one Inner Circle table that IS anon-readable, on
// purpose: it is the role list on a public-facing page and holds nothing but
// labels, blurbs and a status. Asserted POSITIVELY so that "anon can read it"
// stays a decision somebody made rather than an accident nobody notices, and
// so the apply page cannot silently lose its role list to a tightening.
await mustAllow("inner circle role registry", "inner_circle_roles", "value, label, status");

console.log("\nmoney and state RPCs");
await mustDenyRpc("manual_release_escrow", { p_gig_id: Z });
await mustDenyRpc("refund_escrow_transactional", { p_gig_id: Z, p_poster_id: Z });
await mustDenyRpc("increment_worker_stats", { worker_id: Z, amount: 1 });
// Gates Inner Circle applications. It answers only about auth.uid(), so an
// anonymous caller learns nothing useful — but EXECUTE was revoked from anon
// deliberately and this keeps that true.
await mustDenyRpc("is_kyc_approved", {});
// Gates approval into the program. Supabase grants EXECUTE to anon DIRECTLY as
// well as via PUBLIC, so the migration revokes from all three — this is the
// check that proves it took, since a revoke from PUBLIC alone reads as complete
// while changing nothing.
await mustDenyRpc("has_accepted_terms", { p_version: "x", p_role: "TECH" });
// SECURITY DEFINER, so an anonymous caller reaching it would be running it as
// the owner. Supabase grants EXECUTE to anon DIRECTLY as well as via PUBLIC,
// so this is the assertion that proves the REVOKE in the migration actually
// took — remember that a 400 carrying the function's own error means it RAN.
await mustDenyRpc("is_project_pm", { p_project_id: Z });

console.log("\nprivate storage");
for (const b of ["resumes", "kyc-ids", "verification-docs"]) await mustNotList(b);

// The resume bucket must also refuse a direct object read, not merely a listing.
{
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (svc) {
    const db = createClient(URL_, svc, { auth: { persistSession: false } });
    const { data } = await db.from("users").select("resume_url").not("resume_url", "is", null).limit(1);
    const path = data?.[0]?.resume_url;
    if (path) {
      const r = await fetch(`${URL_}/storage/v1/object/public/resumes/${path}`);
      record(r.status !== 200, "resume not readable by direct URL", r.status === 200 ? "-> 200 READABLE" : "");
    }
  }
}

console.log(`\n${checks - failures}/${checks} checks passed.`);
if (failures) {
  console.error(`\n${failures} EXPOSURE${failures === 1 ? "" : "S"} — a stranger can read the above.`);
  process.exit(1);
}
console.log("Nothing private is reachable with the anon key.\n");
