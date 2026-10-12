// Pins the agency pricing model and the care book.
//
// The first version had the student fees written as literals against an 80k
// deal — frontend 5k, backend 7k — so the fees were not a decision about what
// the work was worth, they were whatever was left after the margin. Repricing
// meant rediscovering every literal by hand, and nothing checked that the
// pieces still summed to the deal.
//
// Everything is now derived from the deal value and its tier's split, so these
// tests are what makes that safe: a share can be edited and the sum is still
// provably the deal value, nobody is paid a negative fee, and the published net
// figure still agrees with lib/fees.ts. The net check matters most — a member
// told one number who receives another has been misled however correct the
// arithmetic was, and the first payout is the conversation that decides whether
// they trust anything else.
//
// The care-book tests exist because a retainer book is the one part of the
// model that looks free. It is not: it consumes the same PM hours that deliver
// new projects, and `pmOverloaded` is the assertion that stops the forecast
// being used as a hiring plan without that showing up.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPLIT_TIERS,
  tierFor,
  splitFor,
  marginShareFor,
  SERVICES,
  SERVICE_BY_KEY,
  ANCHOR_SERVICE,
  PASS_THROUGH,
  quoteFor,
  grossUpFor,
  ladderFor,
  LADDER,
  PLAYBOOK,
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
  careBook,
  careBookForecast,
  plansToCoverFixedCosts,
  FIXED_COSTS,
  FIXED_COSTS_MONTHLY,
  CARE_LOAD_HOURS,
  MAINTAINER_HOURS_PER_MONTH,
  PM_HOURS_PER_PLAN,
  PM_SPARE_HOURS_PER_MONTH,
  SUPPORT_HOURLY_RATE,
  CARE_ANNUAL_ESCALATION,
  CARE_ASSUMED_CHURN,
  CARE_ATTACH_TARGET,
  RETAINER_COMMISSION_MONTHS,
} from "../../lib/agency.ts";
import { platformFeeFor, PLATFORM_FEES } from "../../lib/fees.ts";

/* -------------------------------------------------------------------------- */
/* The split tiers                                                            */
/* -------------------------------------------------------------------------- */

test("every tier leaves a margin and spends less than the deal", () => {
  for (const t of SPLIT_TIERS) {
    const s = t.split;
    const paidOut = s.commission + s.delivery + s.pm + s.overhead;
    assert.ok(paidOut < 1, `${t.label}: the split spends the whole deal — no margin`);
  }
});

test("tiers are ordered and cover every price without a gap", () => {
  let prev = 0;
  for (const t of SPLIT_TIERS) {
    assert.ok(t.upTo > prev, `${t.label}: upTo must increase`);
    prev = t.upTo;
  }
  assert.equal(SPLIT_TIERS[SPLIT_TIERS.length - 1].upTo, Number.POSITIVE_INFINITY, "no open-ended tier");
  // Boundaries are exclusive, so a price exactly on one lands in the next tier up.
  assert.equal(tierFor(49_999).label, "small");
  assert.equal(tierFor(50_000).label, "mid");
  assert.equal(tierFor(99_999).label, "mid");
  assert.equal(tierFor(100_000).label, "large");
  assert.equal(tierFor(10_000_000).label, "large");
  assert.equal(tierFor(0).label, "small");
});

test("the delivery pool share FALLS as the price rises, and margin rises", () => {
  // This is the whole reason tiers exist. A flat 18% pool pays 5,400 for an
  // entire 30k website; small work is nearly all build and almost no
  // management, so the builders' share has to be bigger at the cheap end or
  // every small job is quietly exploitative.
  assert.ok(splitFor(30_000).delivery > splitFor(150_000).delivery);
  assert.ok(splitFor(30_000).pm < splitFor(150_000).pm);
  assert.ok(marginShareFor(30_000) < marginShareFor(150_000));
  assert.ok(marginShareFor(30_000) > 0.3, "even the thinnest tier must be worth doing");
  // And every tier stays above what a STAFFED agency runs on (25-35%), because
  // there is no payroll, no office and no idle bench behind these numbers.
  for (const t of SPLIT_TIERS) {
    const m = 1 - t.split.commission - t.split.delivery - t.split.pm - t.split.overhead;
    assert.ok(m > 0.35, `${t.label}: ${(m * 100).toFixed(0)}% margin is at staffed-agency level`);
    assert.ok(m < 0.55, `${t.label}: ${(m * 100).toFixed(0)}% over-collects for costs we do not bear`);
  }
});

