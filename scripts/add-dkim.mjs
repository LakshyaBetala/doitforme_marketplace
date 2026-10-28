// Publish the GoDaddy/Titan DKIM CNAMEs, and the mail CNAME + autodiscover SRV.
//
// These come from GoDaddy's own "verify your DNS" page. They are per-domain
// values, which is why they could not be guessed.
//
// WHAT THIS DELIBERATELY DOES NOT DO, even though the same GoDaddy page asks
// for it:
//
//   SPF   -> "v=spf1 include:secureserver.net -all"
//   DMARC -> "p=reject"
//
// Both would break this product. That SPF authorises GoDaddy's servers and
// nothing else, and `-all` tells receivers to REJECT everything from anyone
// else — which is Brevo, the sender of all 19 transactional templates: KYC
// approvals, payment receipts, dispute notices, payout alerts. Pairing it with
// p=reject turns a soft failure into hard rejection. GoDaddy's checker only
// knows about GoDaddy; it is right that the domain had two SPF records and
// wrong about which one to keep.
//
// The live SPF already covers Google, Brevo, Titan and GoDaddy together, which
// is what GoDaddy's page is actually testing for when it says "are your emails
// sending properly".
//
//   node scripts/add-dkim.mjs          # dry run
//   node scripts/add-dkim.mjs --apply

import { readFileSync, existsSync } from "node:fs";

const TOKEN_FILE = "scratchpad/.cf-token";
const TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8").trim() : "");
const ZONE_NAME = "doitforme.in";
const APPLY = process.argv.includes("--apply");

if (!TOKEN) {
  console.error(`No token. Save one to ${TOKEN_FILE} (Zone:Read + Zone:DNS:Edit).`);
  process.exit(1);
}

// Trailing dots removed: Cloudflare stores the target without one.
const WANT = [
  {
    type: "CNAME",
    name: `secureserver1._domainkey.${ZONE_NAME}`,
    content: "s1.dkim.doitforme_in.d63.onsecureserver.net",
    why: "DKIM key 1 — signs outbound Titan mail",
  },
  {
    type: "CNAME",
    name: `secureserver2._domainkey.${ZONE_NAME}`,
    content: "s2.dkim.doitforme_in.d63.onsecureserver.net",
    why: "DKIM key 2 — rotation partner for key 1",
  },
  {
    type: "CNAME",
    name: `email.${ZONE_NAME}`,
    content: "email.secureserver.net",
    why: "webmail hostname GoDaddy expects",
  },
  {
    type: "SRV",
    name: `_autodiscover._tcp.${ZONE_NAME}`,
    // Outlook and friends read this to configure an account from the address
    // alone. Without it every client has to be set up by hand.
    data: {
      service: "_autodiscover",
      proto: "_tcp",
      name: ZONE_NAME,
      priority: 100,
      weight: 1,
      port: 443,
      target: "autodiscover.secureserver.net",
    },
    why: "autodiscover, so mail clients configure themselves",
  },
];

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
  if (!body.success) throw new Error(JSON.stringify(body.errors || body));
  return body.result;
};

const [zone] = await api(`/zones?name=${ZONE_NAME}`);
if (!zone) {
  console.error(`No zone ${ZONE_NAME} on this token's account.`);
  process.exit(1);
}

const existing = await api(`/zones/${zone.id}/dns_records?per_page=500`);
const plan = [];

for (const w of WANT) {
  const found = existing.find((r) => r.name === w.name && r.type === w.type);
  const target = w.type === "SRV" ? w.data.target : w.content;
  if (!found) {
    plan.push({ act: "create", ...w, target });
  } else {
    const current = w.type === "SRV" ? found.data?.target : found.content;
    if (String(current).replace(/\.$/, "") !== target) {
      plan.push({ act: "update", id: found.id, ...w, target, was: current });
    }
  }
}

console.log(`zone ${zone.name}\n`);
if (!plan.length) {
  console.log("Nothing to change — all four records already match.");
  process.exit(0);
}
console.log(`PLAN (${plan.length} change${plan.length === 1 ? "" : "s"}):`);
for (const p of plan) {
  console.log(`  ${p.act.toUpperCase().padEnd(6)} ${p.type.padEnd(5)} ${p.name}`);
  console.log(`         -> ${p.target}${p.was ? `   (was ${p.was})` : ""}`);
  console.log(`         ${p.why}`);
}

console.log(
  "\nNOT changing SPF or DMARC, though the same GoDaddy page asks for it:\n" +
    "  Their SPF authorises GoDaddy alone with -all, which would make receivers\n" +
    "  REJECT every Brevo message — all 19 transactional templates, including\n" +
    "  KYC approvals, payment receipts and dispute notices. With p=reject on top\n" +
    "  there is no soft landing. The SPF already live covers Google, Brevo,\n" +
    "  Titan and GoDaddy together, which is what that page is really checking.",
);

if (!APPLY) {
  console.log("\nDry run. Nothing changed. Re-run with --apply.");
  process.exit(0);
}

console.log("\napplying...");
for (const p of plan) {
  const payload =
    p.type === "SRV"
      ? { type: "SRV", name: p.name, data: p.data, ttl: 300 }
      : { type: p.type, name: p.name, content: p.content, ttl: 300, proxied: false };
  if (p.act === "create") {
    await api(`/zones/${zone.id}/dns_records`, { method: "POST", body: JSON.stringify(payload) });
  } else {
    await api(`/zones/${zone.id}/dns_records/${p.id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }
  console.log(`  ${p.act} ok  ${p.name}`);
}
console.log("\ndone. DKIM can take up to an hour to be seen by receivers.");
