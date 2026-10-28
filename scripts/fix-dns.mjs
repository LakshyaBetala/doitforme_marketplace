// Repair the doitforme.in mail DNS at Cloudflare.
//
// WHY THIS EXISTS. Setting up Titan through GoDaddy left the zone with TWO SPF
// records and TWO DMARC records. Per RFC 7208 §4.5, a domain publishing more
// than one SPF record produces a PERMERROR — the receiver does not pick one,
// it gives up. So SPF is currently failing for every message the domain sends,
// through Brevo, Google and Titan alike. Same story for duplicate DMARC.
//
// That matters now because the warm list is 1,320 people who ticked "put me
// forward" on the hold page. Mailing them while SPF permerrors is the worst
// possible first impression and the fastest way to teach inboxes to distrust
// the domain.
//
// SAFE BY DEFAULT: prints a plan and changes nothing. Pass --apply to write.
//
//   $env:CLOUDFLARE_API_TOKEN = "..."       # needs Zone:Read + Zone:DNS:Edit
//   node scripts/fix-dns.mjs                # dry run, shows the plan
//   node scripts/fix-dns.mjs --apply        # make the changes
//
// Options:
//   --no-google    drop include:_spf.google.com (use if Workspace no longer sends)
//   --no-godaddy   drop include:secureserver.net
//   --dmarc-rua=<email>   address that receives DMARC reports

import { readFileSync, existsSync } from "node:fs";

/**
 * The token, from the environment or from a local file.
 *
 * NOT from .env.local, deliberately. Next loads that file for production
 * builds and @opennextjs/cloudflare bakes everything it loaded into the
 * deployed Worker — so a DNS-editing token placed there would ship inside the
 * bundle. CLAUDE.md records this trap costing a live secret once already.
 *
 * scratchpad/ is gitignored and nothing reads it at build time, so a token
 * there stays on this machine.
 */
const TOKEN_FILE = "scratchpad/.cf-token";
const TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8").trim() : "");
const ZONE_NAME = "doitforme.in";
const APPLY = process.argv.includes("--apply");
const rua =
  (process.argv.find((a) => a.startsWith("--dmarc-rua=")) || "").split("=")[1] ||
  "support@doitforme.in";

// SPF has a hard limit of 10 DNS lookups; over it is another permerror.
// Measured 2026-10-29: google 1, brevo 1, titan 4, secureserver 3 = 9 of 10.
// Titan is the mailbox (MX priority 0 is GoDaddy/Titan) and Brevo sends the
// product's transactional mail, so those two are not optional.
const INCLUDES = [
  ...(process.argv.includes("--no-google") ? [] : ["_spf.google.com"]),
  "spf.brevo.com",
  "spf.titan.email",
  ...(process.argv.includes("--no-godaddy") ? [] : ["secureserver.net"]),
];
// `~all` (softfail) rather than `-all`: the domain has no sending reputation
// yet and a hard fail on day one turns any forgotten sender into lost mail.
// Tighten to -all once reports show every legitimate source passing.
const SPF = `v=spf1 ${INCLUDES.map((i) => `include:${i}`).join(" ")} ~all`;
// p=quarantine, not reject, for the same reason.
const DMARC = `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:${rua};`;

if (!TOKEN) {
  console.error(
    "CLOUDFLARE_API_TOKEN is not set.\n\n" +
      "Create one at Cloudflare -> My Profile -> API Tokens -> Create Custom Token:\n" +
      "  Permissions:  Zone | Zone | Read\n" +
      "                Zone | DNS  | Edit\n" +
      `  Zone Resources: Include | Specific zone | ${ZONE_NAME}\n\n` +
      "Then either set $env:CLOUDFLARE_API_TOKEN, or save the token to\n" +
      `  ${TOKEN_FILE}   (gitignored, never read at build time)`,
  );
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await res.json();
  if (!body.success) {
    throw new Error(
      `${init.method || "GET"} ${path} -> ${JSON.stringify(body.errors || body)}`,
    );
  }
  return body.result;
};

const zones = await api(`/zones?name=${ZONE_NAME}`);
if (!zones.length) {
  console.error(
    `No zone named ${ZONE_NAME} on this token's account.\n` +
      "The token is probably scoped to a different Cloudflare account than the\n" +
      "one that owns the domain. Check which account holds doitforme.in.",
  );
  process.exit(1);
}
const zone = zones[0];
console.log(`zone ${zone.name}  id ${zone.id.slice(0, 8)}...  status ${zone.status}\n`);

const all = await api(`/zones/${zone.id}/dns_records?per_page=500`);
const txtAt = (name) =>
  all.filter((r) => r.type === "TXT" && r.name === name);