test("the PM share rises with project size, and a PM can live on it", () => {
  // The PM is the binding constraint on the whole business, and the share has
  // to clear a promoted-student's alternative or the only PM pipeline closes.
  assert.ok(splitFor(150_000).pm > splitFor(30_000).pm, "a 3-builder app needs more PM than a one-pager");
  // Two concurrent slots, 21 working days a month: the monthly figure is what
  // actually decides whether a second PM is hirable.
  const q = quoteFor("WEB_PLATFORM");
  const perMonth = (2 / (q.service.days / 21)) * q.projectManager.gross;
  assert.ok(perMonth >= 35_000, `a PM at capacity earns only ${Math.round(perMonth)}/month`);
});

test("the commission share is identical at every tier", () => {
  // An outreach member must never have a reason to steer a client toward the
  // service that pays them best rather than the one they need.
  const shares = new Set(SPLIT_TIERS.map((t) => t.split.commission));
  assert.equal(shares.size, 1, "commission varies by tier — that creates a conflict of interest");
});

test("agency work is billed at the Business rate, not the student rate", () => {
  assert.equal(AGENCY_FEE_AUDIENCE, "BUSINESS");
  assert.equal(PLATFORM_FEES[AGENCY_FEE_AUDIENCE], 0.1);
});

/* -------------------------------------------------------------------------- */
/* The catalogue                                                              */
/* -------------------------------------------------------------------------- */

test("every service is quotable, scoped and internally consistent", () => {
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
    // The scope IS the scope-creep defence. A service with no written
    // exclusions is a service whose price will be eaten by assumptions.
    assert.ok(s.includes.length >= 3, `${s.key} does not say enough about what the price buys`);
    assert.ok(s.excludes.length >= 2, `${s.key} names no exclusions`);
    assert.equal(SERVICE_BY_KEY[s.key], s, `${s.key} missing from the lookup`);
    assert.ok(isServiceKey(s.key));
  }
  assert.ok(!isServiceKey("NOT_A_SERVICE"));
});

test("the price ceilings the owner set are respected", () => {
  // An app costs at most 1.5L and a business website at most 30k. These are
  // deliberate undercuts of the market floor to buy the first references; if
  // they drift up, the positioning that wins the early clients is gone, and if
  // they drift down the builders' fees follow.
  assert.equal(SERVICE_BY_KEY.MOBILE_APP.price, 150_000);
  assert.equal(SERVICE_BY_KEY.MARKETING_SITE.price, 30_000);
  assert.equal(ANCHOR_SERVICE.key, "MOBILE_APP");
  for (const s of SERVICES) {
    assert.ok(s.price <= 150_000, `${s.key} at ${s.price} is over the 1.5L ceiling`);
  }
});

test("server and usage costs are never inside a price", () => {
  // They used to sit in overhead, which meant a chatty AI feature silently ate
  // the margin of the project that shipped it.
  assert.ok(PASS_THROUGH.length >= 4);
  const all = PASS_THROUGH.join(" ").toLowerCase();
  for (const word of ["hosting", "domain", "api"]) {
    assert.ok(all.includes(word), `PASS_THROUGH does not mention ${word}`);
  }
  // Anything with a running cost must say so in its own exclusions too.
  for (const key of ["AI_ASSISTANT", "AI_DOCUMENTS", "AI_WORKFLOW"]) {
    const ex = SERVICE_BY_KEY[key].excludes.join(" ").toLowerCase();
    assert.ok(/usage|charges|subscription/.test(ex), `${key} does not exclude usage charges`);
  }
});

test("there is a cheap way in and a recurring way to stay", () => {
  const cheapest = Math.min(...SERVICES.filter((s) => !s.recurring).map((s) => s.price));
  assert.ok(cheapest <= 20_000, "nothing cheap enough to open a conversation with a small business");
  const recurring = SERVICES.filter((s) => s.recurring);
  assert.ok(recurring.length >= 3, "the care book needs tiers, not one plan for every build size");
  // And the tiers have to be a real ladder, or they are one plan with three names.
  const prices = recurring.map((s) => s.price).sort((a, b) => a - b);
  assert.ok(prices[prices.length - 1] >= prices[0] * 3, "the care tiers barely differ");
});

