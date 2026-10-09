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
    // Public on purpose, and only while Supabase is restricted. It is the
    // signup form on /maintenance — the visitor has no account and no session
    // to authenticate with, which is the entire reason the endpoint exists.
    // It writes to Cloudflare D1, never to Supabase, stores no password, and
    // the unique index on lower(email) bounds what one address can create.
    // DELETE THIS LINE when maintenance mode ends and the route is removed.
    "app/api/waitlist/route.ts",
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

// Authenticate before validating the body — as a RULE, not as one example.
//
// /api/payments/verify-payment checked its body first, so an anonymous caller
// got `400 Missing fields` instead of `401`: that answer confirms the endpoint
// exists and names what to send next. It was fixed, and pinned in
// tests/uat-readiness.spec.ts — for that one route. Five others were doing the
// same thing and nothing noticed, because the pin was an example rather than a
// rule:
//
//   /api/escrow/release        400 "Missing gigId"
//   /api/gig/dispute           400 "gigId and reason are required"
//   /api/gig/request-changes   400 "gigId and feedback are required"
//   /api/referral/apply        400 "Missing referralCode"
//   /api/referral/redeem       400 "Missing required fields"
//
// All five were still safe — authorization ran before anything happened — so
// this was disclosure, not a breach. They were found by probing production
// after a deploy, which is later than a test should find it.
//
// Scoped to FIELD-VALIDATION 400s on purpose. A 400 for malformed JSON has to
// precede auth (you cannot read a body you cannot parse) and names no fields,
// so app/api/gig/complete is not an offender.
test("no handler returns a field-validation 400 before it authenticates", () => {
  const AUTH =
    /auth\.getUser\(\)|isAdminEmail|CRON_SECRET|ADMIN_SECRET|WEBHOOK_SECRET|PUSH_DISPATCH_SECRET|verifyRazorpaySignature/;

  const offenders = [];
  for (const r of routes) {
    const src = readFileSync(path.join(root, r), "utf8");
    const auth = src.search(AUTH);
    if (auth === -1) continue;

    for (const m of src.matchAll(/status:\s*400/g)) {
      if (m.index > auth) continue;
      // Look back at the response this 400 belongs to. "required" / "missing"
      // is the shape that describes the schema to a stranger.
      const context = src.slice(Math.max(0, m.index - 220), m.index);
      if (/\b(required|missing)\b/i.test(context)) {
        offenders.push(`${r} -> ${(context.match(/["'`]([^"'`]{0,70}(?:required|missing)[^"'`]{0,70})["'`]/i) || [, "?"])[1]}`);
        break;
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "These answer an unauthenticated caller with the field names they need."
  );
});
