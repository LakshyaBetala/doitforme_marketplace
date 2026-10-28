// Pushes runtime secrets from .env.local into a Cloudflare Worker.
//
// `wrangler secret put X` prompts for a value on stdin, so setting a dozen of
// them by hand is a dozen prompts and a dozen chances to paste the wrong thing
// into the wrong key. This pipes each value in instead.
//
// NEXT_PUBLIC_* are deliberately NOT sent: they are inlined into the client
// bundle at build time and only need to be in .env.local when `cf:build` runs.
// Sending them as Worker secrets would imply they are private, which they are
// not — they ship inside every page.
//
//   node scripts/cf-set-secrets.mjs            # dry run: names only
//   node scripts/cf-set-secrets.mjs --apply    # actually set them
//   node scripts/cf-set-secrets.mjs --apply --config workers/cron/wrangler.jsonc
//
// Values are never printed, only key names and lengths.

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const cfgIdx = argv.indexOf("--config");
const CONFIG = cfgIdx !== -1 ? argv[cfgIdx + 1] : null;

// Runtime secrets the app Worker needs. Anything absent from .env.local is
// reported rather than silently skipped — a missing RAZORPAY_WEBHOOK_SECRET
// means the webhook route refuses to run at all.
const APP_SECRETS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "CRON_SECRET",
  // ADMIN_SECRET is deliberately absent. README and CLAUDE.md still list it as
  // required, but `grep -rn ADMIN_SECRET app lib` returns nothing — admin auth
  // goes through isAdminEmail() in lib/admins.ts and the SQL is_admin(). It is a
  // stale variable, not a missing one.
  "TELEGRAM_BOT_TOKEN",
  "GEMINI_API_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "PUSH_DISPATCH_SECRET",
  "BREVO_API_KEY",
  "ZEPTOMAIL_TOKEN",
  "RESEND_API_KEY",
];

// The cron Worker calls the app's own HTTP endpoints, so it needs only the
// shared secret those endpoints check.
const CRON_SECRETS = ["CRON_SECRET"];

const wanted = CONFIG?.includes("cron") ? CRON_SECRETS : APP_SECRETS;
const target = CONFIG?.includes("cron") ? "doitforme-cron" : "doitforme1 (app)";

if (!existsSync(".env.local")) {
  console.error("No .env.local in the current directory. Run this from the repo root.");
  process.exit(1);
}

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const present = wanted.filter((k) => env[k]);
const missing = wanted.filter((k) => !env[k]);

console.log(`\nTarget: ${target}`);
console.log(`Source: .env.local\n`);

for (const k of present) console.log(`  set     ${k.padEnd(28)} (${env[k].length} chars)`);

// Email is a special case: lib/email.ts auto-detects the provider from
// whichever key is present, so exactly one of the three is enough.
const emailKeys = ["BREVO_API_KEY", "ZEPTOMAIL_TOKEN", "RESEND_API_KEY"];
const optional = new Set([...emailKeys, "ZEPTOMAIL_TOKEN"]);

for (const k of missing) {
  const soft = optional.has(k);
  console.log(`  ${soft ? "skip   " : "MISSING"} ${k.padEnd(28)} ${soft ? "(not in .env.local)" : "<-- required"}`);
}

if (wanted.includes("BREVO_API_KEY") && !emailKeys.some((k) => env[k])) {
  console.log(
    "\n  ! No email provider key found. Transactional email will no-op:\n" +
      "    payment, dispute and KYC notices will not be sent.\n" +
      "    Set one of BREVO_API_KEY / ZEPTOMAIL_TOKEN / RESEND_API_KEY."
  );
}

const hardMissing = missing.filter((k) => !optional.has(k));
if (hardMissing.length) {
  console.log(`\n  ${hardMissing.length} required secret(s) are not in .env.local.`);
}

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to push these to Cloudflare.\n");
  process.exit(0);
}

console.log("");
let ok = 0;
let failed = 0;

for (const k of present) {
  const args = ["wrangler", "secret", "put", k];
  if (CONFIG) args.push("--config", CONFIG);

  const res = spawnSync("npx", args, {
    input: env[k],
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (res.status === 0) {
    console.log(`  ok      ${k}`);
    ok++;
  } else {
    // stderr, not the value — never echo a secret on failure.
    console.error(`  FAILED  ${k}: ${(res.stderr || "").trim().split("\n").slice(-2).join(" ")}`);
    failed++;
  }
}

console.log(`\n${ok} set, ${failed} failed.`);
if (failed) {
  console.log("Not logged in? Run: npx wrangler login");
  process.exit(1);
}
console.log("Verify with: npx wrangler secret list" + (CONFIG ? ` --config ${CONFIG}` : "") + "\n");
