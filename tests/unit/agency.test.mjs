// Pins the agency pricing model.
//
// WHAT THESE TESTS ARE REALLY FOR. The split is not a guess: the owner priced
// one job end to end - a 1,50,000 mobile app at frontend 7,000, backend and
// testing 13,000, PM 15,000, commission 10% - and every share in DEAL_SPLIT
// falls out of that quote. So the first job of this file is to prove the model
// still reproduces that quote exactly. If it ever stops, the catalogue has
// drifted from the one price anybody actually agreed to.
//
// The rest is arithmetic that was wrong at some point and cost something: lines
// that did not sum back to the deal, a net figure that disagreed with
// lib/fees.ts, an overhead share too small to pay for the AI seat it is meant
// to fund, an AMC worth more per year than the thing it maintained, and a
// retainer book whose revenue was counted while the people needed to service it
// were not.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEAL_SPLIT, MARGIN_SHARE, splitFor, marginShareFor, TARGET_STUDENT_DAY_RATE_NET,
  SERVICES, SERVICE_BY_KEY, ANCHOR_SERVICE, PASS_THROUGH, quoteFor, grossUpFor,
  isServiceKey, AGENCY_FEE_AUDIENCE,
  foundingPrice, foundingQuoteFor, discountCost, FOUNDING_DISCOUNT, FOUNDING_CLIENT_LIMIT,
  AI_SEAT_MONTHLY, SEATS, PROJECTS_PER_SEAT, WORKING_DAYS_PER_MONTH,
  overheadBudgetFor, feeVersusToolingFor,
  amcFor, amcBreakdown, amcLoadHours, amcBook, amcBookForecast,
  AMC_YEAR_ONE_RATE, AMC_RENEWAL_RATE, AMC_MONTHLY_FLOOR, AMC_INCLUDES, AMC_EXCLUDES,
  AMC_ATTACH_TARGET, AMC_ASSUMED_CHURN, AMC_ANNUAL_ESCALATION,
  RECURRING_SPLIT, RECURRING_MARGIN_SHARE, RETAINER_COMMISSION_MONTHS, SUPPORT_HOURLY_RATE,
  MAINTAINER_HOURS_PER_MONTH, PM_HOURS_PER_PLAN, PM_SPARE_HOURS_PER_MONTH,
  PLAYBOOK, LADDER, ladderFor, PROJECTS_PER_PM, monthlyCapacity,
  gstRunwayMonths, GST_SERVICE_THRESHOLD,
  FIXED_COSTS, FIXED_COSTS_MONTHLY, plansToCoverFixedCosts,
  SCORECARD, SCORECARD_TOTAL, PROBATION_PASS_MARK, scoreFrom, COHORT, entrantsNeeded,
} from "../../lib/agency.ts";
import { platformFeeFor, PLATFORM_FEES } from "../../lib/fees.ts";

/* -------------------------------------------------------------------------- */
/* The quote the whole model was derived from                                 */
/* -------------------------------------------------------------------------- */

test("the 1.5L app reproduces the owner's own quote, to the rupee", () => {
  const q = quoteFor("MOBILE_APP");
  assert.equal(q.dealValue, 150_000);
  assert.equal(q.slots.length, 2, "two builders: the app side, and backend carrying testing");
  assert.equal(q.slots.find((s) => s.role === "MOBILE").gross, 7_000, "frontend was quoted at 7,000");
  assert.equal(q.slots.find((s) => s.role === "BACKEND").gross, 13_000, "backend+testing at 13,000");
  assert.equal(q.projectManager.gross, 15_000, "PM was quoted at 15,000");
  assert.equal(q.outreach.gross, 15_000, "commission is 10%");
  assert.equal(q.overhead, 12_000, "overhead is 8%");
  assert.equal(q.totalCost, 62_000);
  assert.equal(q.margin, 88_000);
});

