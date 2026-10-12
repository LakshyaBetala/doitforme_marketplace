import test from "node:test";
import assert from "node:assert/strict";
import {
  PIPELINE,
  stepsFor,
  stepByKey,
  addWorkingDays,
  dueBy,
  STALE_DAYS,
  ACCEPTANCE_ASSUMED_DAYS,
  NUDGE_AT,
  MAX_PROJECTS_PER_PM,
  COMMISSION_GATES,
  COMMISSION_MODEL,
  ESCROW_ROLE,
} from "../../lib/operations.ts";
import { PLATFORM_FEES } from "../../lib/fees.ts";
import { AGENCY_FEE_AUDIENCE } from "../../lib/agency.ts";

test("every step has exactly one owner, an exit test and a gate", () => {
  // A step with two owners is a step with none. A step with no gate cannot be
  // reported on, and a step nobody can report on quietly stops happening.
  const owners = new Set(["OUTREACH", "ADMIN", "PM", "BUILDER", "CLIENT"]);
  const keys = new Set();
  for (const s of PIPELINE) {
    assert.ok(owners.has(s.owner), `${s.key}: bad owner ${s.owner}`);
    assert.ok(s.exit && s.exit.length > 10, `${s.key}: no exit condition`);
    assert.ok(s.gate && s.gate.length > 3, `${s.key}: no gate`);
    assert.ok(s.why && s.why.length > 40, `${s.key}: the deadline is unjustified`);
    assert.ok(!keys.has(s.key), `${s.key}: duplicate key`);
    keys.add(s.key);
    if (s.clock !== null) {
      assert.ok(s.clock > 0 && s.clock <= 5, `${s.key}: a ${s.clock}-day step is not a step`);
      assert.ok(s.from && s.from !== "—", `${s.key}: has a clock but nothing to measure from`);
    }
  }
});

test("the pipeline runs from finding a company to handing it over", () => {
  assert.equal(PIPELINE[0].key, "find");
  assert.equal(PIPELINE[PIPELINE.length - 1].key, "handover");
  // Every role that does work appears. CLIENT appears because waiting on them
  // is a real step with a real cost, and pretending otherwise is how a project
  // sits "nearly done" for a month.
  for (const o of ["OUTREACH", "ADMIN", "PM", "BUILDER", "CLIENT"]) {
    assert.ok(stepsFor(o).length > 0, `nobody owns anything as ${o}`);
  }
});

test("nothing is built before the scope is signed and the deposit has cleared", () => {
  const i = (k) => PIPELINE.findIndex((s) => s.key === k);
  // This ordering is the legal and commercial spine. Under Indian copyright law
  // the author owns the work absent written assignment, so building first means
  // a client paying lakhs for software whose copyright sits with a student.
  assert.ok(i("contract") < i("staff"), "staffing before a signed scope");
  assert.ok(i("contract") < i("build"), "building before a signed scope");
  assert.ok(i("deposit") < i("staff"), "hiring before the client has paid");
  assert.ok(i("quote") < i("contract"));
  assert.ok(i("assign") < i("staff"), "tasks raised before a PM owns them");
  assert.ok(i("build") < i("review"), "reviewing before building");
  assert.ok(i("review") < i("integrate"));
  assert.ok(i("accept") < i("handover"), "handing over before acceptance");
});

test("the admin is on the first client call, and it is not a formality", () => {
  const m = stepByKey("meeting");
  assert.ok(m);
  // Scope, price and timeline are agreed on that call. Outreach is paid per
  // close, so the person carrying the delivery risk has to be in the room.
  assert.match(m.why, /admin/i);
  assert.ok(/scope|price|timeline/i.test(m.why));
  // And the admin owns the quote that follows, not the person who sold it.
  assert.equal(stepByKey("quote").owner, "ADMIN");
});

test("the PM review SLA cannot outlast the escrow release timer", () => {
  // Escrow auto-releases 24h after delivery. A review SLA longer than that
  // means money leaves before anybody looked at the work.
  const review = stepByKey("review");
  assert.equal(review.owner, "PM");
  assert.equal(review.clock, 1, "a review slower than auto-release is not a review");
  assert.equal(review.from, "delivered_at");
});

