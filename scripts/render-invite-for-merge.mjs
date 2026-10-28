// Render the Round 1 invite letter as paste-ready HTML for a campaign tool.
//
// WHY. Invites should go out through a campaign tool (Sender.net), not through
// lib/email.ts: 1,081 invites through Brevo's free 300/day would eat the same
// allowance the portal's 24-hour reminders depend on, and a campaign tool adds
// the one-click unsubscribe Gmail and Yahoo now require of bulk mail. But the
// letter lives in code. This renders the real template -- same render(), same
// wrap() that production sends -- with placeholders where the per-person
// values go, so the copy in the campaign tool cannot drift from the code.
//
//   npx tsx scripts/render-invite-for-merge.mjs
//
// Writes scratchpad/round1-invite-merge.html (gitignored). No personal data:
// the placeholders are swapped for the campaign tool's merge fields, which
// come from the export-invites CSV (columns invite_url, switch_to_tech_url,
// name).

import { writeFileSync, mkdirSync } from "node:fs";
import { render, wrap } from "../lib/email.ts";

const TOKEN = "__ROUND1_TOKEN__";
const NAME = "__FIRST_NAME__";
// Floor, not a live count: "1,300 of you" stays true as the list grows.
const TOTAL_COHORT = 1300;

let html = wrap(
  render("inner_circle_round1_invite", {
    to: "placeholder@example.com",
    recipientName: NAME,
    extra: { token: TOKEN, totalCohort: TOTAL_COHORT },
  }),
);
const subject = render("inner_circle_round1_invite", {
  to: "x@example.com", recipientName: NAME, extra: { token: TOKEN, totalCohort: TOTAL_COHORT },
}).subject;

const SITE = "https://doitforme.in/inner-circle/sales/round-1";
const swaps = [
  [`${SITE}/switch-to-tech/${TOKEN}`, "[[SWITCH_TO_TECH_URL]]"], // longer one first
  [`${SITE}/${TOKEN}`, "[[INVITE_URL]]"],
  [NAME, "[[NAME]]"],
];
const counts = {};
for (const [from, to] of swaps) {
  counts[to] = html.split(from).length - 1;
  html = html.split(from).join(to);
}

// Self-check: every per-person value must have been replaced, and the token
// placeholder must not survive anywhere -- a leftover would ship a dead link.
if (html.includes(TOKEN)) throw new Error("token placeholder survived; a URL shape changed in lib/email.ts");
if (!counts["[[INVITE_URL]]"]) throw new Error("no invite link found to replace");

mkdirSync("scratchpad", { recursive: true });
writeFileSync("scratchpad/round1-invite-merge.html", html);
console.log(`subject: ${subject}`);
console.log("placeholders replaced:", counts);
console.log("written: scratchpad/round1-invite-merge.html");