test("the split is flat, and the shares are the ones that quote implies", () => {
  assert.equal(DEAL_SPLIT.commission, 0.1);
  assert.equal(DEAL_SPLIT.pm, 0.1);
  assert.equal(DEAL_SPLIT.overhead, 0.08);
  // 2/15 exactly. Writing 0.1333 would drift the app's frontend fee off 7,000.
  assert.equal(DEAL_SPLIT.delivery, 2 / 15);
  assert.ok(Math.abs(MARGIN_SHARE - 0.5866666) < 1e-5, `margin share is ${MARGIN_SHARE}`);
  assert.deepEqual(splitFor(12_000), splitFor(150_000), "flat means flat");
  assert.equal(marginShareFor(12_000), marginShareFor(150_000));
});

test("the split spends less than the deal and leaves a real margin", () => {
  const paidOut = DEAL_SPLIT.commission + DEAL_SPLIT.delivery + DEAL_SPLIT.pm + DEAL_SPLIT.overhead;
  assert.ok(paidOut < 1, "the split spends the whole deal - there is no margin");
  assert.ok(Math.abs(MARGIN_SHARE - (1 - paidOut)) < 1e-9, "MARGIN_SHARE must be the remainder, never restated");
  // High against a staffed agency's 25-35%, and that gap IS the cost base: no
  // payroll, no office, no bench idle between projects.
  assert.ok(MARGIN_SHARE > 0.4 && MARGIN_SHARE < 0.7);
});

test("agency work is billed at the Business rate, not the student rate", () => {
  assert.equal(AGENCY_FEE_AUDIENCE, "BUSINESS");
  assert.equal(PLATFORM_FEES[AGENCY_FEE_AUDIENCE], 0.1);
});

/* -------------------------------------------------------------------------- */
/* Why a flat share works: the implied day rate                               */
/* -------------------------------------------------------------------------- */

test("a flat delivery share pays the same day rate at every price", () => {
  // The argument FOR a flat pool, and why an earlier tiered version was wrong.
  // 13.33% of any price buys roughly the same 900-a-day net, because the day
  // count scales with the price. Tiering paid a different hourly rate for the
  // same work depending on which job it was attached to.
  for (const s of SERVICES) {
    const q = quoteFor(s);
    const personDays = q.slots.reduce((a, x) => a + x.net, 0) / TARGET_STUDENT_DAY_RATE_NET;
    // The calendar quoted to the client is LONGER than the paid effort, because
    // students build part-time around their studies. It must never be shorter:
    // that promises more work than the budget buys.
    assert.ok(
      s.days >= personDays * 0.9,
      `${s.key}: quotes ${s.days} days but funds only ${personDays.toFixed(1)} person-days`,
    );
    assert.ok(personDays >= 1, `${s.key}: funds less than a day of work`);
  }
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
    for (const slot of s.slots) assert.ok(slot.weight > 0, `${s.key} has a zero-weight slot`);
    // The scope IS the scope-creep defence. No written exclusions means a price
    // that will be eaten by assumptions.
    assert.ok(s.includes.length >= 3, `${s.key} does not say enough about what the price buys`);
    assert.ok(s.excludes.length >= 2, `${s.key} names no exclusions`);
    assert.equal(SERVICE_BY_KEY[s.key], s, `${s.key} missing from the lookup`);
    assert.ok(isServiceKey(s.key));
  }
  assert.ok(!isServiceKey("NOT_A_SERVICE"));
});

test("the two ceilings the owner set hold", () => {
  assert.equal(SERVICE_BY_KEY.MOBILE_APP.price, 150_000);
  assert.equal(SERVICE_BY_KEY.MARKETING_SITE.price, 30_000);
  assert.equal(ANCHOR_SERVICE.key, "MOBILE_APP");
  for (const s of SERVICES) assert.ok(s.price <= 150_000, `${s.key} is over the 1.5L ceiling`);
  assert.ok(Math.min(...SERVICES.map((s) => s.price)) <= 15_000, "nothing cheap enough to open a conversation");
});

