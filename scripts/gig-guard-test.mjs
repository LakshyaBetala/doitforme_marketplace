// Proves supabase/migrations/20261106_guard_gig_money_columns.sql against the
// LIVE database, inside one transaction that is always ROLLED BACK.
//
// Postgres DDL is transactional, so the trigger itself, every test row and the
// notifications the gigs triggers write are all undone at the end. Nothing
// persists, whether or not the migration has been applied for real. The three
// existing gigs triggers were checked first: they only insert into
// notifications / gig_alerts_sent and make no external calls, so rollback
// genuinely undoes everything.
//
// It acts as a real poster by setting request.jwt.claims and switching to the
// `authenticated` role, exactly as PostgREST does per request.
//
//   node scripts/gig-guard-test.mjs
//
// Exits non-zero if any legitimate write is refused or any tampering is allowed.
import pg from "pg";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local" });

const MIGRATION = "supabase/migrations/20261106_guard_gig_money_columns.sql";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const results = [];
let sp = 0;

// Run `sql` as `role` with the given JWT claims, inside a savepoint that is
// always rolled back, and report whether Postgres allowed it.
async function as(role, claims, sql, params = []) {
  const name = `s${++sp}`;
  await c.query(`SAVEPOINT ${name}`);
  try {
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await c.query(`SET LOCAL ROLE ${role}`);
    const r = await c.query(sql, params);
    return { ok: true, rows: r.rowCount };
  } catch (e) {
    return { ok: false, code: e.code, msg: e.message };
  } finally {
    await c.query(`ROLLBACK TO SAVEPOINT ${name}`);
    await c.query(`RESET ROLE`);
  }
}

function expect(label, res, want) {
  // want: "allowed" (and it must actually touch a row) or "refused" (42501).
  const pass = want === "allowed" ? res.ok && res.rows > 0 : !res.ok && res.code === "42501";
  results.push({ pass, label, want, got: res.ok ? `allowed (${res.rows} row)` : `${res.code} ${res.msg}` });
}