const root = txtAt(ZONE_NAME);
const dmarcName = `_dmarc.${ZONE_NAME}`;
const dmarcs = txtAt(dmarcName);
const spfs = root.filter((r) => r.content.replace(/"/g, "").startsWith("v=spf1"));

const plan = [];

// ---- SPF: exactly one record, with every sender in it -----------------------
if (spfs.length === 0) {
  plan.push({ act: "create", name: ZONE_NAME, content: SPF, why: "no SPF exists" });
} else {
  // Keep the first, rewrite it to the merged value, delete the rest. Keeping
  // one and editing it preserves the record id, so anything referencing it
  // keeps working and the change shows as an edit rather than a churn.
  const [keep, ...dupes] = spfs;
  if (keep.content.replace(/"/g, "") !== SPF) {
    plan.push({
      act: "update",
      id: keep.id,
      name: ZONE_NAME,
      content: SPF,
      why: `rewrite to cover all senders (was: ${keep.content.slice(0, 60)}...)`,
    });
  }
  for (const d of dupes) {
    plan.push({
      act: "delete",
      id: d.id,
      name: ZONE_NAME,
      content: d.content,
      why: "DUPLICATE SPF — this is what causes the permerror",
    });
  }
}

// ---- DMARC: exactly one record ---------------------------------------------
if (dmarcs.length === 0) {
  plan.push({ act: "create", name: dmarcName, content: DMARC, why: "no DMARC exists" });
} else {
  const [keep, ...dupes] = dmarcs;
  if (keep.content.replace(/"/g, "") !== DMARC) {
    plan.push({
      act: "update",
      id: keep.id,
      name: dmarcName,
      content: DMARC,
      why: `single DMARC, reports to ${rua}`,
    });
  }
  for (const d of dupes) {
    plan.push({
      act: "delete",
      id: d.id,
      name: dmarcName,
      content: d.content,
      why: "DUPLICATE DMARC — invalid, treated as none",
    });
  }
}

console.log(`SPF records found:   ${spfs.length}${spfs.length > 1 ? "  <-- PERMERROR" : ""}`);
console.log(`DMARC records found: ${dmarcs.length}${dmarcs.length > 1 ? "  <-- INVALID" : ""}`);
console.log(`\nTarget SPF   ${SPF}`);
console.log(`Target DMARC ${DMARC}\n`);

if (!plan.length) {
  console.log("Nothing to change — SPF and DMARC are already correct.");
} else {
  console.log(`PLAN (${plan.length} change${plan.length === 1 ? "" : "s"}):`);
  for (const p of plan) {
    console.log(`  ${p.act.toUpperCase().padEnd(6)} ${p.name}`);
    console.log(`         ${p.content.replace(/"/g, "").slice(0, 100)}`);
    console.log(`         reason: ${p.why}`);
  }
}

// ---- Things this script deliberately does NOT touch -------------------------
const mx = all.filter((r) => r.type === "MX").sort((a, b) => a.priority - b.priority);
console.log("\nNOT CHANGED — these need a decision, not a default:");
console.log("  MX records (inbound mail):");
for (const m of mx) console.log(`    ${String(m.priority).padStart(3)}  ${m.content}`);
if (mx.some((m) => /secureserver/.test(m.content)) && mx.some((m) => /google/.test(m.content))) {
  console.log(
    "    ^ BOTH Titan/GoDaddy and Google are listed. Priority 0 wins, so mail\n" +
      "      goes to Titan and the Google records are dead weight. Pick one and\n" +
      "      delete the other, or mail will keep landing somewhere you are not\n" +
      "      reading.",
  );
}
const titan = all.filter((r) => /titan\d?\._domainkey/.test(r.name));
if (!titan.length) {
  console.log(
    "  Titan DKIM: NOT PUBLISHED. Get the titan1/titan2 CNAME values from the\n" +
      "      Titan control panel and add them, or Titan mail stays unsigned.",
  );
}

// ---- MX: one mail host, chosen explicitly ----------------------------------
//
// Two providers in one MX set is not redundancy, it is ambiguity: the lowest
// priority wins and everything else is decoration that will one day receive a
// message nobody reads. --mx=titan keeps GoDaddy/Titan and removes the rest.
const MX_CHOICE = (process.argv.find((a) => a.startsWith("--mx=")) || "").split("=")[1];
const mxPlan = [];
if (MX_CHOICE === "titan") {
  const isTitan = (c) => /secureserver\.net\.?$/i.test(c);
  if (!mx.some((m) => isTitan(m.content))) {
    console.error("\nREFUSING --mx=titan: no secureserver MX found to keep. That would leave the domain with no mail host.");
    process.exit(1);
  }
  for (const m of mx) {
    // Keep GoDaddy/Titan. Amazon SES's feedback-smtp record is a bounce
    // handler for a sender nobody here uses, so it goes with the Google set.
    if (!isTitan(m.content)) mxPlan.push({ id: m.id, content: m.content, priority: m.priority });
  }
  console.log(`\nMX PLAN (--mx=titan): remove ${mxPlan.length}, keep GoDaddy/Titan`);
  for (const m of mxPlan) console.log(`  DELETE  ${String(m.priority).padStart(3)}  ${m.content}`);
}

if (!APPLY) {
  console.log("\nDry run. Nothing was changed. Re-run with --apply to make these changes.");
  process.exit(0);
}

console.log("\napplying...");
for (const p of plan) {
  if (p.act === "delete") {
    await api(`/zones/${zone.id}/dns_records/${p.id}`, { method: "DELETE" });
  } else if (p.act === "update") {
    await api(`/zones/${zone.id}/dns_records/${p.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content: p.content }),
    });
  } else {
    await api(`/zones/${zone.id}/dns_records`, {
      method: "POST",
      body: JSON.stringify({
        type: "TXT",
        name: p.name,
        content: p.content,
        ttl: 300,
      }),
    });
  }
  console.log(`  ${p.act} ok  ${p.name}`);
}
for (const m of mxPlan) {
  await api(`/zones/${zone.id}/dns_records/${m.id}`, { method: "DELETE" });
  console.log(`  mx delete ok  ${m.content}`);
}

console.log("\ndone. Verify in a minute or two with:");
console.log(
  `  curl -s -H 'accept: application/dns-json' "https://cloudflare-dns.com/dns-query?name=${ZONE_NAME}&type=TXT"`,
);