test("server and usage costs are never inside a price", () => {
  // They used to sit in overhead, which meant a chatty AI feature silently ate
  // the margin of the project that shipped it.
  assert.ok(PASS_THROUGH.length >= 4);
  const all = PASS_THROUGH.join(" ").toLowerCase();
  for (const w of ["hosting", "domain", "api"]) assert.ok(all.includes(w), `PASS_THROUGH omits ${w}`);
  for (const key of ["AI_ASSISTANT", "AI_DOCUMENTS", "AI_WORKFLOW"]) {
    const ex = SERVICE_BY_KEY[key].excludes.join(" ").toLowerCase();
    assert.ok(/usage|charges|subscription/.test(ex), `${key} does not exclude usage charges`);
  }
});

/* -------------------------------------------------------------------------- */
/* Quoting                                                                    */
/* -------------------------------------------------------------------------- */

test("a quote never spends more than the deal, and the margin absorbs rounding", () => {
  for (const s of SERVICES) {
    const q = quoteFor(s);
    assert.equal(q.totalCost + q.margin, q.dealValue, `${s.key}: lines do not sum back to the deal`);
    assert.ok(q.margin > 0, `${s.key}: no margin left`);
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
    }
  }
});

test("platform revenue is exactly the fee on money paid to people", () => {
  for (const s of SERVICES) {
    const q = quoteFor(s);
    const expected = q.outreach.platformFee + q.projectManager.platformFee +
      q.slots.reduce((a, x) => a + x.platformFee, 0);
    assert.equal(q.platformRevenue, expected);
    assert.ok(q.platformRevenue < q.totalCost, "overhead is not paid to a person and must not be taxed");
  }
});

test("the delivery pool is split by weight, not evenly", () => {
  const by = Object.fromEntries(quoteFor("MOBILE_APP").slots.map((s) => [s.role, s.gross]));
  assert.ok(by.BACKEND > by.MOBILE, "backend carries testing and is weighted 13 to 7");
});

test("an override price reprices everyone proportionally", () => {
  const base = quoteFor("MOBILE_APP");
  const half = quoteFor("MOBILE_APP", 75_000);
  assert.equal(half.outreach.gross, base.outreach.gross / 2);
  assert.equal(half.projectManager.gross, base.projectManager.gross / 2);
});

test("a zero-value quote degrades without throwing or paying anyone", () => {
  const q = quoteFor("MOBILE_APP", 0);
  assert.equal(q.dealValue, 0);
  assert.equal(q.totalCost, 0);
  assert.equal(q.margin, 0);
  assert.equal(q.platformRevenue, 0);
});

test("grossUpFor inverts the fee exactly, despite the ceil", () => {
  // platformFeeFor rounds UP, so net/(1-rate) is a rupee short at many values.
  // This runs if Almmatix ever absorbs the fee instead of the students, so
  // being short means a student is quietly underpaid every single time.
  for (const net of [1, 99, 100, 6_300, 11_700, 13_500, 99_999]) {
    const gross = grossUpFor(net);
    assert.ok(gross - platformFeeFor(gross, AGENCY_FEE_AUDIENCE) >= net, `grossUpFor(${net}) nets too little`);
    assert.ok(gross - 1 - platformFeeFor(gross - 1, AGENCY_FEE_AUDIENCE) < net, `grossUpFor(${net}) overshoots`);
  }
  assert.equal(grossUpFor(0), 0);
});

/* -------------------------------------------------------------------------- */
/* The AI seat, and what the 10% fee is for                                   */
/* -------------------------------------------------------------------------- */

test("the overhead share covers the AI seat on EVERY service", () => {
  // Charging a whole seat-month to a five-day landing page sent its overhead
  // line negative: 8% of 12,000 is 1,000 and a seat is 1,800. The seat is a
  // monthly subscription shared across concurrent projects, not a per-project
  // purchase - which is what PROJECTS_PER_SEAT encodes.
  for (const s of SERVICES) {
    const b = overheadBudgetFor(s);
    assert.ok(b.coversSeats, `${s.key}: overhead of ${b.total} cannot pay for ${b.aiSeats} of seats`);
    assert.equal(b.total, quoteFor(s).overhead, `${s.key}: budget disagrees with the quote`);
    assert.equal(b.months, Math.max(1, Math.ceil(s.days / WORKING_DAYS_PER_MONTH)));
    assert.equal(b.aiSeats + b.staging + b.toolingAndAdmin, b.total, `${s.key}: budget does not sum`);
  }
  assert.ok(SEATS >= 1 && PROJECTS_PER_SEAT >= 1 && AI_SEAT_MONTHLY > 0);
});

