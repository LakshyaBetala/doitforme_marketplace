// Pins the agency pricing model.
//
// The first version of this model had the student fees written as literals
// against an 80k deal — frontend 5k, backend 7k — so the fees were not a
// decision about what the work was worth, they were whatever was left after the
// margin. Repricing meant rediscovering every literal by hand, and nothing
// checked that the pieces still summed to the deal.
//
// Everything is now derived from the deal value and DEAL_SPLIT, so these tests
// are the thing that makes that safe: if a share is edited, the sum is still
// provably the deal value, nobody is paid a negative fee, and the published net
// figure still agrees with lib/fees.ts. The net check matters most — a member
// told one number who receives another has been misled however correct the
// arithmetic was, and the first payout is the conversation that decides whether
// they trust anything else we say.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEAL_SPLIT,
  MARGIN_SHARE,
  SERVICES,
  SERVICE_BY_KEY,
  ANCHOR_SERVICE,
  quoteFor,
  grossUpFor,
  ladderFor,
  LADDER,
  monthlyCapacity,
  gstRunwayMonths,
  GST_SERVICE_THRESHOLD,
  scoreFrom,
  SCORECARD,
  SCORECARD_TOTAL,
  PROBATION_PASS_MARK,
  entrantsNeeded,
  COHORT,
  isServiceKey,
  AGENCY_FEE_AUDIENCE,
} from "../../lib/agency.ts";
import { platformFeeFor, PLATFORM_FEES } from "../../lib/fees.ts";

/* -------------------------------------------------------------------------- */
/* The split                                                                  */
/* -------------------------------------------------------------------------- */

test("the deal split leaves a margin, and the shares are a sane fraction of one", () => {
  const paidOut =
    DEAL_SPLIT.OUTREACH_COMMISSION +
    DEAL_SPLIT.DELIVERY_POOL +
    DEAL_SPLIT.PROJECT_MANAGER +
    DEAL_SPLIT.OVERHEAD;

  assert.ok(paidOut < 1, "the split spends the whole deal or more — there is no margin");
  assert.ok(MARGIN_SHARE > 0, "margin share must be positive");
  assert.ok(
    Math.abs(MARGIN_SHARE - (1 - paidOut)) < 1e-9,
    "MARGIN_SHARE must be exactly the remainder, never a second written-down number",
  );
});

test("agency work is billed at the Business rate, not the student rate", () => {
  // Almmatix posts as a company, so audienceForGig() returns BUSINESS. If this
  // ever read STUDENT the platform would take 5% while every published net
  // figure assumed 10%, and every quote in the product would be wrong.
  assert.equal(AGENCY_FEE_AUDIENCE, "BUSINESS");
  assert.equal(PLATFORM_FEES[AGENCY_FEE_AUDIENCE], 0.1);
});

/* -------------------------------------------------------------------------- */
/* The catalogue                                                              */
/* -------------------------------------------------------------------------- */

test("every service is quotable and internally consistent", () => {
  assert.ok(SERVICES.length > 0);
  const keys = new Set();
  for (const s of SERVICES) {
    assert.ok(!keys.has(s.key), `duplicate service key ${s.key}`);
    keys.add(s.key);
    assert.ok(s.price > 0, `${s.key} has no price`);
    assert.ok(s.days > 0, `${s.key} has no duration`);
    assert.ok(s.slots.length > 0, `${s.key} has nobody building it`);
    for (const slot of s.slots) {
      assert.ok(slot.weight > 0, `${s.key} has a zero-weight slot, which would pay 0`);
    }
    assert.equal(SERVICE_BY_KEY[s.key], s, `${s.key} missing from the lookup`);
    assert.ok(isServiceKey(s.key));
  }
  assert.ok(!isServiceKey("NOT_A_SERVICE"));
});

test("the anchor price is the finalised 1.5 lakh web platform", () => {
  // The 80k anchor was the root cause of the 5k student fee: at the agency floor
  // rate of 1,000/hr it bought 80 billable hours total across three people for
  // an entire frontend, an entire backend, integration and client management.
  // If this number moves back down, the fees move with it and the whole
  // retention argument collapses — so it is pinned.
  assert.equal(ANCHOR_SERVICE.key, "WEB_PLATFORM");
  assert.equal(ANCHOR_SERVICE.price, 150_000);
});

/* -------------------------------------------------------------------------- */
/* Quoting                                                                    */
/* -------------------------------------------------------------------------- */

