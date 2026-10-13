// Prove the access hierarchy against the LIVE database by becoming each role.
//
// WHY THIS AND NOT A UNIT TEST. The rules in lib/access.ts are enforced by RLS
// policies, and a unit test can only check that the TypeScript agrees with
// itself. The question worth answering is "can a builder actually read a deal
// value", and the only honest way to ask it is to connect, become that person,
// run the query and count the rows that come back.
//
// HOW THE SIMULATION IS FAITHFUL. Supabase derives identity from the request
// JWT: auth.uid() reads `request.jwt.claims -> sub`, and is_admin() reads
// `auth.jwt() ->> 'email'`. Setting those two settings inside a transaction and
// switching to the `authenticated` role is exactly the context PostgREST
// establishes, so the policies evaluate against the same inputs they do in
// production. `set local` means it unwinds with the transaction.
//
// Like scripts/escrow-flow-test.mjs, this uses DISPOSABLE ROWS on live tables
// and deletes them in a finally block. Everything it creates carries the
// __audit__ marker so a crashed run can be cleaned by hand.
//
//   node scripts/access-matrix-audit.mjs
import "dotenv/config";
import { config } from "dotenv";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { MATRIX, FORBIDDEN_COMBINATIONS } from "../lib/access.ts";

config({ path: ".env.local" });

const MARK = "__audit__";
const ADMIN_EMAIL = "betala911@gmail.com"; // on the is_admin() whitelist

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let pass = 0;
let fail = 0;
const failures = [];

function check(ok, label, detail) {
  if (ok) {
    pass++;
    console.log(`  ok    ${label}`);
  } else {
    fail++;
    failures.push(`${label} — ${detail}`);
    console.log(`  FAIL  ${label}  (${detail})`);
  }
}

/** Run a query as a given identity, with RLS applied. Returns the row count. */
async function countAs({ uid, email }, sql) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: uid, email, role: "authenticated" }),
    ]);
    const r = await client.query(sql);
    return Number(r.rows[0]?.n ?? 0);
  } finally {
    // Always unwind, even on a policy error, or the session keeps the role.
    await client.query("rollback");
  }
}

/** Anonymous: the `anon` role, no JWT at all. */
async function countAsAnon(sql) {
  await client.query("begin");
  try {
    await client.query("set local role anon");
    const r = await client.query(sql);
    return Number(r.rows[0]?.n ?? 0);
  } catch {
    // A permission error is the strongest possible pass for anon.
    return -1;
  } finally {
    await client.query("rollback");
  }
}

const ids = {
  builder: randomUUID(),
  outreach: randomUUID(),
  outreachOther: randomUUID(),
  pm: randomUUID(),
  student: randomUUID(),
};
let projectId;
let leadId;