test("a longer project buys more seat-months", () => {
  const app = overheadBudgetFor("MOBILE_APP");
  const site = overheadBudgetFor("MARKETING_SITE");
  assert.ok(app.months > site.months, "a 40-day app must cost more seat-months than a 10-day site");
  assert.ok(app.aiSeats > site.aiSeats);
});

test("every builder is better off for the fee we take, because of the seat", () => {
  // This is the answer to "what is the 10% for", and it is arithmetic rather
  // than a slogan - so it has to keep being true. If a price or the seat cost
  // moves far enough to make a builder net worse off, the recruiting claim is
  // false, and this test is how we find out rather than a student.
  for (const s of SERVICES) {
    for (const r of feeVersusToolingFor(s)) {
      assert.ok(
        r.netBenefit >= 0,
        `${s.key}/${r.role}: fee of ${r.platformFee} exceeds the ${r.seatValue} of tooling they get`,
      );
      assert.equal(r.platformFee, platformFeeFor(r.fee, AGENCY_FEE_AUDIENCE));
    }
  }
});

/* -------------------------------------------------------------------------- */
/* The AMC                                                                    */
/* -------------------------------------------------------------------------- */

test("the AMC is a share of the build, at industry rates", () => {
  // The previous version had three fixed plans, which produced annual
  // maintenance worth 70% to 233% of the thing being maintained. Industry is
  // 15-25% a year. The owner's figure - 2,500/month on a 1.5L app - is 20%,
  // and 1,500 from year two is 12%.
  assert.ok(AMC_YEAR_ONE_RATE >= 0.15 && AMC_YEAR_ONE_RATE <= 0.25, "year one is outside industry range");
  assert.ok(AMC_RENEWAL_RATE < AMC_YEAR_ONE_RATE, "renewal must be cheaper - a falling price renews");

  const app = amcFor("MOBILE_APP");
  assert.equal(app.yearOneMonthly, 2_500, "the owner's figure");
  assert.equal(app.renewalMonthly, 1_500, "the owner's renewal figure");
  assert.equal(app.yearOneAnnual, 30_000);
  assert.equal(app.billing, "monthly");
});

test("no AMC ever costs more per year than a sane share of its build", () => {
  for (const s of SERVICES) {
    if (s.key === "AUDIT") continue;
    const a = amcFor(s);
    const share = a.yearOneAnnual / s.price;
    assert.ok(share <= 0.3, `${s.key}: AMC is ${(share * 100).toFixed(0)}% of the build per year`);
    assert.ok(a.renewalAnnual < a.yearOneAnnual, `${s.key}: renewal is not cheaper`);
    // The annual figure must be twelve times the rounded monthly one, or a
    // quote and an invoice will disagree.
    assert.equal(a.yearOneAnnual, a.yearOneMonthly * 12);
    assert.equal(a.renewalAnnual, a.renewalMonthly * 12);
  }
});

test("small builds are billed annually, because invoicing 500 costs more than 500", () => {
  assert.equal(amcFor("MARKETING_SITE").billing, "annual");
  assert.equal(amcFor("MOBILE_APP").billing, "monthly");
  for (const s of SERVICES) {
    const a = amcFor(s);
    assert.equal(a.billing, a.yearOneMonthly >= AMC_MONTHLY_FLOOR ? "monthly" : "annual", `${s.key}`);
  }
});

test("the AMC says what it includes and what it does not", () => {
  // "One new feature a month" left undefined is how the plan loses money on its
  // third month. The included change has to be bounded in writing.
  assert.ok(AMC_INCLUDES.length >= 4 && AMC_EXCLUDES.length >= 3);
  assert.ok(/small change/.test(AMC_INCLUDES.join(" ").toLowerCase()), "the included change is not bounded");
  const exc = AMC_EXCLUDES.join(" ").toLowerCase();
  assert.ok(/new screen|module|integration/.test(exc), "nothing says a new module is excluded");
  assert.ok(/hosting/.test(exc), "hosting is not excluded");
});