test("a quote never spends more than the deal, and the margin absorbs rounding", () => {
  for (const s of SERVICES) {
    const q = quoteFor(s);
    const sum = q.totalCost + q.margin;
    assert.equal(sum, q.dealValue, `${s.key}: lines do not sum back to the deal value`);
    assert.ok(q.margin > 0, `${s.key}: no margin left`);
    assert.ok(q.totalCost < q.dealValue, `${s.key}: costs exceed the price`);
  }
});

test("every published net figure matches lib/fees.ts exactly", () => {
  for (const s of SERVICES) {
    const q = quoteFor(s);
    const people = [q.outreach, q.projectManager, ...q.slots];
    for (const p of people) {
      const fee = platformFeeFor(p.gross, AGENCY_FEE_AUDIENCE);
      assert.equal(p.platformFee, fee, `${s.key}: fee disagrees with lib/fees.ts`);
      assert.equal(p.net, p.gross - fee, `${s.key}: net is not gross minus the fee`);
      assert.ok(p.net > 0, `${s.key}: somebody nets nothing`);
      assert.ok(p.net < p.gross, `${s.key}: the fee vanished`);
    }
  }
});

test("platform revenue is exactly the fee on money paid to people", () => {
  for (const s of SERVICES) {
    const q = quoteFor(s);
    const expected =
      q.outreach.platformFee +
      q.projectManager.platformFee +
      q.slots.reduce((a, x) => a + x.platformFee, 0);
    assert.equal(q.platformRevenue, expected);
    // Overhead is not paid to a person, so it must not be taxed.
    assert.ok(q.platformRevenue < q.totalCost);
  }
});

test("the anchor quote produces the numbers the plan was decided on", () => {
  const q = quoteFor("WEB_PLATFORM");
  assert.equal(q.dealValue, 150_000);
  assert.equal(q.outreach.gross, 15_000);
  assert.equal(q.outreach.net, 13_500);
  assert.equal(q.projectManager.gross, 19_500);
  // Delivery pool is 18% of 1.5L = 27,000, split 4:5 between frontend and backend.
  const frontend = q.slots.find((x) => x.role === "FRONTEND");
  const backend = q.slots.find((x) => x.role === "BACKEND");
  assert.equal(frontend.gross, 12_000);
  assert.equal(backend.gross, 15_000);
  assert.equal(frontend.net, 10_800);
  assert.equal(backend.net, 13_500);
  assert.equal(q.overhead, 12_000);
  assert.equal(q.totalCost, 73_500);
  assert.equal(q.margin, 76_500);
});

test("the delivery pool is split by weight, not evenly", () => {
  const q = quoteFor("MOBILE_APP");
  const byRole = Object.fromEntries(q.slots.map((s) => [s.role, s.gross]));
  // MOBILE 5 : BACKEND 4 : QA 2 — a heavier slot must be paid more.
  assert.ok(byRole.MOBILE > byRole.BACKEND);
  assert.ok(byRole.BACKEND > byRole.QA);
});

test("an override price reprices everyone proportionally", () => {
  const base = quoteFor("WEB_PLATFORM");
  const doubled = quoteFor("WEB_PLATFORM", 300_000);
  assert.equal(doubled.outreach.gross, base.outreach.gross * 2);
  assert.equal(doubled.margin, base.margin * 2);
});

test("a zero-value quote degrades without throwing or paying anyone", () => {
  const q = quoteFor("WEB_PLATFORM", 0);
  assert.equal(q.dealValue, 0);
  assert.equal(q.totalCost, 0);
  assert.equal(q.margin, 0);
  assert.equal(q.platformRevenue, 0);
});

/* -------------------------------------------------------------------------- */
/* Grossing up                                                                */
/* -------------------------------------------------------------------------- */

test("grossUpFor inverts the fee exactly, despite the ceil", () => {
  // platformFeeFor rounds UP, so it is not algebraically invertible — the naive
  // net/(1-rate) is short by a rupee at many values. This is the function that
  // runs if Almmatix decides to absorb the fee instead of the students, so
  // being a rupee short means a student is quietly underpaid every time.
  for (const net of [1, 99, 100, 4_500, 10_800, 13_500, 15_000, 99_999]) {
    const gross = grossUpFor(net);
    assert.ok(
      gross - platformFeeFor(gross, AGENCY_FEE_AUDIENCE) >= net,
      `grossUpFor(${net}) = ${gross} still nets less than ${net}`,
    );
    // And it must not overshoot: one rupee less should fail to clear the target.
    const under = gross - 1;
    assert.ok(
      under - platformFeeFor(under, AGENCY_FEE_AUDIENCE) < net,
      `grossUpFor(${net}) = ${gross} overshoots`,
    );
  }
  assert.equal(grossUpFor(0), 0);
});

