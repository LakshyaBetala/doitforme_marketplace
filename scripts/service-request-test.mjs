// Disposable-row probe for /api/gig/request-service.
//
// Unit tests prove the money-direction helpers; the escrow test proves release.
// Neither proves that the INSERT this route actually performs is accepted by the
// LIVE schema — a wrong column name, a CHECK on payment_status, or a NOT NULL
// would only surface as a 500 in production. So do the exact writes the route
// does, assert the result routes money the right way, and roll it all back.
import { config } from "dotenv";
import pg from "pg";
config({ path: ".env.local", quiet: true });

const c = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`); }
};

console.log("\nSERVICE REQUEST -> ENGAGEMENT (disposable rows)\n");

await c.query("BEGIN");
try {
  // Two real users: whoever posted a live advert (the provider), and any other
  // user standing in for the customer.
  const { rows: adverts } = await c.query(
    `select id, title, description, category, price, poster_id, is_physical, location
       from gigs
      where upper(coalesce(listing_type,'')) = 'SERVICE' and status = 'open'
      limit 1`
  );
  check("a live service advert exists to hire from", adverts.length === 1);
  const advert = adverts[0];

  const { rows: customers } = await c.query(
    `select id from users where id <> $1 limit 1`, [advert.poster_id]
  );
  const customer = customers[0].id;

  // --- exactly what the route inserts ---
  const { rows: eng } = await c.query(
    `insert into gigs (poster_id, title, description, category, price, listing_type,
                       status, max_workers, is_physical, location, source_service_id,
                       payment_status, escrow_status)
     values ($1,$2,$3,$4,$5,'HUSTLE','open',1,$6,$7,$8,'UNPAID','NONE')
     returning id, poster_id, assigned_worker_id, listing_type, source_service_id, price`,
    [customer, advert.title, advert.description, advert.category, advert.price,
     advert.is_physical, advert.location, advert.id]
  );
  check("engagement insert is accepted by the live schema", eng.length === 1);
  const engagement = eng[0];

  const { rows: app } = await c.query(
    `insert into applications (gig_id, worker_id, status, pitch, payment_preference)
     values ($1,$2,'pending',$3,'ESCROW') returning id, worker_id`,
    [engagement.id, advert.poster_id, "probe"]
  );
  check("provider is pre-applied as the worker", app[0].worker_id === advert.poster_id);

  await c.query(
    `insert into messages (gig_id, sender_id, receiver_id, content, message_type, is_pre_agreement)
     values ($1,$2,$3,'probe','text',true)`,
    [engagement.id, customer, advert.poster_id]
  );
  check("the opening message is accepted", true);

  // --- the invariants that matter ---
  check("the CUSTOMER is the poster (so they are the payer)",
    engagement.poster_id === customer);
  check("the PROVIDER is not the poster of the engagement",
    engagement.poster_id !== advert.poster_id);
  check("the engagement is a task, not another advert",
    engagement.listing_type === "HUSTLE");
  check("it links back to the advert it came from",
    engagement.source_service_id === advert.id);
  check("it inherits the advertised price",
    Number(engagement.price) === Number(advert.price));

  // --- a direct request must not become a public listing ---
  //
  // The engagement is a HUSTLE with status='open' and no assigned worker, which
  // is EXACTLY what the task feed selects and exactly what
  // notify_interested_on_new_gig fires on. Without the guards, asking one person
  // to do one job would publish it to the whole board and alert every student in
  // the category.
  const { rows: alerts } = await c.query(
    `select count(*)::int as n from notifications where link = $1`, [`/gig/${engagement.id}`]
  );
  check("no category-wide alert was sent for a private request", alerts[0].n === 0,
    `${alerts[0].n} notifications`);

  const { rows: sent } = await c.query(
    `select count(*)::int as n from gig_alerts_sent where gig_id = $1`, [engagement.id]
  );
  check("no gig_alerts_sent rows either", sent[0].n === 0, `${sent[0].n} rows`);

  // The feed's own filters, applied verbatim.
  const { rows: feed } = await c.query(
    `select count(*)::int as n from gigs
      where id = $1
        and status = 'open'
        and assigned_worker_id is null
        and source_service_id is null
        and listing_type in ('HUSTLE','COMPANY_TASK')`,
    [engagement.id]
  );
  check("the request does not appear in the public task feed", feed[0].n === 0);

  // A control: the same row WOULD have matched without the source_service_id
  // filter, which is what proves the filter is the thing doing the work.
  const { rows: wouldHave } = await c.query(
    `select count(*)::int as n from gigs
      where id = $1
        and status = 'open'
        and assigned_worker_id is null
        and listing_type in ('HUSTLE','COMPANY_TASK')`,
    [engagement.id]
  );
  check("...and it would have without the filter (so the filter is load-bearing)",
    wouldHave[0].n === 1);

  // The dashboard's suggestion list has a DIFFERENT filter set from the feed —
  // it also carries SERVICE and it excludes your own posts, which means the
  // customer would have been the only person unable to see their own private
  // request. Pin it separately.
  const { rows: dash } = await c.query(
    `select count(*)::int as n from gigs
      where id = $1
        and poster_id <> $2
        and status = 'open'
        and assigned_worker_id is null
        and source_service_id is null
        and listing_type in ('HUSTLE','COMPANY_TASK','SERVICE')`,
    [engagement.id, advert.poster_id]
  );
  check("the request does not appear in the dashboard suggestions", dash[0].n === 0);

  // The engagement must be fundable — the advert must not be.
  const { rows: fundable } = await c.query(
    `select (upper(coalesce(listing_type,'')) <> 'SERVICE') as can_fund from gigs where id = any($1)`,
    [[engagement.id, advert.id]]
  );
  check("engagement can hold escrow, advert cannot",
    fundable.filter((r) => r.can_fund).length === 1);

  // Hiring the provider assigns them as the worker => payoutRecipientId picks them.
  await c.query(`update gigs set assigned_worker_id = $1, status = 'assigned' where id = $2`,
    [advert.poster_id, engagement.id]);
  const { rows: assigned } = await c.query(
    `select poster_id, assigned_worker_id from gigs where id = $1`, [engagement.id]);
  check("once hired, the PROVIDER is the payout recipient (assigned worker)",
    assigned[0].assigned_worker_id === advert.poster_id);
  check("the customer is never the payout recipient",
    assigned[0].assigned_worker_id !== customer);

  // And the advert itself still cannot be assigned.
  let blocked = false;
  try {
    await c.query("SAVEPOINT s1");
    await c.query(`update gigs set assigned_worker_id = $1 where id = $2`, [customer, advert.id]);
    await c.query("ROLLBACK TO SAVEPOINT s1");
  } catch (e) {
    blocked = e.code === "23514";
    await c.query("ROLLBACK TO SAVEPOINT s1");
  }
  check("the advert itself still refuses to be assigned", blocked);
} catch (e) {
  fail++;
  console.log(`  FAIL  threw: ${e.code || ""} ${e.message}`);
} finally {
  await c.query("ROLLBACK");
}

const { rows: leftover } = await c.query(
  `select count(*)::int as n from gigs where source_service_id is not null`
);
check("no probe rows survived the rollback", leftover[0].n === 0, `${leftover[0].n} left`);

console.log(`\n  ${pass} passed, ${fail} failed\n`);
await c.end();
process.exit(fail ? 1 : 0);