test("an AMC month divides without overspending, and the commission expires", () => {
  const paidOut = RECURRING_SPLIT.maintainer + RECURRING_SPLIT.pm +
    RECURRING_SPLIT.commission + RECURRING_SPLIT.overhead;
  assert.ok(paidOut < 1);
  assert.ok(Math.abs(RECURRING_MARGIN_SHARE - (1 - paidOut)) < 1e-9);
  // Most of an AMC is one person doing small jobs, so the maintainer takes the
  // largest share. Running it on the BUILD split would pay a recruiter and a
  // manager in perpetuity for a sale and a handover that happened once.
  assert.ok(
    RECURRING_SPLIT.maintainer > RECURRING_SPLIT.pm + RECURRING_SPLIT.commission,
    "the person doing the work must take more than the people who are not",
  );
  assert.ok(RECURRING_SPLIT.maintainer > DEAL_SPLIT.delivery);

  for (const m of [500, 1_000, 1_700, 2_500, 3_600]) {
    const b = amcBreakdown(m);
    assert.equal(
      b.maintainer.gross + b.projectManager.gross + b.outreach.gross + b.overhead + b.margin,
      m,
      `${m}: AMC lines do not sum back to the month`,
    );
    assert.ok(b.margin > 0, `${m}: an AMC month is unprofitable`);
    assert.ok(b.maintainer.gross > 0, `${m}: nobody is paid to do the work`);
    // After twelve months nobody is still selling it, so the commission stops.
    const after = amcBreakdown(m, false);
    assert.equal(after.outreach.gross, 0);
    assert.ok(after.margin > b.margin, `${m}: dropping the commission did not help the margin`);
  }
  assert.ok(RETAINER_COMMISSION_MONTHS > 0 && RETAINER_COMMISSION_MONTHS <= 24);
});

test("AMC workload is derived from the maintainer's pay, not guessed", () => {
  assert.ok(amcLoadHours(2_500) >= 8, "a 2,500 plan must fund enough hours for a small change");
  assert.ok(amcLoadHours(3_600) > amcLoadHours(1_000), "a bigger plan must be more work");
  assert.ok(amcLoadHours(1) >= 1, "never zero hours - somebody still has to look");
});

/* -------------------------------------------------------------------------- */
/* The book, and what it costs to run                                         */
/* -------------------------------------------------------------------------- */

test("a book reports its cost in people, not only its revenue", () => {
  const values = [2_500, 2_500, 1_700, 1_000];
  const book = amcBook(values);
  assert.equal(book.plans, 4);
  assert.equal(book.mrr, 7_700);
  assert.equal(book.arr, 7_700 * 12);
  assert.equal(book.hours, values.reduce((a, v) => a + amcLoadHours(v), 0));
  assert.equal(book.maintainersNeeded, Math.ceil(book.hours / MAINTAINER_HOURS_PER_MONTH));
  assert.ok(book.maintainersNeeded >= 1, "a book with revenue and no maintainers is a fiction");
  assert.equal(book.pmHours, 4 * PM_HOURS_PER_PLAN);
});

test("an empty book is zero everywhere and needs nobody", () => {
  const book = amcBook([]);
  assert.equal(book.plans, 0);
  assert.equal(book.mrr, 0);
  assert.equal(book.maintainersNeeded, 0);
  assert.equal(book.pmOverloaded, false);
  assert.equal(amcBook([0, -500]).plans, 0, "junk must not invent revenue");
});

test("the book eventually overloads one PM, and says so", () => {
  // The assertion that stops the forecast being read as a hiring plan: plans
  // consume the same PM hours that deliver new projects.
  const threshold = Math.floor(PM_SPARE_HOURS_PER_MONTH / PM_HOURS_PER_PLAN);
  assert.equal(amcBook(Array(threshold).fill(1_700)).pmOverloaded, false);
  assert.equal(amcBook(Array(threshold + 1).fill(1_700)).pmOverloaded, true);
});

