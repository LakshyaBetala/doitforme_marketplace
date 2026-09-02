// Pins the shape of the HTTP surface.
//
// Every file under app/**/route.ts is a public endpoint the moment it is
// committed, whether or not anything in the UI calls it. Four of them were
// reachable and wrong:
//
//   /api/escrow/refund      a self-serve refund. The product rule is that money
//                           only comes back through a dispute an admin has
//                           reviewed; this let a poster claw funded escrow back
//                           with one request, after delivery, with no record.
//   /api/escrow/cancel      moved a funded gig to `cancellation_requested`, a
//                           status no admin screen can act on — escrow frozen
//                           with no exit. app/api/gig/delete already cancels
//                           correctly and refuses when funds are in play.
//   /api/gig/update-price   rewrote gigs.price with no status or payment_status
//                           check, so the amount could move after escrow was
//                           funded and the dispute split would compute against
//                           a number nobody had agreed to.
//   /cron/auto-release      a near-copy of the wired cron that called
//                           release_escrow_transactional, which does not insert
//                           the payout_queue row — the exact bug that left the
//                           queue empty database-wide.
//
// None had a single caller. They were found by auditing the route list, not by
// anything failing, so the check belongs here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

function routeFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, acc);
    else if (entry === "route.ts" || entry === "route.tsx") acc.push(full);
  }
  return acc;
}

const routes = routeFiles(path.join(root, "app")).map((f) =>
  path.relative(root, f).split(path.sep).join("/")
);

test("no self-serve refund endpoint exists", () => {
  const offenders = routes.filter((r) => /escrow\/refund/.test(r));
  assert.deepEqual(
    offenders,
    [],
    "Refunds go through /api/admin/resolve-dispute only. See CLAUDE.md."
  );
});

test("no escrow cancel endpoint reintroduces cancellation_requested", () => {
  const offenders = routes.filter((r) => /escrow\/cancel/.test(r));
  assert.deepEqual(offenders, [], "Use /api/gig/delete, which refuses when funds are held.");
});

test("no endpoint rewrites gig price outside the offer flow", () => {
  const offenders = routes.filter((r) => /gig\/update-price/.test(r));
  assert.deepEqual(
    offenders,
    [],
    "Price is negotiated through /api/gig/accept-offer, which checks gig state."
  );
});

test("auto-release exists exactly once, under /api", () => {
  const found = routes.filter((r) => /auto-release/.test(r));
  assert.deepEqual(
    found,
    ["app/api/cron/auto-release/route.ts"],
    "A second copy drifts from the scheduled one and releases without queuing a payout."
  );
});

test("nothing but the wired cron calls release_escrow_transactional", () => {
  const callers = routes.filter((r) =>
    readFileSync(path.join(root, r), "utf8").includes("release_escrow_transactional")
  );
  // refund_escrow_transactional is a different function; match the release one
  // only when it is not preceded by "refund_".
  const real = callers.filter((r) =>
    /(?<!refund_)\brelease_escrow_transactional/.test(readFileSync(path.join(root, r), "utf8"))
  );
  assert.deepEqual(
    real,
    [],
    "Releasing escrow is manual_release_escrow — it is the only path that inserts payout_queue."
  );
});

test("every route handler authenticates or checks a shared secret", () => {
  const exempt = new Set([
    "app/api/moderation/route.ts", // fails open by design, no data access
    "app/api/auth/check-username/route.ts", // availability probe, no PII returned
    "app/api/telegram/webhook/route.ts", // verified by bot-token path secrecy
    "app/auth/callback/route.ts", // the OAuth exchange itself
  ]);

  const unguarded = routes.filter((r) => {
    if (exempt.has(r)) return false;
    const src = readFileSync(path.join(root, r), "utf8");
    return !/getUser\(\)|isAdminEmail|CRON_SECRET|ADMIN_SECRET|WEBHOOK_SECRET|PUSH_DISPATCH_SECRET|verifyRazorpaySignature/.test(
      src
    );
  });

  assert.deepEqual(unguarded, [], "These handlers take no caller identity at all.");
});
