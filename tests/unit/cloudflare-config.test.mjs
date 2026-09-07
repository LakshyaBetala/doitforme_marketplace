// Guards the Cloudflare deployment config the way vercel-config.test.mjs guards
// vercel.json.
//
// The failure this prevents: a cron schedule that fires into nothing. The cron
// Worker maps each cron expression to an app route, and wrangler.jsonc lists the
// expressions separately. If the two drift — a schedule added in one and not the
// other, or a route renamed — the job silently never runs and nobody finds out
// until escrow stops auto-releasing. That is exactly how payout_queue ended up
// empty database-wide once already.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

/** wrangler.jsonc allows comments; strip them before JSON.parse. */
function readJsonc(file) {
  const raw = readFileSync(file, "utf8");
  const noComments = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
  return JSON.parse(noComments);
}

const appConfig = readJsonc(path.join(root, "wrangler.jsonc"));
const cronConfigPath = path.join(root, "workers", "cron", "wrangler.jsonc");
const cronConfig = readJsonc(cronConfigPath);
const cronSource = readFileSync(path.join(root, "workers", "cron", "src", "index.ts"), "utf8");

test("app worker points at the OpenNext build output", () => {
  assert.equal(appConfig.main, ".open-next/worker.js");
  assert.equal(appConfig.assets?.directory, ".open-next/assets");
});

test("app worker has nodejs_compat", () => {
  // Without it, node:crypto (Razorpay HMAC) and web-push both fail at runtime.
  assert.ok(
    appConfig.compatibility_flags?.includes("nodejs_compat"),
    "nodejs_compat is required by lib/razorpay.ts and lib/push.ts"
  );
});

test("the self-reference service binding matches the worker name", () => {
  const selfRef = (appConfig.services || []).find((s) => s.binding === "WORKER_SELF_REFERENCE");
  assert.ok(selfRef, "WORKER_SELF_REFERENCE binding is required for caching");
  assert.equal(
    selfRef.service,
    appConfig.name,
    "the self-reference service name must equal the worker name or cache writes fail"
  );
});

test("every cron schedule is mapped to a route in the cron worker", () => {
  const schedules = cronConfig.triggers?.crons || [];
  assert.ok(schedules.length > 0, "no cron triggers configured");

  for (const cron of schedules) {
    assert.ok(
      cronSource.includes(`"${cron}"`),
      `wrangler.jsonc schedules "${cron}" but workers/cron/src/index.ts has no route for it`
    );
  }
});

test("every route the cron worker calls exists as a handler", () => {
  const paths = [...cronSource.matchAll(/"(\/api\/cron\/[a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(paths.length > 0, "cron worker maps no routes");

  for (const p of paths) {
    const handler = path.join(root, "app", ...p.split("/").filter(Boolean), "route.ts");
    assert.ok(existsSync(handler), `${p} is scheduled but ${path.relative(root, handler)} does not exist`);
  }
});

test("each mapped route is scheduled exactly once", () => {
  const paths = [...cronSource.matchAll(/"(\/api\/cron\/[a-z-]+)"/g)].map((m) => m[1]);
  const dupes = paths.filter((p, i) => paths.indexOf(p) !== i);
  assert.deepEqual(dupes, [], "a route scheduled twice runs twice and double-processes the queue");
});

test("auto-release runs more often than daily", () => {
  // The whole point of leaving Vercel Hobby. The product promises a 24h
  // auto-release; a once-a-day job made the real worst case ~48h.
  const schedules = cronConfig.triggers?.crons || [];
  const autoRelease = schedules.find(
    (c) => cronSource.split(`"${c}"`)[1]?.includes("auto-release")
  );
  assert.ok(autoRelease, "auto-release has no schedule");
  assert.match(
    autoRelease,
    /^\*\/\d+ /,
    `auto-release is scheduled "${autoRelease}" — it should use a */N minute step`
  );
});
