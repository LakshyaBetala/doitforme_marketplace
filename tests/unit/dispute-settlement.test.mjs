// Partial dispute settlement (SPLIT) arithmetic.
//
// Mirrors app/api/admin/resolve-dispute/route.ts. A settlement moves money in
// two directions at once — part refunded to the poster, the rest queued to the
// worker — so an error here silently overpays one side out of the other's
// pocket. The single most important property is the fee base: we charge the
// platform fee on what the worker KEEPS, not on the original price, because
// taking a full cut of work we just judged partly unsatisfactory is
// indefensible.

import { test } from "node:test";
import assert from "node:assert/strict";
import { platformFeeFor, audienceForGig, PLATFORM_FEES } from "../../lib/fees.ts";

/** Exactly what the SPLIT branch computes. Keep in step with the route. */
function settle({ price, refund, gig }) {
  const audience = audienceForGig(gig);
  const workerGross = price - refund;
  const platformFee = platformFeeFor(workerGross, audience);
  const workerNet = Math.max(0, workerGross - platformFee);
  return { audience, workerGross, platformFee, workerNet };
}

/** The route's guard: strictly inside the price, whole rupees. */
function isAcceptedRefund(price, refundAmount) {
  const refund = Math.round(Number(refundAmount));
  return Number.isFinite(refund) && refund > 0 && refund < price;
}

const STUDENT_GIG = { listing_type: "HUSTLE", company_id: null };
const COMPANY_GIG = { listing_type: "COMPANY_TASK", company_id: "c1" };

test("student gig: Rs 1000 settled with Rs 400 back to the poster", () => {
  const { audience, workerGross, platformFee, workerNet } = settle({
    price: 1000,
    refund: 400,
    gig: STUDENT_GIG,
  });

  assert.equal(audience, "STUDENT");
  assert.equal(workerGross, 600);
  // 5% of the KEPT 600, not of the original 1000 (which would be 50).
  assert.equal(platformFee, 30);
  assert.equal(workerNet, 570);
});

test("company task: same split, 10% on the kept portion", () => {
  const { audience, workerGross, platformFee, workerNet } = settle({
    price: 1000,
    refund: 400,
    gig: COMPANY_GIG,
  });

  assert.equal(audience, "BUSINESS");
  assert.equal(workerGross, 600);
  assert.equal(platformFee, 60); // not 100
  assert.equal(workerNet, 540);
});

test("the fee is never charged on the refunded portion", () => {
  for (const price of [100, 499, 1000, 5000]) {
    for (const refund of [1, Math.floor(price / 3), price - 1]) {
      const full = platformFeeFor(price, "STUDENT");
      const { platformFee } = settle({ price, refund, gig: STUDENT_GIG });
      assert.ok(
        platformFee <= full,
        `fee on a partial settlement (${platformFee}) exceeded the fee on the whole gig (${full})`
      );
    }
  }
});

test("money is conserved: refund + fee + worker payout = price", () => {
  for (const price of [100, 499, 1000, 2500, 5000]) {
    for (const refund of [1, 50, Math.floor(price / 2), price - 1]) {
      if (!isAcceptedRefund(price, refund)) continue;
      const { platformFee, workerNet } = settle({ price, refund, gig: STUDENT_GIG });
      assert.equal(
        refund + platformFee + workerNet,
        price,
        `settlement of ${refund} on ${price} did not balance`
      );
    }
  }
});

test("worker payout is never negative and never exceeds what they kept", () => {
  for (const price of [1, 2, 100, 5000]) {
    for (let refund = 1; refund < price; refund++) {
      const { workerGross, workerNet } = settle({ price, refund, gig: COMPANY_GIG });
      assert.ok(workerNet >= 0, `negative payout at price=${price} refund=${refund}`);
      assert.ok(workerNet <= workerGross, `payout exceeded the kept amount at price=${price}`);
    }
  }
});

test("refunds outside the price are refused — use RELEASE or REFUND instead", () => {
  const price = 1000;
  assert.equal(isAcceptedRefund(price, 0), false, "zero is a RELEASE, not a split");
  assert.equal(isAcceptedRefund(price, -50), false, "negative refund accepted");
  assert.equal(isAcceptedRefund(price, price), false, "full refund is a REFUND, not a split");
  assert.equal(isAcceptedRefund(price, price + 1), false, "refund exceeded the escrow");
  assert.equal(isAcceptedRefund(price, "abc"), false, "non-numeric refund accepted");
  assert.equal(isAcceptedRefund(price, 1), true);
  assert.equal(isAcceptedRefund(price, price - 1), true);
});

test("a settlement never pays out more than a full release would", () => {
  const price = 1000;
  const fullRelease = price - platformFeeFor(price, "STUDENT");
  for (let refund = 1; refund < price; refund++) {
    const { workerNet } = settle({ price, refund, gig: STUDENT_GIG });
    assert.ok(
      workerNet < fullRelease,
      `settling ${refund} back paid the worker ${workerNet}, at or above the full release ${fullRelease}`
    );
  }
});

test("the documented rates are the ones being applied", () => {
  assert.equal(PLATFORM_FEES.STUDENT, 0.05);
  assert.equal(PLATFORM_FEES.BUSINESS, 0.1);
});
