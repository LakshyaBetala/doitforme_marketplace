// Proves supabase/migrations/20261106_companies_admin_policy_uses_is_admin.sql
// against the LIVE database, inside one transaction that is always ROLLED BACK.
//
// It checks the bug before the migration (an admin who is in is_admin() but not
// in the old literal list cannot manage a company), then applies the migration
// inside the same transaction and checks every admin can, and a stranger still
// cannot.
//
//   node scripts/companies-admin-test.mjs
import pg from "pg";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local" });

const MIGRATION = "supabase/migrations/20261106_companies_admin_policy_uses_is_admin.sql";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const results = [];
let sp = 0;

async function rowsTouched(email, companyId) {
  const name = `s${++sp}`;
  await c.query(`SAVEPOINT ${name}`);
  try {
    await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: "00000000-0000-0000-0000-000000000000", role: "authenticated", email }),
    ]);
    await c.query(`SET LOCAL ROLE authenticated`);
    return (await c.query(`UPDATE public.companies SET description = description WHERE id = $1`, [companyId])).rowCount;
  } catch (e) {
    return `error ${e.code}`;
  } finally {
    await c.query(`ROLLBACK TO SAVEPOINT ${name}`);
    await c.query(`RESET ROLE`);
  }
}
const check = (label, got, want) => results.push({ pass: got === want, label, got, want });

try {
  // READ WRITE named explicitly: DATABASE_URL is a transaction pooler and a
  // session-level default can be left behind on a backend by an earlier client.
  await c.query("BEGIN READ WRITE");
  // A company no admin owns, so only the admin policy can let them in.
  const { rows: [co] } = await c.query(
    `SELECT id FROM public.companies WHERE user_id IS NULL OR user_id NOT IN
       (SELECT id FROM public.users WHERE lower(email) IN ('betala911@gmail.com','doitforme.in@gmail.com','gandhimouriyan1234@gmail.com'))
     LIMIT 1`);
  if (!co) throw new Error("no suitable company row to test against");

  check("BEFORE: betala911 (in the old literal) can manage", await rowsTouched("betala911@gmail.com", co.id), 1);
  check("BEFORE: gandhimouriyan1234 (missing from it) cannot -- the bug", await rowsTouched("gandhimouriyan1234@gmail.com", co.id), 0);

  await c.query(readFileSync(MIGRATION, "utf8"));

  for (const e of ["betala911@gmail.com", "doitforme.in@gmail.com", "gandhimouriyan1234@gmail.com", "Betala911@Gmail.com"]) {
    check(`AFTER: ${e} can manage`, await rowsTouched(e, co.id), 1);
  }
  check("AFTER: a stranger still cannot", await rowsTouched("someone@example.com", co.id), 0);
} finally {
  await c.query("ROLLBACK").catch(() => {});
  await c.end();
}

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label}${r.pass ? "" : `   (got ${r.got}, want ${r.want})`}`);
}
console.log(`\n${results.length - failed}/${results.length} passed (transaction rolled back; nothing persisted)`);
process.exit(failed ? 1 : 0);