/* -------------------------------------------------------------------------- */
/* The ladder                                                                 */
/* -------------------------------------------------------------------------- */

test("the ladder only ever goes up, and starts at the base rate", () => {
  assert.equal(ladderFor(0).multiplier, 1);
  assert.equal(ladderFor(-5).multiplier, 1, "negative history must not be a promotion");
  let last = 0;
  for (let n = 0; n <= 12; n++) {
    const m = ladderFor(n).multiplier;
    assert.ok(m >= last, `multiplier fell at ${n} projects`);
    last = m;
  }
  // Each published rung must be reachable, or it is a promise that cannot land.
  for (const rung of LADDER) {
    assert.equal(ladderFor(rung.from).title, rung.title, `rung ${rung.title} is unreachable`);
  }
});

/* -------------------------------------------------------------------------- */
/* Capacity and GST                                                           */
/* -------------------------------------------------------------------------- */

test("capacity is PM-bound and zero PMs means zero intake", () => {
  assert.equal(monthlyCapacity(0), 0);
  assert.equal(monthlyCapacity(1), 2);
  assert.equal(monthlyCapacity(2), 4);
  // Outreach paid per close will find more than this, which is why intake is
  // capped. If this ever returns a number not tied to PM count, the overselling
  // failure is back.
  assert.ok(monthlyCapacity(3) > monthlyCapacity(2));
});

test("the GST runway shortens as revenue grows", () => {
  assert.equal(gstRunwayMonths(0), null);
  assert.equal(gstRunwayMonths(-1), null);
  const atThree = gstRunwayMonths(3 * 150_000);
  const atSix = gstRunwayMonths(6 * 150_000);
  assert.ok(atThree > atSix, "more revenue must mean less runway");
  assert.equal(atThree, Math.floor(GST_SERVICE_THRESHOLD / 450_000));
  // Three web platforms a month crosses the threshold inside half a year, which
  // is the fact the plan depends on.
  assert.ok(atThree <= 5, `expected <=5 months of runway, got ${atThree}`);
});

/* -------------------------------------------------------------------------- */
/* Probation                                                                  */
/* -------------------------------------------------------------------------- */

test("the scorecard totals 100 and weights reliability over craft", () => {
  assert.equal(SCORECARD_TOTAL, 100);
  const byKey = Object.fromEntries(SCORECARD.map((s) => [s.key, s.weight]));
  const reliability = byKey.on_time + byKey.responsive;
  assert.ok(
    reliability > SCORECARD_TOTAL / 2,
    "reliability must outweigh everything else combined — that is the whole filter",
  );
  assert.ok(byKey.on_time > byKey.craft, "shipping on time must beat code quality");
});

test("scoring is additive, bounded, and ignores absent marks", () => {
  assert.equal(scoreFrom({}), 0);
  const all = Object.fromEntries(SCORECARD.map((s) => [s.key, true]));
  assert.equal(scoreFrom(all), 100);
  assert.equal(scoreFrom({ on_time: true }), 40);
  assert.equal(scoreFrom({ on_time: true, responsive: true }), 60);
  // A false mark scores nothing rather than subtracting.
  assert.equal(scoreFrom({ on_time: true, craft: false }), 40);
});

test("the pass mark cannot be cleared on craft alone, nor missed on time alone", () => {
  assert.ok(PROBATION_PASS_MARK > 0 && PROBATION_PASS_MARK <= 100);
  // Everything except shipping on time: must NOT pass. Someone who misses every
  // deadline but writes tidy code is exactly who this filter exists to exclude.
  const lateButTidy = scoreFrom({ responsive: true, asked: true, runs: true, craft: true });
  assert.ok(
    lateButTidy < PROBATION_PASS_MARK,
    `missing the deadline still scored ${lateButTidy}, which passes`,
  );
  // On time and responsive and one more: should pass.
  assert.ok(scoreFrom({ on_time: true, responsive: true, runs: true }) >= PROBATION_PASS_MARK);
});

/* -------------------------------------------------------------------------- */
/* Cohorts                                                                    */
/* -------------------------------------------------------------------------- */

test("the funnel asks for more entrants than the target headcount", () => {
  for (const role of Object.keys(COHORT)) {
    const need = entrantsNeeded(role);
    assert.ok(
      need > COHORT[role].target,
      `${role}: recruiting to the target instead of the entry number leaves a hole`,
    );
  }
  // 12 TECH places needs ~36 entering. There were 12 TECH opt-ins on the
  // waitlist, which is a third of the requirement — the number that says the
  // "not sure" group has to be routed rather than ignored.
  assert.ok(entrantsNeeded("TECH") >= 30);
});
