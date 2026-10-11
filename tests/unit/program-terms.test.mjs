// Pins the terms.
//
// These clauses are the only thing standing between "a student built it" and
// "the client owns it". Under Indian copyright law the author owns the work
// unless it is assigned in writing, so if IP_ASSIGNMENT is ever dropped,
// renamed or quietly made non-strict, Almmatix is selling software it cannot
// warrant and cannot transfer — and nothing else in the codebase would notice.
// The same goes for the version string: acceptances store it, and if it stops
// changing when the text changes, every record becomes evidence of a document
// nobody can reproduce.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TERMS_VERSION,
  CLAUSES,
  clausesFor,
  strictClausesFor,
  acceptanceIsCurrent,
  TERMS_PROMISES,
} from "../../lib/programTerms.ts";

/** The clauses that must exist, whatever else is edited. */
const LOAD_BEARING = [
  "IP_ASSIGNMENT",
  "POINT_OF_CONTACT",
  "CONFIDENTIALITY",
  "NON_CIRCUMVENTION",
  "NO_SUBCONTRACTING",
  "DEADLINE",
  "ON_PLATFORM",
  "ORIGINALITY",
  "FIX_WINDOW",
];

test("every load-bearing clause exists and is marked strict", () => {
  const byKey = Object.fromEntries(CLAUSES.map((c) => [c.key, c]));
  for (const key of LOAD_BEARING) {
    const clause = byKey[key];
    assert.ok(clause, `${key} has been removed — this is the clause set that makes the work sellable`);
    assert.equal(clause.strict, true, `${key} must be strict: breaking it ends the arrangement`);
    assert.ok(clause.title.length > 0, `${key} has no title`);
    assert.ok(clause.body.length > 40, `${key} body is too short to mean anything`);
  }
});

test("clause keys are unique", () => {
  const seen = new Set();
  for (const c of CLAUSES) {
    assert.ok(!seen.has(c.key), `duplicate clause key ${c.key}`);
    seen.add(c.key);
  }
});

test("both roles are shown every universal clause plus their own", () => {
  for (const role of ["TECH", "OUTREACH"]) {
    const list = clausesFor(role);
    const keys = new Set(list.map((c) => c.key));
    for (const key of LOAD_BEARING) {
      assert.ok(keys.has(key), `${role} is not shown ${key}`);
    }
    // And never the other role's clauses — an outreach member agreeing to a
    // delivery ladder, or a builder to an activity target, is a clause they
    // cannot comply with.
    const other = role === "TECH" ? "OUTREACH" : "TECH";
    for (const c of list) {
      assert.notEqual(c.applies, other, `${role} was shown ${c.key}, which is ${other}-only`);
    }
  }
});

test("each role has role-specific clauses of its own", () => {
  const tech = clausesFor("TECH").filter((c) => c.applies === "TECH");
  const outreach = clausesFor("OUTREACH").filter((c) => c.applies === "OUTREACH");
  assert.ok(tech.length > 0, "TECH has no clauses about how TECH is paid");
  assert.ok(outreach.length > 0, "OUTREACH has no clauses about commission or activity");
  // The commission terms are what an outreach member will be held to on pay
  // day, so they have to be in front of them before they start.
  assert.ok(outreach.some((c) => c.key === "COMMISSION"));
  assert.ok(outreach.some((c) => c.key === "LEAD_DATA"));
});

test("strict clauses are a subset of what the role is shown", () => {
  for (const role of ["TECH", "OUTREACH"]) {
    const shown = new Set(clausesFor(role).map((c) => c.key));
    for (const c of strictClausesFor(role)) {
      assert.ok(shown.has(c.key), `${c.key} is strict for ${role} but not shown to them`);
      assert.equal(c.strict, true);
    }
  }
});

test("the page leads with what the member gets", () => {
  // A terms page that opens with nine obligations reads as a trap and gets
  // scrolled past, and an unread clause is a weak clause.
  assert.ok(TERMS_PROMISES.length >= 3);
  for (const p of TERMS_PROMISES) assert.ok(p.length > 20);
});

test("the version is a sortable date-plus-revision", () => {
  assert.match(
    TERMS_VERSION,
    /^\d{4}-\d{2}-\d{2}\.\d+$/,
    "version must be YYYY-MM-DD.N so acceptances order obviously",
  );
});

test("acceptance is current only for an exact version match", () => {
  assert.equal(acceptanceIsCurrent({ version: TERMS_VERSION }), true);
  assert.equal(acceptanceIsCurrent({ version: "1999-01-01.1" }), false);
  assert.equal(acceptanceIsCurrent({ version: null }), false);
  assert.equal(acceptanceIsCurrent({}), false);
  assert.equal(acceptanceIsCurrent(null), false);
  assert.equal(acceptanceIsCurrent(undefined), false);
});

test("no clause mentions a contact detail that must not be published", () => {
  // 9344110272 is on file for Razorpay and compliance only. A clause is the
  // kind of boilerplate a phone number gets pasted into, and this text is shown
  // to every applicant.
  for (const c of CLAUSES) {
    assert.ok(!/9344110272/.test(c.body + c.title), `${c.key} leaks the compliance phone number`);
  }
});

test("clauses are written in plain language, not legalese", () => {
  // The IP clause only works if it was understood. "Heretofore" and friends are
  // how a clause becomes unread, and an unread clause is the one that gets
  // disputed.
  const banned = /\b(heretofore|hereinafter|aforementioned|whereof|indemnitor|force majeure)\b/i;
  for (const c of CLAUSES) {
    assert.ok(!banned.test(c.body), `${c.key} has drifted into legalese`);
  }
});
