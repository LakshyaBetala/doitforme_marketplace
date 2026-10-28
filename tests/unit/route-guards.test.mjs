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
    "/login?redirect_to=%2Fadmin",
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

test("no duplicate entries in either list", () => {
  for (const [name, list] of [["PROTECTED_ROUTES", PROTECTED_ROUTES], ["MAINTENANCE_PUBLIC", MAINTENANCE_PUBLIC]]) {
    assert.equal(new Set(list).size, list.length, `${name} has a duplicate`);
  }
});
