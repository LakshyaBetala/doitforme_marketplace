// Export the waitlist to Brevo-ready CSVs, one file per sending batch.
//
// WHY BATCHES AND NOT ONE FILE. The domain has never sent bulk mail, so it has
// no sending reputation. Dropping 2,206 cold messages in one go is the fastest
// way to be classified as a spammer, and the damage lands on the TRANSACTIONAL
// mail too — the KYC approvals, payment receipts and dispute notices that have
// to arrive. So the list is split warmest-first: the people who ticked a box
// 7 days ago and chose a side, then the rest.
//
// Order is deliberate:
//   1-outreach   188  asked for "Bring the work in" — the sales role being announced
//   2-tech       242  asked for "Build the work"
//   3-undecided  892  Inner Circle yes, side "Not sure yet"
//   4-rest       ~884 on the waitlist but never ticked Inner Circle
//
// Each batch is also a checkpoint: send one, watch the bounce and complaint
// rate for a day, and stop if either looks wrong rather than discovering it
// at message 2,000.
//
//   node scripts/waitlist-export.mjs
//
// Writes to scratchpad/waitlist/ which is gitignored. These are real people's
// addresses collected under "one email when we reopen" — they do not belong
// in the repository, and the promise is the reason the list will open
// anything at all.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const TOKEN_FILE = "scratchpad/.cf-token";
const TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8").trim() : "");
const ACCOUNT = "58032355b5351475f0afae799cd53bed";
const DB = "9f83b32e-6c34-4117-98f6-4f8e2ad002e7";
const OUT = "scratchpad/waitlist";

if (!TOKEN) {
  console.error(`No token. Save one to ${TOKEN_FILE} (Account | D1 | Read).`);
  process.exit(1);
}

async function sql(query) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql: query }),
    },
  );
  const body = await res.json();
  if (!body.success) throw new Error(JSON.stringify(body.errors || body));
  return body.result?.[0]?.results ?? [];
}

/** RFC 4180: quote everything, double any embedded quote. Names contain commas. */
const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * Brevo matches contacts on EMAIL and maps the rest to attributes of the same
 * name. FIRSTNAME is what the greeting uses, so a blank one has to degrade to
 * something sayable rather than "Hi ,".
 */
const firstName = (name) => {
  const n = String(name ?? "").trim().split(/\s+/)[0] || "";
  // A single letter or a number is not a name worth greeting with.
  return /^[A-Za-z][A-Za-z'-]{1,}$/.test(n) ? n.charAt(0).toUpperCase() + n.slice(1) : "there";
};

const BATCHES = [
  {
    file: "1-outreach",
    label: 'Inner Circle - "Bring the work in" (sales)',
    where: "inner_circle = 1 AND inner_circle_role = 'OUTREACH'",
  },
  {
    file: "2-tech",
    label: 'Inner Circle - "Build the work"',
    where: "inner_circle = 1 AND inner_circle_role = 'TECH'",
  },
  {
    file: "3-undecided",
    label: 'Inner Circle - "Not sure yet"',
    where:
      "inner_circle = 1 AND (inner_circle_role IS NULL OR inner_circle_role NOT IN ('TECH','OUTREACH'))",
  },
  {
    file: "4-rest",
    label: "Waitlist, did not opt into the Inner Circle",
    where: "coalesce(inner_circle, 0) = 0",
  },
];

mkdirSync(OUT, { recursive: true });
console.log("Exporting waitlist by sending batch\n");

let running = 0;
for (const b of BATCHES) {
  // Newest first inside each batch: a signup from last week remembers ticking
  // the box, and a warm opener protects the colder addresses behind them.
  const rows = await sql(
    `SELECT email, name, college, intent, created_at
       FROM waitlist
      WHERE ${b.where}
        AND email LIKE '%_@_%.__%'
      ORDER BY created_at DESC`,
  );

  const csv = [
    "EMAIL,FIRSTNAME,COLLEGE,SEGMENT",
    ...rows.map((r) =>
      [cell(r.email.trim().toLowerCase()), cell(firstName(r.name)), cell(r.college), cell(b.file)].join(","),
    ),
  ].join("\n");

  writeFileSync(`${OUT}/${b.file}.csv`, csv + "\n", "utf8");
  running += rows.length;
  console.log(`  ${b.file.padEnd(12)} ${String(rows.length).padStart(5)}  ${b.label}`);
}

console.log(`\n  ${"TOTAL".padEnd(12)} ${String(running).padStart(5)}`);
console.log(`\nWritten to ${OUT}/ (gitignored).`);
console.log(
  "\nNEXT, in Brevo — not through the transactional API:\n" +
    "  1. Contacts -> Import, one list per CSV, same order as the files.\n" +
    "  2. Campaigns -> Email -> send to ONE list at a time.\n" +
    "  3. Wait a day between batches and check bounces and complaints.\n" +
    "\nUse the campaign UI because it attaches the unsubscribe link you are\n" +
    "legally required to include and the codebase has nowhere else to get.\n" +
    "The transactional API does not add one.",
);