async function seed() {
  const mk = (id, role, elite) =>
    client.query(
      `insert into public.users (id, email, name, is_elite, inner_circle_role)
       values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
      [id, `${MARK}${id}@example.invalid`, `${MARK} ${role}`, elite, role],
    );

  await mk(ids.builder, "TECH", true);
  await mk(ids.outreach, "OUTREACH", true);
  await mk(ids.outreachOther, "OUTREACH", true);
  await mk(ids.pm, "TECH", true); // a PM is a person; PM-ness comes from projects.pm_id
  await client.query(
    `insert into public.users (id, email, name, is_elite) values ($1,$2,$3,false)
     on conflict (id) do nothing`,
    [ids.student, `${MARK}${ids.student}@example.invalid`, `${MARK} student`],
  );

  // A lead owned by ONE outreach member, so "own" vs "other" is testable.
  const lead = await client.query(
    `insert into public.outreach_leads (company_name, owner_id, stage)
     values ($1,$2,'new') returning id`,
    [`${MARK} Audit Co ${randomUUID().slice(0, 8)}`, ids.outreach],
  );
  leadId = lead.rows[0].id;

  const proj = await client.query(
    `insert into public.projects
       (client_name, service_key, deal_value, pm_id, lead_id, scope)
     values ($1,'MOBILE_APP',150000,$2,$3,$4) returning id`,
    [`${MARK} Audit Client`, ids.pm, leadId, `${MARK} scope`],
  );
  projectId = proj.rows[0].id;

  await client.query(
    `insert into public.project_tasks (project_id, role, title, assignee_id, fee)
     values ($1,'MOBILE',$2,$3,7000)`,
    [projectId, `${MARK} task`, ids.builder],
  );

  // A commission tranche for the owning outreach member, and a probation round
  // for the builder. Seeded because an "own" assertion against an EMPTY table
  // passes for the wrong reason: zero rows proves nothing about a policy. The
  // first run of this audit "failed" these four checks for exactly that reason,
  // which is the right way round — a test that cannot see data should say so
  // rather than quietly agree.
  await client.query(
    `insert into public.outreach_commissions (lead_id, earner_id, tranche, amount)
     values ($1,$2,'first',6000)`,
    [leadId, ids.outreach],
  );
  await client.query(
    `insert into public.program_probation_tasks (user_id, role, round, sent_at)
     values ($1,'TECH',1, now())`,
    [ids.builder],
  );
}

async function cleanup() {
  // project_tasks cascades from projects.
  if (projectId) await client.query("delete from public.projects where id=$1", [projectId]);
  if (leadId) {
    await client.query("delete from public.outreach_commissions where lead_id=$1", [leadId]);
    await client.query("delete from public.outreach_leads where id=$1", [leadId]);
  }
  await client.query("delete from public.program_probation_tasks where user_id = any($1::uuid[])", [Object.values(ids)]);
  await client.query("delete from public.users where email like $1", [`${MARK}%`]);
  // Belt and braces for a previously crashed run.
  await client.query("delete from public.projects where client_name like $1", [`${MARK}%`]);
  await client.query("delete from public.outreach_leads where company_name like $1", [`${MARK}%`]);
}

async function main() {
  await client.connect();
  console.log("Access matrix audit — live database, disposable rows\n");

  try {
    await seed();

    const actors = {
      ANON: null,
      STUDENT: { uid: ids.student, email: `${MARK}s@example.invalid` },
      BUILDER: { uid: ids.builder, email: `${MARK}b@example.invalid` },
      OUTREACH: { uid: ids.outreach, email: `${MARK}o@example.invalid` },
      PM: { uid: ids.pm, email: `${MARK}p@example.invalid` },
      ADMIN: { uid: ids.builder, email: ADMIN_EMAIL },
    };

    // Only the rows this run created, so a populated database cannot make a
    // "none" expectation pass or fail by accident.
    const scoped = {
      projects: `select count(*)::int n from public.projects where id='${projectId}'`,
      project_tasks: `select count(*)::int n from public.project_tasks where project_id='${projectId}'`,
      outreach_leads: `select count(*)::int n from public.outreach_leads where id='${leadId}'`,
      outreach_commissions: `select count(*)::int n from public.outreach_commissions where lead_id='${leadId}'`,
      program_probation_tasks: `select count(*)::int n from public.program_probation_tasks where user_id='${ids.builder}'`,
      users: `select count(*)::int n from public.users where id='${ids.builder}'`,
    };

    console.log("the matrix, row by row");
    for (const rule of MATRIX) {
      const sql = scoped[rule.table];
      if (!sql) continue;
      const label = `${rule.actor.padEnd(8)} ${rule.read.padEnd(4)} ${rule.table}`;
      const n = rule.actor === "ANON" ? await countAsAnon(sql) : await countAs(actors[rule.actor], sql);

      if (rule.read === "none") {
        // -1 means the grant itself was refused, which is stronger than 0 rows.
        check(n <= 0, label, `read ${n} row(s), expected none`);
      } else {
        check(n > 0, label, `read 0 rows, expected to see its own`);
      }
    }

    console.log("\nthe rule the business rests on");
    // Re-asserted independently of the matrix: a careless edit to one row above
    // must not be able to open this gap quietly.
    for (const combo of FORBIDDEN_COMBINATIONS) {
      for (const actor of ["STUDENT", "BUILDER", "OUTREACH"]) {
        if (combo.allowed.includes(actor)) continue;
        const counts = [];
        for (const t of combo.tables) {
          counts.push(
            actor === "ANON" ? await countAsAnon(scoped[t]) : await countAs(actors[actor], scoped[t]),
          );
        }
        const holdsBoth = counts.every((c) => c > 0);
        check(
          !holdsBoth,
          `${actor.padEnd(8)} cannot hold ${combo.tables.join(" + ")}`,
          `saw ${counts.join(" and ")} rows — this is the whole margin`,
        );
      }
    }

    console.log("\ncross-tenant: one member must not read another's");
    // The outreach branch of projects_read is scoped to leads they OWN. A
    // second outreach member is the case that proves it is not just
    // "is_outreach() and therefore everything".
    const other = await countAs(
      { uid: ids.outreachOther, email: `${MARK}o2@example.invalid` },
      scoped.projects,
    );
    check(other === 0, "OUTREACH cannot read a project from someone else's lead", `saw ${other}`);

    const notMyTask = await countAs(
      { uid: ids.outreachOther, email: `${MARK}o2@example.invalid` },
      scoped.project_tasks,
    );
    check(notMyTask === 0, "a non-assignee cannot read a task", `saw ${notMyTask}`);

    const notMyPm = await countAs({ uid: ids.student, email: `${MARK}s@example.invalid` }, scoped.projects);
    check(notMyPm === 0, "a plain student cannot read a project", `saw ${notMyPm}`);

    console.log("\nwrites");
    // Only an admin creates a project: a PM inventing one is a PM inventing a
    // commission liability.
    let pmInserted = false;
    await client.query("begin");
    try {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: ids.pm, email: `${MARK}p@example.invalid`, role: "authenticated" }),
      ]);
      await client.query(
        `insert into public.projects (client_name, service_key, deal_value, pm_id)
         values ($1,'AUDIT',1,$2)`,
        [`${MARK} illegal`, ids.pm],
      );
      pmInserted = true;
    } catch {
      pmInserted = false;
    } finally {
      await client.query("rollback");
    }
    check(!pmInserted, "PM cannot create a project", "the insert policy let it through");
  } finally {
    await cleanup();
    console.log("\ndisposable rows removed");
  }

  console.log(`\n${pass}/${pass + fail} checks passed.`);
  if (fail > 0) {
    console.log("\nFAILURES:");
    for (const f of failures) console.log("  - " + f);
    console.log("\nThe hierarchy does NOT hold. Fix the policy, not this script.");
    process.exitCode = 1;
  } else {
    console.log("The access hierarchy holds in the live database.");
  }
  await client.end();
}

main().catch(async (e) => {
  console.error("\naudit crashed:", e.message);
  try {
    await cleanup();
    await client.end();
  } catch {}
  process.exitCode = 1;
});
