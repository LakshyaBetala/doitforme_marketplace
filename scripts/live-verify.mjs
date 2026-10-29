// Verify the LIVE site after a deploy. Read-only: GETs, plus two POSTs the
// server is expected to refuse.
//
// WHY THIS EXISTS. The Round 1 portal shipped answering 307 -> /login for
// every candidate: two branches each correct alone, wrong together, past a
// green build and 182 passing unit tests. proxy.ts imports next/server and
// @supabase/ssr, so nothing unit-tests the real routing; only the deployed
// site can answer "is the portal reachable". Run this after EVERY deploy.
//
//   node scripts/live-verify.mjs
//
// Exits non-zero if any check fails, so it can gate a deploy script.
const HOSTS = ["https://www.doitforme.in", "https://doitforme.in"];
const W = "https://doitforme1.doitforme.workers.dev";

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

async function get(url, init = {}) {
  const r = await fetch(url, { redirect: "manual", ...init });
  const body = await r.text();
  return { status: r.status, location: r.headers.get("location") || "", body, headers: r.headers };
}

const HELD = (b) => /Taking[\s\S]{0,40}our time/.test(b); // h1 is split by <br>

for (const H of HOSTS) {
  const tag = H.replace("https://", "");
  // --- pages that must work during the hold ---
  let r = await get(`${H}/maintenance`);
  check(`${tag} /maintenance renders hold page`, r.status === 200 && HELD(r.body), r.status);
  check(`${tag} /maintenance shows the Round 1 card`, /Sales is live\./.test(r.body) && /Open my Round 1 task/.test(r.body));
  check(`${tag} /maintenance card offers a way in for the uninvited`, /Put your hand up/.test(r.body) && /save-your-spot/.test(r.body));
  check(`${tag} /maintenance has no stale opt-in copy`, !/still building the selection properly/.test(r.body));
  check(`${tag} /maintenance has no 'Arriving with the relaunch'`, !/Arriving with the relaunch/.test(r.body));

  r = await get(`${H}/inner-circle/sales/round-1`);
  check(`${tag} Round 1 return login is 200 (not bounced to /login)`, r.status === 200, `${r.status} ${r.location}`);

  r = await get(`${H}/inner-circle/sales/round-1/notarealtoken123`);
  check(`${tag} Round 1 invite page renders for any token shape`, r.status === 200, r.status);

  r = await get(`${H}/login/inner-circle-sales`);
  check(`${tag} /login/inner-circle-sales redirects to the portal`, [307, 308].includes(r.status) && /inner-circle\/sales\/round-1/.test(r.location), `${r.status} ${r.location}`);

  r = await get(`${H}/login`);
  check(`${tag} /login reachable during hold (admin can sign in)`, r.status === 200 && !HELD(r.body), r.status);

  r = await get(`${H}/admin`);
  check(`${tag} /admin -> /login when signed out`, [307, 308].includes(r.status) && /\/login/.test(r.location), `${r.status} ${r.location}`);

  // --- must stay held ---
  for (const p of ["/dashboard", "/feed", "/inner-circle", "/inner-circle/earnings", "/auth-transfer"]) {
    r = await get(`${H}${p}`);
    check(`${tag} ${p} stays held (503 hold page)`, r.status === 503 && HELD(r.body), r.status);
  }

  // --- public pages ---
  for (const p of ["/", "/pricing", "/contact", "/terms", "/privacy-policy"]) {
    r = await get(`${H}${p}`);
    check(`${tag} ${p} is 200`, r.status === 200, r.status);
  }

  // The landing page is where most people arrive; the Round 1 card has to be there too.
  r = await get(`${H}/`);
  check(`${tag} / shows the Round 1 card`, /Sales is live\./.test(r.body) && /Open my Round 1 task/.test(r.body));
  check(`${tag} / card links to the portal`, /\/inner-circle\/sales\/round-1/.test(r.body));
  check(`${tag} / card's "not invited" route points at the waitlist form`, /\/maintenance#save-your-spot/.test(r.body));
}

const H = HOSTS[0];
// --- APIs ---
let r = await get(`${H}/api/waitlist`);
let j = {}; try { j = JSON.parse(r.body); } catch {}
check("GET /api/waitlist returns live counts", r.status === 200 && j.count > 2000 && j.innerCircle > 1000, r.body.slice(0, 80));

r = await get(`${H}/api/inner-circle/round1/me`);
check("GET round1/me is a clean 401 or 503 (never 500)", [401, 503].includes(r.status), `${r.status} ${r.body.slice(0, 60)}`);

r = await get(`${H}/api/admin/inner-circle-round1/list`);
check("admin list refuses anonymous (401)", r.status === 401, r.status);

r = await get(`${W}/api/cron/inner-circle-round1-nudge`);
check("cron route on workers.dev refuses without secret (401)", r.status === 401, r.status);

r = await get(`${H}/api/escrow/refund`);
check("no self-serve refund endpoint (404)", r.status === 404, r.status);

r = await fetch(`${H}/api/inner-circle/round1/track`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: "drop_table" }) });
check("track refuses unknown event (400)", r.status === 400, r.status);

// --- security headers ---
r = await get(`${H}/maintenance`);
for (const h of ["strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy"]) {
  check(`header ${h} present`, !!r.headers.get(h), r.headers.get(h) || "missing");
}

// --- email assets ---
for (const p of ["/icons/icon-192.png", "/sloth.png", "/og-card.png"]) {
  const a = await fetch(`https://doitforme.in${p}`);
  check(`asset ${p} served as image`, a.status === 200 && /image\/png/.test(a.headers.get("content-type") || ""), `${a.status} ${a.headers.get("content-type")}`);
}

let fails = 0;
for (const x of results) {
  if (!x.ok) fails++;
  console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.ok ? "" : `   [got: ${x.detail}]`}`);
}
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