/* -------------------------------------------------------------------------- */
/* Quoting                                                                    */
/* -------------------------------------------------------------------------- */

test("a quote never spends more than the deal, and the margin absorbs rounding", () => {
  for (const s of SERVICES) {
    const q = quoteFor(s);
    assert.equal(q.totalCost + q.margin, q.dealValue, `${s.key}: lines do not sum back to the deal`);
    assert.ok(q.margin > 0, `${s.key}: no margin left`);
    assert.ok(q.totalCost < q.dealValue, `${s.key}: costs exceed the price`);
  }
});

test("every published net figure matches lib/fees.ts exactly", () => {
  for (const s of SERVICES) {
    const q = quoteFor(s);
    for (const p of [q.outreach, q.projectManager, ...q.slots]) {
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

test("the two ceiling services produce the numbers the plan was decided on", () => {
  const app = quoteFor("MOBILE_APP");
  assert.equal(app.dealValue, 150_000);
  assert.equal(app.tier, "large");
  assert.equal(app.outreach.gross, 15_000);
  assert.equal(app.outreach.net, 13_500);
  assert.equal(app.projectManager.gross, 27_000);
  assert.equal(app.overhead, 6_000);
  assert.equal(app.margin, 72_000);

  const site = quoteFor("MARKETING_SITE");
  assert.equal(site.dealValue, 30_000);
  assert.equal(site.tier, "small");
  // One builder, not two: at 30k a second person makes both fees insulting.
  assert.equal(site.slots.length, 1);
  assert.equal(site.slots[0].gross, 9_000);
  assert.equal(site.slots[0].net, 8_100);
  assert.equal(site.margin, 13_200);
});

test("the delivery pool is split by weight, not evenly", () => {
  const q = quoteFor("MOBILE_APP");
  const byRole = Object.fromEntries(q.slots.map((s) => [s.role, s.gross]));
  assert.ok(byRole.MOBILE > byRole.BACKEND);
  assert.ok(byRole.BACKEND > byRole.QA);
});

test("an override price can move a deal into another tier", () => {
  const listed = quoteFor("MARKETING_SITE");
  const scaled = quoteFor("MARKETING_SITE", 120_000);
  assert.equal(listed.tier, "small");
  assert.equal(scaled.tier, "large");
  // And the bigger deal must pay its builder more in absolute terms even though
  // the pool SHARE is smaller.
  assert.ok(scaled.slots[0].gross > listed.slots[0].gross);
});

test("a zero-value quote degrades without throwing or paying anyone", () => {
  const q = quoteFor("MOBILE_APP", 0);
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
  // net/(1-rate) is short by a rupee at many values. This runs if Almmatix ever
  // absorbs the fee instead of the students, so being a rupee short means a
  // student is quietly underpaid every single time.
  for (const net of [1, 99, 100, 3_240, 8_100, 12_240, 13_500, 99_999]) {
    const gross = grossUpFor(net);
    assert.ok(
      gross - platformFeeFor(gross, AGENCY_FEE_AUDIENCE) >= net,
      `grossUpFor(${net}) = ${gross} still nets less than ${net}`,
    );
    const under = gross - 1;
    assert.ok(
      under - platformFeeFor(under, AGENCY_FEE_AUDIENCE) < net,
      `grossUpFor(${net}) = ${gross} overshoots`,
    );
  }
  assert.equal(grossUpFor(0), 0);
});

/* -------------------------------------------------------------------------- */
/* The playbook                                                               */
/* -------------------------------------------------------------------------- */

test("the playbook is a gated sequence, not a list of suggestions", () => {
  assert.ok(PLAYBOOK.length >= 8);
  const keys = new Set();
  for (const stage of PLAYBOOK) {
    assert.ok(!keys.has(stage.key), `duplicate stage ${stage.key}`);
    keys.add(stage.key);
    // Every stage needs a hard precondition. Most agency disasters are a stage
    // started before its gate was met.
    assert.ok(stage.gate.length > 15, `${stage.key} has no real gate`);
    assert.ok(stage.detail.length > 25, `${stage.key} does not say why it matters`);
    assert.ok(["outreach", "pm", "client", "builders"].includes(stage.owner), `${stage.key} owner`);
  }
});

test("money gates come before build, and the care offer comes last", () => {
  const order = PLAYBOOK.map((s) => s.key);
  assert.ok(order.indexOf("sign") < order.indexOf("build"), "building before the money cleared");
  assert.ok(order.indexOf("quote") < order.indexOf("sign"), "signing before a written scope");
  assert.ok(order.indexOf("staff") < order.indexOf("kickoff"), "kicking off before it is staffed");
  assert.ok(order.indexOf("integrate") < order.indexOf("review"), "client reviewing unintegrated work");
  assert.ok(order.indexOf("settle") < order.indexOf("care"), "upselling before paying everyone");
  assert.equal(order[order.length - 1], "care", "the retainer offer must be the last thing, always");
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
  assert.ok(monthlyCapacity(3) > monthlyCapacity(2));
});

test("the GST runway shortens as revenue grows", () => {
  assert.equal(gstRunwayMonths(0), null);
  assert.equal(gstRunwayMonths(-1), null);
  const atThree = gstRunwayMonths(3 * 110_000);
  const atSix = gstRunwayMonths(6 * 110_000);
  assert.ok(atThree > atSix, "more revenue must mean less runway");
  assert.equal(atThree, Math.floor(GST_SERVICE_THRESHOLD / 330_000));
  assert.ok(atThree <= 7, `expected the threshold inside 7 months, got ${atThree}`);
});

/* -------------------------------------------------------------------------- */
/* The care book — the long game                                              */
/* -------------------------------------------------------------------------- */

test("a care book reports its cost in people, not only its revenue", () => {
  // Revenue on its own is the number that makes a retainer book look free.
  const book = careBook({ CARE_STANDARD: 15, CARE_PRIORITY: 5 });
  assert.equal(book.plans, 20);
  assert.equal(book.mrr, 15 * 6_000 + 5 * 12_000);
  assert.equal(book.arr, book.mrr * 12);
  assert.equal(book.hours, 15 * CARE_LOAD_HOURS.CARE_STANDARD + 5 * CARE_LOAD_HOURS.CARE_PRIORITY);
  assert.equal(book.maintainersNeeded, Math.ceil(book.hours / MAINTAINER_HOURS_PER_MONTH));
  assert.ok(book.maintainersNeeded > 0, "a book with revenue and no maintainers is a fiction");
  assert.equal(book.pmHours, 20 * PM_HOURS_PER_PLAN);
});

test("an empty book is zero everywhere and needs nobody", () => {
  const book = careBook({});
  assert.equal(book.plans, 0);
  assert.equal(book.mrr, 0);
  assert.equal(book.hours, 0);
  assert.equal(book.maintainersNeeded, 0);
  assert.equal(book.pmOverloaded, false);
  // Negative and fractional counts must not invent revenue.
  assert.equal(careBook({ CARE_STANDARD: -5 }).mrr, 0);
});

test("the book eventually overloads one PM, and says so", () => {
  // This is the assertion that stops the forecast being read as a hiring plan.
  // Care plans consume the same PM hours that deliver new projects.
  const small = careBook({ CARE_STANDARD: 4 });
  assert.equal(small.pmOverloaded, false);
  const big = careBook({ CARE_STANDARD: 200 });
  assert.equal(big.pmOverloaded, true);
  const threshold = Math.floor(PM_SPARE_HOURS_PER_MONTH / PM_HOURS_PER_PLAN);
  assert.equal(careBook({ CARE_STANDARD: threshold }).pmOverloaded, false);
  assert.equal(careBook({ CARE_STANDARD: threshold + 1 }).pmOverloaded, true);
});

test("a handful of care plans covers the whole fixed cost base", () => {
  assert.ok(FIXED_COSTS.length >= 3);
  assert.equal(FIXED_COSTS_MONTHLY, FIXED_COSTS.reduce((a, c) => a + c.monthly, 0));
  assert.ok(FIXED_COSTS_MONTHLY > 0);
  // The motivating fact: the company stops being funded by whatever landed this
  // month after only a few retainers.
  assert.ok(plansToCoverFixedCosts("CARE_STANDARD") <= 5);
  // And a bigger plan covers them faster than a smaller one.
  assert.ok(plansToCoverFixedCosts("CARE_PRIORITY") <= plansToCoverFixedCosts("CARE_ESSENTIAL"));
});

test("the forecast grows, is churn-aware, and never flatters itself", () => {
  const y1 = careBookForecast({ projectsPerMonth: 3, months: 12 });
  const y2 = careBookForecast({ projectsPerMonth: 3, months: 24 });
  assert.ok(y2.plans > y1.plans, "the book must grow");

  // Churn must actually bite: with churn applied, 12 months at 3/month and a
  // 60% attach rate must land BELOW the naive 12 * 3 * 0.6 = 21.6.
  assert.ok(y1.plans < 12 * 3 * CARE_ATTACH_TARGET, "churn is not being applied");
  assert.ok(y1.plans > 0);

  // Zero delivery means no book, however long you wait.
  assert.equal(careBookForecast({ projectsPerMonth: 0, months: 36 }).plans, 0);
  assert.equal(careBookForecast({ projectsPerMonth: 3, months: 0 }).plans, 0);

  // A worse attach rate must produce a smaller book.
  const poor = careBookForecast({ projectsPerMonth: 3, months: 12, attachRate: 0.2 });
  assert.ok(poor.plans < y1.plans);

  // By year one the recurring book should beat the margin on a single app —
  // this is the whole long-game claim, so it is asserted rather than asserted at.
  assert.ok(
    y1.mrr > quoteFor("MOBILE_APP").margin,
    `year-one MRR ${y1.mrr} does not beat one app's margin`,
  );
});

test("the planning assumptions are present and sane", () => {
  assert.ok(CARE_ANNUAL_ESCALATION > 0 && CARE_ANNUAL_ESCALATION < 0.5);
  assert.ok(CARE_ASSUMED_CHURN > 0 && CARE_ASSUMED_CHURN < 1, "zero churn is not a plan");
  assert.ok(CARE_ATTACH_TARGET > 0 && CARE_ATTACH_TARGET <= 1);
  assert.ok(RETAINER_COMMISSION_MONTHS > 0, "a commission that never ends is an annuity nobody works for");
  assert.ok(RETAINER_COMMISSION_MONTHS <= 24);
  // Support for clients WITHOUT a plan must be billable, or twenty live
  // projects become twenty free interruptions paid for out of new work.
  assert.ok(SUPPORT_HOURLY_RATE > 0);
});

/* -------------------------------------------------------------------------- */
/* Probation                                                                  */
/* -------------------------------------------------------------------------- */

test("the scorecard totals 100 and weights reliability over craft", () => {
  assert.equal(SCORECARD_TOTAL, 100);
  const byKey = Object.fromEntries(SCORECARD.map((s) => [s.key, s.weight]));
  assert.ok(
    byKey.on_time + byKey.responsive > SCORECARD_TOTAL / 2,
    "reliability must outweigh everything else combined — that is the whole filter",
  );
  assert.ok(byKey.on_time > byKey.craft, "shipping on time must beat code quality");
});

test("scoring is additive, bounded, and ignores absent marks", () => {
  assert.equal(scoreFrom({}), 0);
  assert.equal(scoreFrom(Object.fromEntries(SCORECARD.map((s) => [s.key, true]))), 100);
  assert.equal(scoreFrom({ on_time: true }), 40);
  assert.equal(scoreFrom({ on_time: true, responsive: true }), 60);
  assert.equal(scoreFrom({ on_time: true, craft: false }), 40);
});

test("the pass mark cannot be cleared on craft alone, nor missed on time alone", () => {
  assert.ok(PROBATION_PASS_MARK > 0 && PROBATION_PASS_MARK <= 100);
  const lateButTidy = scoreFrom({ responsive: true, asked: true, runs: true, craft: true });
  assert.ok(
    lateButTidy < PROBATION_PASS_MARK,
    `missing the deadline still scored ${lateButTidy}, which passes`,
  );
  assert.ok(scoreFrom({ on_time: true, responsive: true, runs: true }) >= PROBATION_PASS_MARK);
});

/* -------------------------------------------------------------------------- */
/* Cohorts                                                                    */
/* -------------------------------------------------------------------------- */

test("the funnel asks for more entrants than the target headcount", () => {
  for (const role of Object.keys(COHORT)) {
    assert.ok(
      entrantsNeeded(role) > COHORT[role].target,
      `${role}: recruiting to the target instead of the entry number leaves a hole`,
    );
  }
  assert.ok(entrantsNeeded("TECH") >= 30);
});
