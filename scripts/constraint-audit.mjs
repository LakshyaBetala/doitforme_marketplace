// Read-only constraint audit of the live database.
//
// No catalog access from PostgREST, so NOT NULL comes from the OpenAPI spec and
// everything else is probed empirically with disposable rows that are deleted
// again. The point is to find the constraints that CODE assumes but the live
// database may not actually have — the class of bug that made payout_queue sit
// empty and multi-worker escrow impossible.
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const api = (p) => `${URL}/rest/v1/${p}`;

const post = async (t, body, prefer = "return=representation") => {
  const r = await fetch(api(t), { method: "POST", headers: { ...H, Prefer: prefer }, body: JSON.stringify(body) });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = txt; }
  return { status: r.status, body: j };
};
const del = (p) => fetch(api(p), { method: "DELETE", headers: H });
const get = async (p) => (await fetch(api(p), { headers: H })).json();

const cleanup = [];
let findings = [];

function note(level, msg) {
  findings.push({ level, msg });
  console.log(`  ${level === "BAD" ? "✗" : level === "OK" ? "✓" : "•"}  ${msg}`);
}

async function main() {
  const spec = await (await fetch(api(""), { headers: H })).json();

  // ---------- 1. NOT NULL, from the spec ----------
  console.log("\nNOT NULL columns (from the API schema)\n");
  for (const t of ["gigs", "escrow", "payout_queue", "transactions", "applications", "ratings", "disputes"]) {
    const d = spec.definitions[t];
    if (!d) { note("BAD", `${t}: table missing`); continue; }
    console.log(`  ${t}: ${(d.required || []).join(", ") || "(none required)"}`);
  }

  const users = await get("users?select=id,upi_id&limit=2");
  const [u1, u2] = users;

  // A disposable gig to hang probes off.
  const g = await post("gigs", {
    title: "__constraint_probe", description: "x", price: 100,
    poster_id: u1.id, assigned_worker_id: u2.id,
    listing_type: "HUSTLE", status: "open", category: "Tech & Engineering",
  });
  const gigId = g.body?.[0]?.id;
  if (!gigId) { console.error("could not create probe gig:", g); process.exit(1); }
  cleanup.push(() => del(`gigs?id=eq.${gigId}`));

  console.log("\nProbed constraints\n");

  // ---------- 2. escrow uniqueness ----------
  const escrowRow = {
    gig_id: gigId, poster_id: u1.id, worker_id: u2.id,
    original_amount: 100, platform_fee: 5, gateway_fee: 2, amount_held: 100,
    release_date: new Date().toISOString(), status: "HELD", escrow_category: "GIG",
  };
  await post("escrow", escrowRow);
  cleanup.push(() => del(`escrow?gig_id=eq.${gigId}`));

  // Same gig, DIFFERENT worker — this is what a multi-worker gig needs.
  const second = await post("escrow", { ...escrowRow, worker_id: u1.id });
  if (second.status === 201) {
    note("OK", "escrow allows two workers on one gig — UNIQUE (gig_id, worker_id) is in place");
  } else if (String(second.body?.details || "").includes("(gig_id)=")) {
    note("BAD", "escrow still has UNIQUE (gig_id) alone — MULTI-WORKER GIGS CANNOT FUND (migration 20260827 not applied)");
  } else {
    note("BAD", `escrow second-worker insert refused: ${JSON.stringify(second.body).slice(0, 120)}`);
  }

  // ---------- 3. payout_queue: empty UPI must be impossible ----------
  const badUpi = await post("payout_queue", {
    worker_id: u2.id, gig_id: gigId, amount: 10, upi_id: "   ", status: "PENDING",
  });
  if (badUpi.status === 201) {
    note("BAD", "payout_queue accepted a blank upi_id — an unpayable row can be queued (payout_queue_upi_present missing)");
    await del(`payout_queue?gig_id=eq.${gigId}`);
  } else {
    note("OK", "payout_queue rejects a blank upi_id");
  }

  // ---------- 4. payout_queue status domain ----------
  const badStatus = await post("payout_queue", {
    worker_id: u2.id, gig_id: gigId, amount: 10, upi_id: "probe@okicici", status: "NONSENSE",
  });
  if (badStatus.status === 201) {
    note("BAD", "payout_queue accepted status='NONSENSE' — no CHECK on status");
    await del(`payout_queue?gig_id=eq.${gigId}`);
  } else {
    note("OK", "payout_queue constrains status to a known set");
  }

  // ---------- 5. negative money ----------
  const negative = await post("payout_queue", {
    worker_id: u2.id, gig_id: gigId, amount: -500, upi_id: "probe@okicici", status: "PENDING",
  });
  if (negative.status === 201) {
    note("BAD", "payout_queue accepted a NEGATIVE amount (-500) — nothing stops a negative payout row");
    await del(`payout_queue?gig_id=eq.${gigId}`);
  } else {
    note("OK", "payout_queue rejects negative amounts");
  }

  const negGig = await post("gigs", {
    title: "__constraint_probe_neg", description: "x", price: -100,
    poster_id: u1.id, listing_type: "HUSTLE", status: "open", category: "Tech & Engineering",
  });
  if (negGig.status === 201) {
    note("BAD", "gigs accepted a NEGATIVE price (-100) — the scroll-wheel bug could have persisted one");
    cleanup.push(() => del(`gigs?id=eq.${negGig.body[0].id}`));
  } else {
    note("OK", "gigs rejects a negative price");
  }

  // ---------- 6. duplicate ratings ----------
  const r1 = await post("ratings", { gig_id: gigId, rater_id: u1.id, rated_id: u2.id, score: 5, review: "probe" });
  const r2 = await post("ratings", { gig_id: gigId, rater_id: u1.id, rated_id: u2.id, score: 1, review: "probe dup" });
  cleanup.push(() => del(`ratings?gig_id=eq.${gigId}`));
  if (r1.status === 201 && r2.status === 201) {
    note("BAD", "ratings allows the SAME rater to rate the same person twice on one gig — the duplicate guard is application-only and races");
  } else if (r2.status !== 201) {
    note("OK", "ratings has a uniqueness constraint per (gig, rater, rated)");
  }

  // ---------- 7. rating score range ----------
  const badScore = await post("ratings", { gig_id: gigId, rater_id: u2.id, rated_id: u1.id, score: 99, review: "probe" });
  if (badScore.status === 201) {
    note("BAD", "ratings accepted score=99 — no CHECK constraining 1..5, so one bad write skews a profile average");
  } else {
    note("OK", "ratings constrains score to 1..5");
  }

  // ---------- 8. escrow status domain ----------
  const badEscrowStatus = await post("escrow", { ...escrowRow, worker_id: u1.id, status: "NONSENSE" });
  if (badEscrowStatus.status === 201) {
    note("BAD", "escrow accepted status='NONSENSE' — no CHECK on escrow status");
  } else {
    note("OK", "escrow constrains status to a known set");
  }

  for (const fn of cleanup.reverse()) { try { await fn(); } catch {} }
  await del(`escrow?gig_id=eq.${gigId}`);
  await del(`payout_queue?gig_id=eq.${gigId}`);
  await del(`ratings?gig_id=eq.${gigId}`);
  await del(`gigs?id=eq.${gigId}`);

  const bad = findings.filter((f) => f.level === "BAD");
  console.log(`\n  ${findings.filter((f) => f.level === "OK").length} constraints present, ${bad.length} missing\n`);
}

main().catch(async (e) => {
  console.error("probe failed:", e);
  for (const fn of cleanup.reverse()) { try { await fn(); } catch {} }
  process.exit(1);
});
