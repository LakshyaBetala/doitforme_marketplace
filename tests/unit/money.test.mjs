// Pure-function tests for the money path: UPI destinations and fee arithmetic.
// Run with:  npm run test:unit   (node's built-in runner, no extra deps)
//
// These are the outliers that matter — a wrong UPI pays a stranger and a wrong
// fee silently skims or overpays on every single transaction.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkUpi, normalizeUpi } from "../../lib/upi.ts";
import { platformFeeFor, gatewayFeeFor, audienceForGig, PLATFORM_FEES } from "../../lib/fees.ts";

test("UPI: accepts real-world VPAs", () => {
  const valid = [
    "lakshya@okhdfcbank",
    "9876543210@ybl",
    "a.b@upi",
    "name_surname@paytm",
    "name-1@okaxis",
    "ab@sbi",
    "student.name123@oksbi",
  ];
  for (const v of valid) {
    assert.equal(checkUpi(v).valid, true, `${v} should be valid`);
  }
});

test("UPI: rejects malformed destinations", () => {
  const invalid = [
    ["", "empty"],
    ["name", "no @"],
    ["@ybl", "no local part"],
    ["name@", "no psp"],
    ["a@b", "psp too short"],
    ["name@@ybl", "double @"],
    [".name@ybl", "leading dot"],
    ["name.@ybl", "trailing dot"],
    ["na..me@ybl", "consecutive dots"],
    ["name@ybl.com", "dot in psp"],
    ["name@123", "numeric psp"],
    ["name with space@ybl", "space"],
    ["n@ybl", "local too short"],
    ["a".repeat(60) + "@ybl", "local too long"],
  ];
  for (const [v, why] of invalid) {
    assert.equal(checkUpi(v).valid, false, `${JSON.stringify(v)} should be invalid (${why})`);
  }
});

test("UPI: an email in the UPI field is caught explicitly", () => {
  const r = checkUpi("someone@gmail.com");
  assert.equal(r.valid, false);
  assert.match(r.error, /email address/i);
});

test("UPI: normalises case and invisible characters", () => {
  assert.equal(normalizeUpi("  Lakshya@OKHDFCBANK  "), "lakshya@okhdfcbank");
  // Zero-width space pasted from a chat app
  assert.equal(normalizeUpi("name​@ybl"), "name@ybl");
  // Non-breaking space
  assert.equal(normalizeUpi("name@ybl "), "name@ybl");
  assert.equal(checkUpi("  NAME@Ybl ").normalized, "name@ybl");
});

test("UPI: unknown PSP handle is flagged but still valid", () => {
  const r = checkUpi("name@somenewbank");
  assert.equal(r.valid, true, "must not block an unrecognised handle");
  assert.equal(r.unknownHandle, true);
  assert.equal(checkUpi("name@ybl").unknownHandle, false);
});

test("fees: student 5%, business 10%, rounded up to the rupee", () => {
  assert.equal(PLATFORM_FEES.STUDENT, 0.05);
  assert.equal(PLATFORM_FEES.BUSINESS, 0.1);

  assert.equal(platformFeeFor(500, "STUDENT"), 25);
  assert.equal(platformFeeFor(3000, "BUSINESS"), 300);
  // Rounding must favour the platform, never produce a fractional rupee.
  assert.equal(platformFeeFor(499, "STUDENT"), 25);
  assert.equal(platformFeeFor(1, "STUDENT"), 1);
  assert.equal(platformFeeFor(101, "BUSINESS"), 11);
});

test("fees: worker payout is never negative and never exceeds the price", () => {
  for (const price of [1, 20, 99, 499, 500, 3000, 10000]) {
    for (const aud of ["STUDENT", "BUSINESS"]) {
      const fee = platformFeeFor(price, aud);
      const net = price - fee;
      assert.ok(fee >= 0, `fee negative at ${price}/${aud}`);
      assert.ok(net >= 0, `net negative at ${price}/${aud}`);
      assert.ok(net <= price, `net exceeds price at ${price}/${aud}`);
    }
  }
});

test("fees: gateway fee is charged on top, 2%, rounded up", () => {
  assert.equal(gatewayFeeFor(500), 10);
  assert.equal(gatewayFeeFor(3000), 60);
  assert.equal(gatewayFeeFor(1), 1);
});

test("fees: audience is BUSINESS for company work, STUDENT otherwise", () => {
  assert.equal(audienceForGig({ company_id: "abc" }), "BUSINESS");
  assert.equal(audienceForGig({ listing_type: "COMPANY_TASK" }), "BUSINESS");
  assert.equal(audienceForGig({ listing_type: "HUSTLE" }), "STUDENT");
  assert.equal(audienceForGig({}), "STUDENT");
  assert.equal(audienceForGig({ company_id: null }), "STUDENT");
  // Managed is a delivery mode, not a price tier — must stay STUDENT unless
  // the gig is genuinely company work.
  assert.equal(audienceForGig({ listing_type: "HUSTLE", is_managed: true }), "STUDENT");
});

test("fees: the Almmatix case end to end", () => {
  const price = 3000;
  const aud = audienceForGig({ company_id: "almmatix", listing_type: "COMPANY_TASK" });
  const fee = platformFeeFor(price, aud);
  const gateway = gatewayFeeFor(price);

  assert.equal(aud, "BUSINESS");
  assert.equal(fee, 300);
  assert.equal(price - fee, 2700, "intern receives");
  assert.equal(price + gateway, 3060, "company pays");
});
