// Count the hold-page waitlist by segment, through the Cloudflare REST API.
//
// WHY NOT WRANGLER. `wrangler d1 execute` authenticates as whichever account
// you are logged into, and this D1 lives on a different account from the one
// the local login holds — which is the 7403 everyone keeps hitting. An API
// token scoped to the right account sidesteps the login entirely.
//
// Read-only: every statement here is a SELECT.
//
//   node scripts/waitlist-segments.mjs
//
// Needs CLOUDFLARE_API_TOKEN (or scratchpad/.cf-token) with:
//   Account | D1 | Read     on the account that owns doitforme.in

import { readFileSync, existsSync } from "node:fs";

const TOKEN_FILE = "scratchpad/.cf-token";
const TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8").trim() : "");

// From wrangler.jsonc. The account is the one the D1 actually belongs to, not
// whichever account the local wrangler login happens to hold.
const ACCOUNT = "58032355b5351475f0afae799cd53bed";
const DB = "9f83b32e-6c34-4117-98f6-4f8e2ad002e7";

if (!TOKEN) {
  console.error(
    `No token. Save one to ${TOKEN_FILE} or set CLOUDFLARE_API_TOKEN.\n` +
      "It needs Account | D1 | Read on the account owning doitforme.in.",
  );
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: query }),
    },
  );
  const body = await res.json();
  if (!body.success) {
    throw new Error(JSON.stringify(body.errors || body));
  }
  return body.result?.[0]?.results ?? [];
}

const show = (label, rows) => {
  console.log(`\n${label}`);
  if (!rows.length) return console.log("  (none)");
  for (const r of rows) {
    console.log(
      "  " +
        Object.entries(r)
          .map(([k, v]) => `${k}=${v === null ? "null" : v}`)
          .join("  "),
    );
  }
};

try {
  show("TOTAL", await sql("SELECT count(*) AS people FROM waitlist"));

  show(
    "INNER CIRCLE opt-ins by side  (this is the sales list)",
    await sql(`SELECT
         CASE
           WHEN inner_circle_role = 'OUTREACH' THEN 'OUTREACH  (Bring the work in)'
           WHEN inner_circle_role = 'TECH'     THEN 'TECH      (Build the work)'
           ELSE                                     'UNDECIDED (Not sure yet)'
         END AS side,
         count(*) AS n
       FROM waitlist WHERE inner_circle = 1
       GROUP BY 1 ORDER BY n DESC`),
  );

  show(
    "EARN vs HIRE (the first toggle), across everyone",
    await sql("SELECT coalesce(intent,'(none)') AS intent, count(*) AS n FROM waitlist GROUP BY 1 ORDER BY n DESC"),
  );

  show(
    "DELIVERABILITY: how many have a usable email",
    await sql(`SELECT
         count(*) AS rows,
         sum(CASE WHEN email LIKE '%_@_%.__%' THEN 1 ELSE 0 END) AS looks_valid,
         count(DISTINCT lower(email)) AS distinct_emails
       FROM waitlist`),
  );

  // Sending order matters more than list size: the newest signups remember
  // opting in, and a warm first batch protects the domain's reputation for
  // the colder ones behind it.
  show(
    "RECENCY of Inner Circle opt-ins",
    await sql(`SELECT
         CASE
           WHEN created_at >= datetime('now','-7 days')  THEN 'last 7 days'
           WHEN created_at >= datetime('now','-30 days') THEN '8-30 days'
           WHEN created_at >= datetime('now','-90 days') THEN '31-90 days'
           ELSE 'older than 90 days'
         END AS age,
         count(*) AS n
       FROM waitlist WHERE inner_circle = 1
       GROUP BY 1 ORDER BY n DESC`),
  );

  console.log(
    "\nNothing was written. Every statement above is a SELECT.\n" +
      "Export the actual addresses only when a campaign is ready to send —\n" +
      "they promised 'one email when we reopen', and that promise is the only\n" +
      "reason this list will open anything.",
  );
} catch (e) {
  console.error("\nD1 query failed:", e.message);
  console.error(
    "\nIf this is 7403 or 9109, the token is not scoped to account\n" +
      `${ACCOUNT} with D1 Read, or the token value is wrong.`,
  );
  process.exit(1);
}