test("a handful of plans covers the whole fixed cost base", () => {
  assert.ok(FIXED_COSTS.length >= 3);
  assert.equal(FIXED_COSTS_MONTHLY, FIXED_COSTS.reduce((a, c) => a + c.monthly, 0));
  // The PM's own seat runs every month whether or not anything is in flight, so
  // it is a fixed cost and not project overhead.
  assert.ok(FIXED_COSTS.some((c) => c.monthly === AI_SEAT_MONTHLY), "the PM's seat is not in fixed costs");
  assert.ok(plansToCoverFixedCosts(2_500) <= 12);
  assert.ok(
    plansToCoverFixedCosts(2_500) < plansToCoverFixedCosts(1_000),
    "a bigger plan must cover the costs faster",
  );
});

test("the forecast grows, is churn-aware, and never flatters itself", () => {
  const y1 = amcBookForecast({ projectsPerMonth: 3, months: 12, monthlyValue: 1_700 });
  const y2 = amcBookForecast({ projectsPerMonth: 3, months: 24, monthlyValue: 1_700 });
  assert.ok(y2.plans > y1.plans, "the book must grow");
  assert.ok(y1.plans < 12 * 3 * AMC_ATTACH_TARGET, "churn is not being applied");
  assert.equal(amcBookForecast({ projectsPerMonth: 0, months: 36 }).plans, 0);
  assert.equal(amcBookForecast({ projectsPerMonth: 3, months: 0 }).plans, 0);
  const poor = amcBookForecast({ projectsPerMonth: 3, months: 12, attachRate: 0.2, monthlyValue: 1_700 });
  assert.ok(poor.plans < y1.plans, "a worse attach rate must produce a smaller book");
  assert.ok(y1.mrr > quoteFor("MOBILE_APP").margin / 3, `year-one MRR of ${y1.mrr} is not material`);
});

test("the planning assumptions are present and sane", () => {
  assert.ok(AMC_ANNUAL_ESCALATION > 0 && AMC_ANNUAL_ESCALATION < 0.5);
  assert.ok(AMC_ASSUMED_CHURN > 0 && AMC_ASSUMED_CHURN < 1, "zero churn is not a plan");
  assert.ok(AMC_ATTACH_TARGET > 0 && AMC_ATTACH_TARGET <= 1);
  // Support for clients WITHOUT a plan must be billable, or twenty live
  // projects become twenty free interruptions paid for out of new work.
  assert.ok(SUPPORT_HOURLY_RATE > 0);
});

/* -------------------------------------------------------------------------- */
/* The founding discount                                                      */
/* -------------------------------------------------------------------------- */

test("the discount is a real concession, rounds to a quotable number, and ends", () => {
  assert.ok(FOUNDING_DISCOUNT > 0.15 && FOUNDING_DISCOUNT < 0.5);
  assert.ok(FOUNDING_CLIENT_LIMIT > 0 && FOUNDING_CLIENT_LIMIT <= 25);
  for (const svc of SERVICES) {
    const fp = foundingPrice(svc);
    assert.ok(fp > 0 && fp < svc.price, `${svc.key}: founding price is not below list`);
    assert.ok(fp <= svc.price * (1 - FOUNDING_DISCOUNT), `${svc.key}: discount is short`);
    const step = fp >= 50_000 ? 5_000 : 1_000;
    assert.equal(fp % step, 0, `${svc.key}: ${fp} is not a number a human would quote`);
  }
});

test("a founding project still pays everyone, just less", () => {
  for (const svc of SERVICES) {
    const list = quoteFor(svc);
    const f = foundingQuoteFor(svc);
    assert.ok(f.margin > 0, `${svc.key}: a founding client is unprofitable`);
    assert.ok(f.margin < list.margin);
    for (const p of [f.outreach, f.projectManager, ...f.slots]) {
      assert.ok(p.net > 0, `${svc.key}: somebody nets nothing on a founding project`);
    }
    const c = discountCost(svc);
    assert.equal(c.givenAway, list.dealValue - f.dealValue);
    assert.ok(c.marginLost > 0 && c.marginLost < c.givenAway, `${svc.key}: the discount hit one line only`);
  }
});

/* -------------------------------------------------------------------------- */
/* The playbook, the ladder, capacity, GST, probation                         */
/* -------------------------------------------------------------------------- */