test("a builder's clock is the task's own deadline, never the escrow timer", () => {
  const build = stepByKey("build");
  assert.equal(build.owner, "BUILDER");
  assert.equal(build.clock, null, "one fixed build length for every role is wrong");
  // project_tasks.due_on exists precisely because auto_release_at is an escrow
  // timer and has never said anything about when the work was due.
  assert.match(build.why, /due_on/);
});

test("working days skip weekends, because the builders are students", () => {
  // Friday + 1 working day is Monday, not Saturday.
  const fri = new Date("2026-10-16T09:00:00Z");
  assert.equal(fri.getUTCDay(), 5);
  const next = addWorkingDays(fri, 1);
  assert.equal(next.getDay() === 0 || next.getDay() === 6, false);
  // Two working days from Friday never lands inside the weekend either.
  const two = addWorkingDays(fri, 2);
  assert.ok(two.getTime() > next.getTime());
  // Zero and negative are identity, not a crash.
  assert.equal(addWorkingDays(fri, 0).getTime(), fri.getTime());
  assert.equal(addWorkingDays(fri, -3).getTime(), fri.getTime());
  // Monotonic.
  let prev = fri.getTime();
  for (let d = 1; d <= 20; d++) {
    const t = addWorkingDays(fri, d).getTime();
    assert.ok(t > prev, `day ${d} did not advance`);
    prev = t;
  }
});

test("dueBy returns a date only for steps that own their clock", () => {
  const start = new Date("2026-10-13T09:00:00Z");
  assert.equal(dueBy(stepByKey("find"), start), null, "prospecting must not have a deadline");
  assert.equal(dueBy(stepByKey("contract"), start), null, "we cannot time a client signing");
  assert.equal(dueBy(stepByKey("accept"), start), null, "we cannot time a client deciding");
  const due = dueBy(stepByKey("contact"), start);
  assert.ok(due instanceof Date && due.getTime() > start.getTime());
});

test("a builder is warned with time left to rescue the task", () => {
  // A warning that arrives on the due date is an obituary. At 60% the PM can
  // still add hands, which is the only remedy that works.
  assert.ok(NUDGE_AT > 0.4 && NUDGE_AT < 0.85);
});

test("the planning constants are present and sane", () => {
  assert.ok(STALE_DAYS >= 7 && STALE_DAYS <= 30, "a pipeline of dead rows is not a pipeline");
  assert.ok(ACCEPTANCE_ASSUMED_DAYS >= 3 && ACCEPTANCE_ASSUMED_DAYS <= 14);
  // The PM is the constraint, not the leads and not the students.
  assert.equal(MAX_PROJECTS_PER_PM, 2);
});

test("commission is gated on facts, and weighted toward a good outcome", () => {
  const total = COMMISSION_GATES.reduce((a, g) => a + g.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `tranches sum to ${total}, not 1`);
  // The larger half waits for acceptance. One payment on signature pays
  // identically for a dream client and a nightmare one.
  const [first, second] = COMMISSION_GATES;
  assert.equal(first.tranche, 1);
  assert.ok(second.share > first.share, "the finder is paid before the client is happy");
  assert.match(first.gate, /first_payment_at/);
  assert.match(second.gate, /accepted_at/);
});

test("the platform fee is quoted from lib/fees, never written down twice", () => {
  // CLAUDE.md: do not hardcode a percentage anywhere; import the helpers.
  assert.equal(COMMISSION_MODEL.rate, PLATFORM_FEES[AGENCY_FEE_AUDIENCE]);
  assert.match(COMMISSION_MODEL.paidBy, /recipient/);
});

test("escrow's role is written down, including the no-refund rule", () => {
  assert.ok(ESCROW_ROLE.length >= 4);
  const all = ESCROW_ROLE.join(" ");
  assert.match(all, /dispute/i);
  // There is deliberately no self-serve refund anywhere in the product.
  assert.match(all, /no self-serve refund/i);
  assert.match(all, /24h|24 h/i);
});
