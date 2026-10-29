// The middleware's two lists and the matching between them.
//
// Exists because of a merge: one branch put '/inner-circle' into
// PROTECTED_ROUTES for the member workspace, the other put the Round 1 sales
// portal under /inner-circle/sales/round-1 with its own D1 login. Merged, the
// prefix match bounced every candidate -- none of whom has a Supabase account
// -- to /login. The build was green, 182 tests passed, and it was found live.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROTECTED_ROUTES,
  MAINTENANCE_PUBLIC,
  SELF_AUTHENTICATING,
  isProtectedPath,
  isMaintenancePublic,
} from "../../lib/routeGuards.ts";

test("the Round 1 portal is never sent to the Supabase login", () => {
  for (const p of [
    "/inner-circle/sales/round-1",
    "/inner-circle/sales/round-1/dashboard",
    "/inner-circle/sales/round-1/abc123token",
    "/inner-circle/sales/round-1/switch-to-tech/abc123token",
  ]) {
    assert.equal(isProtectedPath(p), false, `${p} must not be gated`);
  }
});

test("the member workspace and the app still are", () => {
  for (const p of ["/inner-circle", "/inner-circle/earnings", "/inner-circle/work", "/app", "/app/briefs", "/dashboard", "/admin"]) {
    assert.equal(isProtectedPath(p), true, `${p} must be gated`);
  }
});

test("public pages are not gated", () => {
  for (const p of ["/", "/pricing", "/contact", "/login", "/login/inner-circle-sales", "/maintenance"]) {
    assert.equal(isProtectedPath(p), false, `${p} must not be gated`);
  }
});

test("a self-authenticating surface is pointless unless it also survives the hold", () => {
  for (const p of SELF_AUTHENTICATING) {
    assert.equal(isMaintenancePublic(p), true, `${p} is exempt from auth but held by maintenance`);
  }
});

test("every self-authenticating entry actually overrides a protected prefix", () => {
  // Otherwise the exception is dead text and the next person deletes it.
  for (const p of SELF_AUTHENTICATING) {
    assert.ok(PROTECTED_ROUTES.some((r) => p.startsWith(r)), `${p} shadows no protected route`);
  }
});

test("what must run during the hold, does", () => {
  for (const p of [
    "/",
    "/maintenance",
    "/api/waitlist",
    "/api/webhooks/razorpay",
    "/app",
    "/inner-circle/sales/round-1",
    "/api/inner-circle/round1/login",
    "/login/inner-circle-sales",
    "/admin",
    "/login", // or no admin can sign in to reach /admin
    "/verify", // ...and OTP is the only sign-in method, so the code box too
    "/auth/callback",
    "/api/admin/inner-circle-round1/invite",
    "/api/cron/inner-circle-round1-nudge",
  ]) {
    assert.equal(isMaintenancePublic(p), true, `${p} must be reachable while held`);
  }
  // /auth-transfer installs a session from query-string tokens; a bare '/auth'
  // prefix once let it through the hold by accident.
  for (const p of ["/dashboard", "/feed", "/u/someone", "/talent", "/inner-circle", "/inner-circle/earnings", "/auth-transfer"]) {
    assert.equal(isMaintenancePublic(p), false, `${p} must be held`);
  }
});

test("the whole OTP sign-in path survives the hold, or /login alone is theatre", () => {
  // Supabase here is email-OTP only, so every sign-in is /login -> emailed
  // code -> /verify. Opening /login and not /verify left an admin holding a
  // code with nowhere to type it. /auth is the Google callback.
  for (const p of ["/login", "/verify", "/auth/callback"]) {
    assert.equal(isMaintenancePublic(p), true, `${p} must survive the hold`);
  }
});

test("matching is segment-aware, so a prefix cannot open its neighbour", () => {
  // The two that bit: '/verify' must not open the KYC upload, and '/auth'
  // must not open the page that installs a session from query-string tokens.
  assert.equal(isMaintenancePublic("/verify-id"), false, "/verify-id (KYC) must stay held");
  assert.equal(isMaintenancePublic("/auth-transfer"), false, "/auth-transfer must stay held");
  assert.equal(isProtectedPath("/verify-id"), true, "/verify-id is still gated");
  // Same rule in the other direction: a longer path under an entry matches.
  assert.equal(isMaintenancePublic("/login/inner-circle-sales"), true);
  assert.equal(isProtectedPath("/gig/abc123"), true);
  // ...and a route that merely starts with the same letters does not.
  assert.equal(isProtectedPath("/application-status"), false, "'/app' must not swallow /application-status");
});

test("no duplicate entries in either list", () => {
  for (const [name, list] of [["PROTECTED_ROUTES", PROTECTED_ROUTES], ["MAINTENANCE_PUBLIC", MAINTENANCE_PUBLIC]]) {
    assert.equal(new Set(list).size, list.length, `${name} has a duplicate`);
  }
});