try {
  // READ WRITE named explicitly. DATABASE_URL is Supabase's transaction pooler,
  // which hands one backend to many clients: a session-level SET made by an
  // earlier script survives on that backend for whoever gets it next. A
  // read-only default leaked exactly that way once. Never rely on the session.
  await c.query("BEGIN READ WRITE");
  await c.query(readFileSync(MIGRATION, "utf8"));

  // Fixtures, as the table owner (the guard does not apply to it). Rolled back.
  const { rows: [u] } = await c.query(
    `SELECT id, email FROM public.users WHERE email NOT IN ('betala911@gmail.com','doitforme.in@gmail.com','gandhimouriyan1234@gmail.com') AND role IS DISTINCT FROM 'COMPANY' LIMIT 1`);
  const poster = { sub: u.id, role: "authenticated", email: u.email };
  const ins = async (extra) => (await c.query(
    `INSERT INTO public.gigs (poster_id, title, description, price, status, payment_status, escrow_status ${extra.cols})
     VALUES ($1, 'guard test', 'guard test', 500, $2, $3, $4 ${extra.vals}) RETURNING id`,
    [u.id, extra.status ?? "open", extra.pay ?? "PENDING", extra.escrow ?? "NONE", ...(extra.params ?? [])])).rows[0].id;
  const direct = await ins({ cols: "", vals: "" });
  const funded = await ins({ cols: "", vals: "", status: "assigned", pay: "ESCROW_FUNDED", escrow: "HELD" });
  const other = (await c.query(`SELECT id FROM public.users WHERE id <> $1 LIMIT 1`, [u.id])).rows[0].id;
  // A dispute in progress: the escrow is frozen until an admin decides.
  await c.query(`UPDATE public.gigs SET dispute_reason='work was late' WHERE id=$1`, [funded]);

  // ---- what posters legitimately do, which must keep working ----------------
  expect("poster edits the title of their own gig", await as("authenticated", poster, `UPDATE public.gigs SET title='edited' WHERE id=$1`, [direct]), "allowed");
  expect("Company Pro features its own gig (is_featured)", await as("authenticated", poster, `UPDATE public.gigs SET is_featured=true WHERE id=$1`, [direct]), "allowed");
  expect("poster closes a DIRECT gig (status -> completed)", await as("authenticated", poster, `UPDATE public.gigs SET status='completed' WHERE id=$1`, [direct]), "allowed");
  expect("payments/create-order's own-session write", await as("authenticated", poster, `UPDATE public.gigs SET gateway_order_id='order_test', payment_gateway='RAZORPAY', escrow_amount=510 WHERE id=$1`, [direct]), "allowed");
  expect("gig/hire's own-session write", await as("authenticated", poster, `UPDATE public.gigs SET payment_gateway='RAZORPAY', gateway_order_id='order_test2' WHERE id=$1`, [direct]), "allowed");
  expect("poster posts an ordinary new gig", await as("authenticated", poster,
    `INSERT INTO public.gigs (poster_id, title, description, price, status) VALUES ($1,'t','t',300,'open')`, [u.id]), "allowed");

  // ---- trusted callers are untouched -----------------------------------------
  expect("service role may change price (every money route)", await as("service_role", { role: "service_role" }, `UPDATE public.gigs SET price=999 WHERE id=$1`, [direct]), "allowed");
  expect("an admin may change price (dispute desk)", await as("authenticated", { sub: u.id, role: "authenticated", email: "betala911@gmail.com" }, `UPDATE public.gigs SET price=999 WHERE id=$1`, [direct]), "allowed");

  // ---- tampering, which must now be refused -----------------------------------
  expect("poster rewrites price", await as("authenticated", poster, `UPDATE public.gigs SET price=1 WHERE id=$1`, [direct]), "refused");
  expect("poster marks their gig funded without paying", await as("authenticated", poster, `UPDATE public.gigs SET payment_status='ESCROW_FUNDED' WHERE id=$1`, [direct]), "refused");
  expect("poster reassigns the worker", await as("authenticated", poster, `UPDATE public.gigs SET assigned_worker_id=$2 WHERE id=$1`, [direct, other]), "refused");
  expect("poster zeroes the platform fee", await as("authenticated", poster, `UPDATE public.gigs SET platform_fee=0, net_worker_pay=500 WHERE id=$1`, [funded]), "refused");
  expect("poster completes a gig HOLDING escrow", await as("authenticated", poster, `UPDATE public.gigs SET status='completed' WHERE id=$1`, [funded]), "refused");
  expect("poster wipes an open dispute to unfreeze escrow", await as("authenticated", poster, `UPDATE public.gigs SET dispute_reason=NULL WHERE id=$1`, [funded]), "refused");
  expect("an unchanged money column is not a change", await as("authenticated", poster, `UPDATE public.gigs SET price=price, title='x' WHERE id=$1`, [direct]), "allowed");
  expect("poster creates a gig already funded", await as("authenticated", poster,
    `INSERT INTO public.gigs (poster_id, title, description, price, status, payment_status) VALUES ($1,'t','t',300,'open','ESCROW_FUNDED')`, [u.id]), "refused");
  expect("poster creates a gig already assigned", await as("authenticated", poster,
    `INSERT INTO public.gigs (poster_id, title, description, price, status, assigned_worker_id) VALUES ($1,'t','t',300,'open',$2)`, [u.id, other]), "refused");

  // ---- posting in a company's name --------------------------------------------
  const { rows: [co] } = await c.query(`SELECT id, user_id FROM public.companies WHERE user_id IS NOT NULL AND user_id <> $1 LIMIT 1`, [u.id]);
  expect("a student posts under someone else's company", await as("authenticated", poster,
    `INSERT INTO public.gigs (poster_id, title, description, price, status, company_id) VALUES ($1,'t','t',300,'open',$2)`, [u.id, co.id]), "refused");
  expect("a company posts under its own company", await as("authenticated", { sub: co.user_id, role: "authenticated", email: "owner@example.com" },
    `INSERT INTO public.gigs (poster_id, title, description, price, status, company_id) VALUES ($1,'t','t',300,'open',$2)`, [co.user_id, co.id]), "allowed");
} finally {
  await c.query("ROLLBACK").catch(() => {});
  await c.end();
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  [${r.want.padEnd(7)}] ${r.label}${r.pass ? "" : `\n        got: ${r.got}`}`);
}
console.log(`\n${results.length - failed}/${results.length} passed (transaction rolled back; nothing persisted)`);
process.exit(failed ? 1 : 0);
