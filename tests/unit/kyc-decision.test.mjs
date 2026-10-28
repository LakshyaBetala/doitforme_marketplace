// The KYC bands, pinned.
//
// This is the function that decides whether a real student gets into the
// product, and until the logic was extracted from the middle of
// verifyStudentIdImage it could not be tested at all — it sat behind a network
// call to Gemini, so the one part of verification that matters had no coverage.
//
// It exists because of a measured failure: APPROVE used to be 0.85 and the
// "unsure" floor 0.5, which meant EVERYTHING from 0 to 0.85 was deferred to a
// manual_review queue that nothing drains, and 372 students were sitting in it.
// The bands below are deliberately narrower, and both ends are decisions.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideKyc,
  KYC_APPROVE_THRESHOLD,
  KYC_HOPELESS_THRESHOLD,
} from "../../lib/kycVerification.ts";

test("the thresholds are the ones the product was tuned to", () => {
  // Pinned as values, not just relationally: lowering APPROVE was a deliberate
  // trade (a wrongly approved non-student is bounded by escrow and ratings; a
  // wrongly deferred student waits forever and leaves), and raising it back
  // without saying so would quietly recreate the queue.
  assert.equal(KYC_APPROVE_THRESHOLD, 0.65);
  assert.equal(KYC_HOPELESS_THRESHOLD, 0.1);
  assert.ok(KYC_HOPELESS_THRESHOLD < KYC_APPROVE_THRESHOLD);
});

test("a confident student ID is approved", () => {
  for (const c of [0.65, 0.7, 0.9, 1]) {
    assert.deepEqual(decideKyc(c, true), { decision: "approved", purgeDocument: false }, `conf ${c}`);
  }
});

test("a confident NON student ID is rejected, and the image is kept", () => {
  // An Aadhaar card or a fee receipt is a real document and a refusal somebody
  // might appeal, so the evidence has to survive.
  for (const c of [0.65, 0.8, 1]) {
    const r = decideKyc(c, false);
    assert.equal(r.decision, "rejected", `conf ${c}`);
    assert.equal(r.purgeDocument, false, `conf ${c} must not purge`);
  }
});

test("below the hopeless floor it is rejected AND purged, whatever the model claims", () => {
  // isStudentId is ignored here on purpose: a model that says "yes, a student
  // ID" with 0.02 confidence has not recognised anything, and the image is a
  // selfie or a blank wall. Both branches must purge.
  for (const isId of [true, false]) {
    for (const c of [0, 0.01, 0.09]) {
      assert.deepEqual(
        decideKyc(c, isId),
        { decision: "rejected", purgeDocument: true },
        `conf ${c}, isId ${isId}`
      );
    }
  }
});

test("the ambiguous band defers, and never purges", () => {
  for (const isId of [true, false]) {
    for (const c of [0.1, 0.3, 0.5, 0.64]) {
      const r = decideKyc(c, isId);
      assert.equal(r.decision, "manual_review", `conf ${c}, isId ${isId}`);
      // Purging here would destroy a student ID the model merely could not read
      // confidently — the opposite of failing open.
      assert.equal(r.purgeDocument, false, `conf ${c} must not purge`);
    }
  }
});

test("the boundaries belong to the band above them", () => {
  // Exactly 0.10 is reviewable, not purged. Exactly 0.65 is a decision.
  assert.equal(decideKyc(0.1, true).purgeDocument, false);
  assert.equal(decideKyc(0.1, true).decision, "manual_review");
  assert.equal(decideKyc(0.65, true).decision, "approved");
  assert.equal(decideKyc(0.65, false).decision, "rejected");
});

test("every band returns a usable decision for any number a model could emit", () => {
  const valid = new Set(["approved", "rejected", "manual_review"]);
  for (let c = 0; c <= 1.0001; c += 0.01) {
    for (const isId of [true, false]) {
      const r = decideKyc(Math.min(c, 1), isId);
      assert.ok(valid.has(r.decision), `conf ${c} gave ${r.decision}`);
      assert.equal(typeof r.purgeDocument, "boolean");
      // Purge is only ever paired with a rejection — never with an approval,
      // which would delete a verified student's own ID.
      if (r.purgeDocument) assert.equal(r.decision, "rejected", `conf ${c} purged a ${r.decision}`);
    }
  }
});
