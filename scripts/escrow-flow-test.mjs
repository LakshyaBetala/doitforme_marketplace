// End-to-end escrow release test against the real database, using disposable
// rows that are deleted at the end.
//
// This covers the bug that shipped to production: three of the four release
// paths flipped gig columns without ever inserting a payout_queue row, so a
// worker could be owed money that nothing in the system recorded. Unit tests
// cannot catch that — it only shows up when you look at what the RPC leaves
// behind in three tables at once.
//
//   node escrow-flow.mjs
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const api = (p) => `${URL}/rest/v1/${p}`;

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  → " + detail : ""}`); }
};

async function post(path, body, prefer = "return=representation") {
  const r = await fetch(api(path), { method: "POST", headers: { ...H, Prefer: prefer }, body: JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, body: j };
}
async function get(path) {
  const r = await fetch(api(path), { headers: H });
  return { status: r.status, body: await r.json() };
}
async function patch(path, body) {
  const r = await fetch(api(path), { method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
async function del(path) {
  const r = await fetch(api(path), { method: "DELETE", headers: H });
  return r.status;
}
async function rpc(fn, args) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: H, body: JSON.stringify(args) });
  return { status: r.status, body: await r.json() };
}

const stamp = Date.now();
const created = { gigs: [], escrow: [], payouts: [], users: [] };

// Hoisted, because restoring the worker's UPI is not an assertion — it is
// repair. It used to live at the end of the happy path, so a crash or a Ctrl-C
// anywhere between the refusal test and the release left a REAL student with a
// wiped upi_id, and manual_release_escrow refuses without one: the next time
// they delivered work, their payout would not queue. The test's own failure
// mode was the bug it exists to catch.
let workerId = null;
let originalUpi = null;
let upiTouched = false;

async function cleanup() {
  if (upiTouched && workerId) {
    await patch(`users?id=eq.${workerId}`, { upi_id: originalUpi });
  }
  for (const id of created.payouts) await del(`payout_queue?id=eq.${id}`);
  for (const id of created.escrow) await del(`escrow?id=eq.${id}`);
  for (const id of created.gigs) {
    await del(`notifications?link=eq./gig/${id}`);
    await del(`gig_alerts_sent?gig_id=eq.${id}`);
    await del(`payout_queue?gig_id=eq.${id}`);
    await del(`escrow?gig_id=eq.${id}`);
    await del(`transactions?gig_id=eq.${id}`);
    await del(`gigs?id=eq.${id}`);
  }
  for (const id of created.users) await del(`users?id=eq.${id}`);
}

async function main() {
  console.log("\nESCROW RELEASE — end to end\n");

  // users.id references auth.users, so borrow ids from existing rows rather
  // than inventing uuids: we only need two distinct ids that satisfy the FK.
  //
  // The worker is chosen from accounts whose upi_id is ALREADY null and which
  // have never completed a job. Step 1 has to null the worker's UPI to prove
  // the release refuses without one, and on a live database with thousands of
  // real students that write is the only genuinely destructive thing this file
  // does. Choosing a row where it is a no-op removes the hazard instead of
  // promising to undo it. There are ~2,290 such accounts.
  const { body: workers } = await get(
    "users?select=id&upi_id=is.null&jobs_completed=in.(0)&limit=1"
  );
  const { body: posters } = await get("users?select=id&limit=2");
  if (!Array.isArray(workers) || !workers.length || !Array.isArray(posters) || posters.length < 2) {
    console.error("Need a UPI-less user and at least 2 users in the database to run this test.");
    process.exit(1);
  }
  workerId = workers[0].id;
  const posterId = posters.find((u) => u.id !== workerId)?.id;
  if (!posterId) { console.error("Could not pick a distinct poster."); process.exit(1); }

  // Snapshot anyway: the assertion that it came back is still worth making.
  const { body: workerBefore } = await get(`users?id=eq.${workerId}&select=upi_id`);
  originalUpi = workerBefore[0]?.upi_id ?? null;

  // ---------- fixture: a funded, delivered gig ----------
  const price = 1000;
  const fee = 50; // 5% student
  const { status: gs, body: gig } = await post("gigs", {
    title: `__test_escrow_${stamp}`,
    description: "disposable row created by escrow-flow.mjs",
    price,
    poster_id: posterId,
    assigned_worker_id: workerId,
    listing_type: "HUSTLE",
    status: "delivered",
    payment_status: "ESCROW_FUNDED",
    escrow_status: "HELD",
    platform_fee: fee,
    category: "Tech & Engineering",
  });
  ok("fixture gig created", gs === 201 && gig?.[0]?.id, `status ${gs} ${JSON.stringify(gig).slice(0, 160)}`);
  if (!gig?.[0]?.id) { await cleanup(); return; }
  const gigId = gig[0].id;
  created.gigs.push(gigId);

  const { status: es, body: esc } = await post("escrow", {
    gig_id: gigId,
    poster_id: posterId,
    worker_id: workerId,
    original_amount: price,
    platform_fee: fee,
    gateway_fee: 20,
    amount_held: price,
    release_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: "HELD",
    escrow_category: "GIG",
  });
  ok("fixture escrow HELD created", es === 201 && esc?.[0]?.id, `status ${es} ${JSON.stringify(esc).slice(0, 160)}`);
  if (esc?.[0]?.id) created.escrow.push(esc[0].id);

  // ---------- 1. refuses when the worker has no UPI ----------
  upiTouched = true;
  await patch(`users?id=eq.${workerId}`, { upi_id: null });
  const noUpi = await rpc("manual_release_escrow", { p_gig_id: gigId });
  ok("release refused when worker has no UPI",
     noUpi.body?.success === false && noUpi.body?.code === "WORKER_UPI_MISSING",
     JSON.stringify(noUpi.body));

  const { body: escStillHeld } = await get(`escrow?gig_id=eq.${gigId}&select=status`);
  ok("escrow untouched after refusal", escStillHeld?.[0]?.status === "HELD", JSON.stringify(escStillHeld));

  const { body: noQueue } = await get(`payout_queue?gig_id=eq.${gigId}&select=id`);
  ok("no payout queued after refusal", Array.isArray(noQueue) && noQueue.length === 0);

  // ---------- 2. the happy path ----------
  await patch(`users?id=eq.${workerId}`, { upi_id: "flowtest@okicici" });
  const rel = await rpc("manual_release_escrow", { p_gig_id: gigId });
  ok("release succeeds with a UPI on file", rel.body?.success === true, JSON.stringify(rel.body));
  ok("returns net of the platform fee (1000 - 50 = 950)", Number(rel.body?.amount) === price - fee, `got ${rel.body?.amount}`);

  const { body: escAfter } = await get(`escrow?gig_id=eq.${gigId}&select=status,released_at`);
  ok("escrow row marked RELEASED", escAfter?.[0]?.status === "RELEASED", JSON.stringify(escAfter));
  ok("released_at stamped", Boolean(escAfter?.[0]?.released_at));

  const { body: gigAfter } = await get(`gigs?id=eq.${gigId}&select=status,payment_status,escrow_status`);
  ok("gig completed", gigAfter?.[0]?.status === "completed", JSON.stringify(gigAfter));
  ok("gig PAYOUT_PENDING (not left ESCROW_FUNDED)", gigAfter?.[0]?.payment_status === "PAYOUT_PENDING", JSON.stringify(gigAfter));

  // The regression this whole file exists for.
  const { body: queue } = await get(`payout_queue?gig_id=eq.${gigId}&select=id,amount,status,upi_id,worker_id`);
  ok("PAYOUT QUEUED — the row that was never being created", Array.isArray(queue) && queue.length === 1, JSON.stringify(queue));
  if (queue?.[0]) {
    created.payouts.push(queue[0].id);
    ok("queued amount is net of fee", Number(queue[0].amount) === price - fee, `got ${queue[0].amount}`);
    ok("queued with the worker's UPI attached", queue[0].upi_id === "flowtest@okicici", queue[0].upi_id);
    ok("queued against the worker, not the poster", queue[0].worker_id === workerId);
    ok("queued as PENDING", queue[0].status === "PENDING", queue[0].status);
  }

  // ---------- 3. double release is refused ----------
  const again = await rpc("manual_release_escrow", { p_gig_id: gigId });
  ok("second release refused (escrow no longer HELD)", again.body?.success === false, JSON.stringify(again.body));
  const { body: queue2 } = await get(`payout_queue?gig_id=eq.${gigId}&select=id`);
  ok("no duplicate payout row", Array.isArray(queue2) && queue2.length === 1, `${queue2?.length} rows`);

  // ---------- restore + clean ----------
  await patch(`users?id=eq.${workerId}`, { upi_id: originalUpi });
  upiTouched = false;
  const { body: restored } = await get(`users?id=eq.${workerId}&select=upi_id`);
  ok("worker UPI restored", (restored?.[0]?.upi_id ?? null) === originalUpi, `${restored?.[0]?.upi_id}`);

  await cleanup();
  const { body: gone } = await get(`gigs?id=eq.${gigId}&select=id`);
  ok("disposable rows cleaned up", Array.isArray(gone) && gone.length === 0);

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}

// Ctrl-C is not a crash, and it was the one exit that ran no repair at all:
// the process died with the worker's UPI still nulled and the fixture gig still
// in the table. It is also the likeliest way a run against a live database ends
// early, because the first thing you do when a test touching money looks wrong
// is stop it.
let cleaning = false;
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    if (cleaning) return;
    cleaning = true;
    console.log(`
  ${sig} — repairing and removing disposable rows...`);
    try { await cleanup(); console.log("  done."); } catch (e) { console.error("  CLEANUP FAILED:", e); }
    process.exit(130);
  });
}

main().catch(async (e) => {
  console.error("\nunexpected error:", e);
  await cleanup();
  process.exit(1);
});
