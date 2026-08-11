// End-to-end arithmetic for the payment -> escrow -> payout chain.
//
// Models what each stage stores, so a drift between create-order,
// verify-payment, the escrow row and manual_release_escrow is caught here
// rather than in someone's bank account.
//
//   payer charged      = price + deposit + 2% gateway
//   escrow.amount_held = price + deposit
//   payout_queue.amount= price - platform fee        (deposit NOT paid out)

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPaymentBreakdown, audienceForGig } from "../../lib/fees.ts";

/** What manual_release_escrow computes: original_amount - platform_fee. */
function releaseAmountFromEscrow(escrowRow) {
  return Number(escrowRow.original_amount || 0) - Number(escrowRow.platform_fee || 0);
}

/** What verify-payment / the webhook write into the escrow row. */
function escrowRowFrom(b) {
  return {
    original_amount: b.basePrice,
    platform_fee: b.platformFee,
    gateway_fee: b.gatewayFee,
    amount_held: b.amountHeld,
  };
}

test("Almmatix: Rs 3000 company task, 10% business rate", () => {
  const b = buildPaymentBreakdown({ price: 3000, audience: "BUSINESS" });

  assert.equal(b.platformFee, 300, "platform takes 10%");
  assert.equal(b.gatewayFee, 60, "gateway 2% on 3000");
  assert.equal(b.total, 3060, "Almmatix pays 3060");
  assert.equal(b.amountHeld, 3000, "escrow holds the task price");
  assert.equal(b.netWorkerPay, 2700, "intern receives 2700");

  // ...and the payout queue must agree with that exactly.
  assert.equal(releaseAmountFromEscrow(escrowRowFrom(b)), 2700);
});

test("student gig: Rs 500, 5% rate", () => {
  const b = buildPaymentBreakdown({ price: 500, audience: "STUDENT" });
  assert.equal(b.platformFee, 25);
  assert.equal(b.gatewayFee, 10);
  assert.equal(b.total, 510, "poster pays 510");
  assert.equal(b.netWorkerPay, 475, "student receives 475");
  assert.equal(releaseAmountFromEscrow(escrowRowFrom(b)), 475);
});

test("the deposit is held but never paid to the worker", () => {
  const b = buildPaymentBreakdown({ price: 1000, deposit: 2000, audience: "STUDENT" });

  assert.equal(b.amountHeld, 3000, "escrow holds price + deposit");
  assert.equal(b.gatewayFee, 60, "gateway applies to the full subtotal");
  assert.equal(b.total, 3060, "renter pays price + deposit + gateway");
  assert.equal(b.netWorkerPay, 950, "worker gets price - fee, NOT the deposit");
  assert.equal(
    releaseAmountFromEscrow(escrowRowFrom(b)),
    950,
    "release must not pay out the refundable deposit"
  );
});

test("invariants hold across the full price range and both audiences", () => {
  const prices = [1, 20, 50, 99, 100, 250, 499, 500, 501, 999, 1000, 2999, 3000, 10000, 99999];
  for (const price of prices) {
    for (const audience of ["STUDENT", "BUSINESS"]) {
      for (const deposit of [0, 500]) {
        const b = buildPaymentBreakdown({ price, deposit, audience });
        const payout = releaseAmountFromEscrow(escrowRowFrom(b));

        assert.equal(b.total, b.basePrice + b.deposit + b.gatewayFee, `total @${price}/${audience}`);
        assert.equal(b.amountHeld, b.basePrice + b.deposit, `held @${price}/${audience}`);
        assert.equal(payout, b.netWorkerPay, `payout matches breakdown @${price}/${audience}`);

        assert.ok(payout >= 0, `payout negative @${price}/${audience}`);
        assert.ok(payout <= b.basePrice, `payout exceeds price @${price}/${audience}`);
        assert.ok(b.amountHeld >= payout, `holding less than we owe @${price}/${audience}`);

        // Every value that reaches a bank must be a whole rupee.
        for (const [k, v] of Object.entries(b)) {
          if (typeof v === "number") {
            assert.ok(Number.isInteger(v), `${k} is fractional (${v}) @${price}/${audience}`);
          }
        }
      }
    }
  }
});

test("we never hold less than the sum of what we owe out", () => {
  // The platform keeps exactly its fee; nothing unaccounted for.
  const b = buildPaymentBreakdown({ price: 3000, deposit: 500, audience: "BUSINESS" });
  const workerGets = b.netWorkerPay;
  const depositRefund = b.deposit;
  const platformKeeps = b.platformFee;
  assert.equal(workerGets + depositRefund + platformKeeps, b.amountHeld,
    "escrow must reconcile exactly: worker + refund + fee = held");
});

test("rounding always favours whole rupees and never overpays the worker", () => {
  for (let price = 1; price <= 400; price++) {
    for (const audience of ["STUDENT", "BUSINESS"]) {
      const b = buildPaymentBreakdown({ price, audience });
      const exact = price * (audience === "BUSINESS" ? 0.1 : 0.05);
      assert.ok(b.platformFee >= exact, `fee under-charged at ${price}/${audience}`);
      assert.ok(b.platformFee - exact < 1, `fee over-charged by >=1 at ${price}/${audience}`);
      assert.ok(b.netWorkerPay < price, `worker paid full price at ${price}/${audience}`);
    }
  }
});

test("audience routing decides the rate for the Almmatix gig", () => {
  const gig = { company_id: "6e70bb41", listing_type: "COMPANY_TASK" };
  assert.equal(audienceForGig(gig), "BUSINESS");
  assert.equal(buildPaymentBreakdown({ price: 3000, audience: audienceForGig(gig) }).platformFee, 300);

  const peer = { listing_type: "HUSTLE" };
  assert.equal(buildPaymentBreakdown({ price: 3000, audience: audienceForGig(peer) }).platformFee, 150);
});
