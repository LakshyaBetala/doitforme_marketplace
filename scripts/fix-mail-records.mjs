// Three mail-record faults found by auditing the zone through the API rather
// than through a DNS lookup — two of them are invisible to `dig`.
//
// 1. email.doitforme.in is PROXIED (orange cloud). Cloudflare's proxy is an
//    HTTP reverse proxy: it answers the name with Cloudflare's own addresses
//    and only speaks HTTP/HTTPS. A mail client told to reach webmail or IMAP
//    at that name gets Cloudflare, not GoDaddy, and the connection fails in a
//    way that looks like "the server is down". A DNS lookup cannot reveal
//    this, because the proxied answer looks like a perfectly ordinary record.
//
// 2. Five Google MX records sit alongside GoDaddy's. The lowest priority wins
//    and GoDaddy is 0, so Google receives nothing — but the records remain,
//    and the day GoDaddy's record is touched mail silently moves to a mailbox
//    nobody reads. Two mail hosts for one domain is ambiguity, not redundancy.
//
// 3. The autodiscover SRV is missing, so Outlook cannot configure an account
//    from the address alone.
//
// NOT touched: send.doitforme.in MX -> feedback-smtp.us-east-1.amazonses.com.
// That is on a SUBDOMAIN, not the root, so it does not compete for inbound
// mail. It is SES's bounce handler and is harmless where it sits; if SES is
// adopted later it is already correct.
//
//   node scripts/fix-mail-records.mjs          # dry run
//   node scripts/fix-mail-records.mjs --apply

import { readFileSync, existsSync } from "node:fs";

const TOKEN_FILE = "scratchpad/.cf-token";
const TOKEN =
  process.env.CLOUDFLARE_API_TOKEN ||
  (existsSync(TOKEN_FILE) ? readFileSync(TOKEN_FILE, "utf8").trim() : "");
const ZONE_NAME = "doitforme.in";
const APPLY = process.argv.includes("--apply");

if (!TOKEN) {
  console.error(`No token. Save one to ${TOKEN_FILE}.`);
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
  if (!body.success) throw new Error(JSON.stringify(body.errors || body));
  return body.result;
};

const [zone] = await api(`/zones?name=${ZONE_NAME}`);
if (!zone) {
  console.error(`No zone ${ZONE_NAME} on this token's account.`);
  process.exit(1);
}
const all = await api(`/zones/${zone.id}/dns_records?per_page=500`);
const plan = [];

// 1 — un-proxy the mail hostname
const emailRec = all.find((r) => r.name === `email.${ZONE_NAME}` && r.type === "CNAME");
if (emailRec?.proxied) {
  plan.push({
    act: "unproxy",
    id: emailRec.id,
    label: `CNAME email.${ZONE_NAME}`,
    detail: "turn OFF the orange cloud — a mail host must not go through an HTTP proxy",
    payload: { type: "CNAME", name: emailRec.name, content: emailRec.content, ttl: 300, proxied: false },
  });
}

// 2 — one mail host at the root
const rootMx = all.filter((r) => r.type === "MX" && r.name === ZONE_NAME);
const keep = rootMx.filter((r) => /secureserver\.net\.?$/i.test(r.content));
const drop = rootMx.filter((r) => !/secureserver\.net\.?$/i.test(r.content));
if (!keep.length && drop.length) {
  console.error("REFUSING: no GoDaddy MX at the root to keep — that would leave no mail host.");
  process.exit(1);
}
for (const r of drop) {
  plan.push({
    act: "delete",
    id: r.id,
    label: `MX ${r.priority} ${r.content}`,
    detail: "Google MX — receives nothing behind GoDaddy's priority 0",
  });
}

// 3 — autodiscover
if (!all.some((r) => r.type === "SRV" && r.name === `_autodiscover._tcp.${ZONE_NAME}`)) {
  plan.push({
    act: "create",
    label: `SRV _autodiscover._tcp.${ZONE_NAME}`,
    detail: "lets Outlook configure an account from the address alone",
    payload: {
      type: "SRV",
      name: `_autodiscover._tcp.${ZONE_NAME}`,
      data: {
        service: "_autodiscover",
        proto: "_tcp",
        name: ZONE_NAME,
        priority: 100,
        weight: 1,
        port: 443,
        target: "autodiscover.secureserver.net",
      },
      ttl: 300,
    },
  });
}

console.log(`zone ${zone.name}\n`);
console.log(`root MX: keeping ${keep.length} (GoDaddy/Titan), removing ${drop.length} (Google)\n`);
if (!plan.length) {
  console.log("Nothing to change.");
  process.exit(0);
}
console.log(`PLAN (${plan.length}):`);
for (const p of plan) {
  console.log(`  ${p.act.toUpperCase().padEnd(8)} ${p.label}`);
  console.log(`           ${p.detail}`);
}
console.log(
  "\nLeft alone: MX send.doitforme.in -> feedback-smtp.us-east-1.amazonses.com\n" +
    "  It is on a subdomain, so it does not compete for inbound mail at the root.",
);

if (!APPLY) {
  console.log("\nDry run. Nothing changed. Re-run with --apply.");
  process.exit(0);
}

console.log("\napplying...");
for (const p of plan) {
  if (p.act === "delete") {
    await api(`/zones/${zone.id}/dns_records/${p.id}`, { method: "DELETE" });
  } else if (p.act === "unproxy") {
    await api(`/zones/${zone.id}/dns_records/${p.id}`, {
      method: "PUT",
      body: JSON.stringify(p.payload),
    });
  } else {
    await api(`/zones/${zone.id}/dns_records`, { method: "POST", body: JSON.stringify(p.payload) });
  }
  console.log(`  ${p.act} ok  ${p.label}`);
}
console.log("\ndone.");
