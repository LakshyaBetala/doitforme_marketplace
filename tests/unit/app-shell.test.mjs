import test from "node:test";
import assert from "node:assert/strict";
import {
  canUseApp,
  appRoleFor,
  activeTab,
  TABS,
  ROLE_TITLE,
  ROLE_BLURB,
} from "../../lib/appShell.ts";

/* -------------------------------------------------------------------------- */
/* The gate. The app being invite-only IS the product.                        */
/* -------------------------------------------------------------------------- */

test("a stranger cannot use the app", () => {
  assert.equal(canUseApp({}), false);
  assert.equal(appRoleFor({}), null);
  // The failure mode that would quietly destroy the tier: elite set, role not.
  // "Member of nothing in particular" must not be a surface.
  assert.equal(canUseApp({ isElite: true }), false);
  assert.equal(appRoleFor({ isElite: true }), null);
  // And a role without membership is an application, not an approval.
  assert.equal(canUseApp({ innerCircleRole: "TECH" }), false);
  assert.equal(appRoleFor({ innerCircleRole: "TECH" }), null);
  // Junk in the column must never resolve to a surface.
  assert.equal(appRoleFor({ isElite: true, innerCircleRole: "SUPERUSER" }), null);
  assert.equal(appRoleFor({ isElite: true, innerCircleRole: "" }), null);
});

test("members, PMs and admins get in", () => {
  assert.equal(appRoleFor({ isElite: true, innerCircleRole: "TECH" }), "TECH");
  assert.equal(appRoleFor({ isElite: true, innerCircleRole: "OUTREACH" }), "OUTREACH");
  // A PM or admin is in by virtue of running it, with no is_elite flag.
  assert.equal(appRoleFor({ isPm: true }), "PM");
  assert.equal(appRoleFor({ isAdmin: true }), "ADMIN");
  assert.equal(canUseApp({ isPm: true }), true);
  assert.equal(canUseApp({ isAdmin: true }), true);
});

test("the widest surface wins, not the first match", () => {
  // The owner is the admin, is a PM, and may well also hold a member role for
  // testing. Resolving that to TECH would hide their own delivery book.
  assert.equal(
    appRoleFor({ isAdmin: true, isPm: true, isElite: true, innerCircleRole: "TECH" }),
    "ADMIN",
  );
  assert.equal(appRoleFor({ isPm: true, isElite: true, innerCircleRole: "OUTREACH" }), "PM");
});

/* -------------------------------------------------------------------------- */
/* The tabs                                                                   */
/* -------------------------------------------------------------------------- */

test("every role gets exactly four tabs, ending in Me", () => {
  for (const [role, tabs] of Object.entries(TABS)) {
    // Four is the thumb limit. A fifth tab is where apps grow a "More" menu,
    // which is a menu wearing a tab's clothes.
    assert.equal(tabs.length, 4, `${role} has ${tabs.length} tabs`);
    assert.equal(tabs[0].href, "/app", `${role} must open on Today`);
    assert.equal(tabs[0].label, "Today");
    assert.equal(tabs[3].href, "/app/me", `${role} must end on Me`);
    const hrefs = tabs.map((t) => t.href);
    assert.equal(new Set(hrefs).size, 4, `${role} has a duplicate tab`);
    for (const t of tabs) {
      assert.ok(t.href.startsWith("/app"), `${role}: ${t.href} escapes the app`);
      assert.ok(t.label.length <= 9, `${role}: "${t.label}" will wrap in a tab bar`);
      assert.ok(t.icon, `${role}: ${t.label} has no icon`);
    }
  }
});

test("the paid-per-outcome roles get Earnings as a top-level tab", () => {
  // Burying "what am I owed" inside a work list is how it stops being
  // believed, and the first payout decides whether a student trusts anything
  // else on the platform.
  for (const role of ["TECH", "OUTREACH"]) {
    assert.ok(
      TABS[role].some((t) => t.href === "/app/earnings"),
      `${role} cannot reach their earnings in one tap`,
    );
  }
});

test("a builder has no route to the lead desk, and a partner none to briefs", () => {
  // The nav is a convenience and RLS is the boundary, but a tab that 403s is
  // worse than no tab: it advertises something the person cannot have.
  const tech = TABS.TECH.map((t) => t.href);
  const out = TABS.OUTREACH.map((t) => t.href);
  assert.ok(!tech.includes("/app/leads"));
  assert.ok(!tech.includes("/app/projects"), "a builder must not see the deal book");
  assert.ok(!tech.includes("/app/team"));
  assert.ok(!out.includes("/app/briefs"));
  assert.ok(!out.includes("/app/projects"), "a partner must not see build costs");
});

/* -------------------------------------------------------------------------- */
/* Active tab                                                                 */
/* -------------------------------------------------------------------------- */

test("the active tab is the longest match, so Today does not swallow everything", () => {
  const tabs = TABS.TECH;
  assert.equal(activeTab(tabs, "/app"), "/app");
  assert.equal(activeTab(tabs, "/app/briefs"), "/app/briefs");
  // A child route keeps its parent tab lit. Without longest-prefix ordering
  // "/app" would match this first and the wrong tab would highlight.
  assert.equal(activeTab(tabs, "/app/briefs/abc-123"), "/app/briefs");
  assert.equal(activeTab(tabs, "/app/earnings"), "/app/earnings");
  // A path that is not a tab falls back to Today rather than lighting nothing.
  assert.equal(activeTab(tabs, "/app/something-else"), "/app");
  // And a prefix that merely starts the same must NOT match.
  assert.equal(activeTab(tabs, "/app/briefsy"), "/app");
});

/* -------------------------------------------------------------------------- */
/* Copy                                                                       */
/* -------------------------------------------------------------------------- */

test("every role has a human title and a reason to be proud of it", () => {
  for (const role of Object.keys(TABS)) {
    const title = ROLE_TITLE[role];
    const blurb = ROLE_BLURB[role];
    assert.ok(title && title.length <= 14, `${role} title is missing or too long`);
    // The enum value is a database detail. Showing it to the member is the
    // difference between a product and an admin panel.
    assert.notEqual(title.toUpperCase(), role);
    assert.ok(blurb && blurb.length > 10, `${role} has no blurb`);
    assert.ok(blurb.endsWith("."), `${role} blurb should be a sentence`);
  }
});