test("the playbook is a gated sequence, not a list of suggestions", () => {
  assert.ok(PLAYBOOK.length >= 8);
  const keys = new Set();
  for (const stage of PLAYBOOK) {
    assert.ok(!keys.has(stage.key), `duplicate stage ${stage.key}`);
    keys.add(stage.key);
    assert.ok(stage.gate.length > 15, `${stage.key} has no real gate`);
    assert.ok(stage.detail.length > 25, `${stage.key} does not say why it matters`);
    assert.ok(["outreach", "pm", "client", "builders"].includes(stage.owner));
  }
});

test("money gates come before build, and the care offer comes last", () => {
  const order = PLAYBOOK.map((s) => s.key);
  assert.ok(order.indexOf("quote") < order.indexOf("sign"), "signing before a written scope");
  assert.ok(order.indexOf("sign") < order.indexOf("build"), "building before the money cleared");
  assert.ok(order.indexOf("staff") < order.indexOf("kickoff"), "kicking off before it is staffed");
  assert.ok(order.indexOf("integrate") < order.indexOf("review"), "client reviewing unintegrated work");
  assert.ok(order.indexOf("settle") < order.indexOf("care"), "upselling before paying everyone");
  assert.equal(order[order.length - 1], "care", "the retainer offer must be last, always");
});

test("the ladder only ever goes up, and every rung is reachable", () => {
  assert.equal(ladderFor(0).multiplier, 1);
  assert.equal(ladderFor(-5).multiplier, 1, "negative history must not be a promotion");
  let last = 0;
  for (let i = 0; i <= 12; i++) {
    const m = ladderFor(i).multiplier;
    assert.ok(m >= last, `multiplier fell at ${i} projects`);
    last = m;
  }
  for (const rung of LADDER) assert.equal(ladderFor(rung.from).title, rung.title);
});

test("capacity is PM-bound and zero PMs means zero intake", () => {
  assert.equal(monthlyCapacity(0), 0);
  assert.equal(monthlyCapacity(1), PROJECTS_PER_PM);
  assert.ok(monthlyCapacity(3) > monthlyCapacity(2));
});

test("the GST runway shortens as revenue grows", () => {
  assert.equal(gstRunwayMonths(0), null);
  assert.equal(gstRunwayMonths(-1), null);
  const three = gstRunwayMonths(3 * 100_000);
  assert.ok(three > gstRunwayMonths(6 * 100_000), "more revenue must mean less runway");
  assert.equal(three, Math.floor(GST_SERVICE_THRESHOLD / 300_000));
  assert.ok(three <= 7, `expected the threshold inside 7 months, got ${three}`);
});

test("the scorecard totals 100 and weights reliability over craft", () => {
  assert.equal(SCORECARD_TOTAL, 100);
  const by = Object.fromEntries(SCORECARD.map((s) => [s.key, s.weight]));
  assert.ok(by.on_time + by.responsive > SCORECARD_TOTAL / 2, "reliability must outweigh the rest combined");
  assert.ok(by.on_time > by.craft, "shipping on time must beat code quality");
});

test("scoring is additive and bounded, and craft alone cannot pass", () => {
  assert.equal(scoreFrom({}), 0);
  assert.equal(scoreFrom(Object.fromEntries(SCORECARD.map((s) => [s.key, true]))), 100);
  assert.equal(scoreFrom({ on_time: true, craft: false }), 40);
  const lateButTidy = scoreFrom({ responsive: true, asked: true, runs: true, craft: true });
  assert.ok(lateButTidy < PROBATION_PASS_MARK, `missing the deadline scored ${lateButTidy}, which passes`);
  assert.ok(scoreFrom({ on_time: true, responsive: true, runs: true }) >= PROBATION_PASS_MARK);
});

test("the funnel asks for more entrants than the target headcount", () => {
  for (const role of Object.keys(COHORT)) {
    assert.ok(entrantsNeeded(role) > COHORT[role].target, `${role}: recruiting to target leaves a hole`);
  }
  assert.ok(entrantsNeeded("TECH") >= 30);
});
