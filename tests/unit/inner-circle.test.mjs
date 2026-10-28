import { test } from "node:test";
import assert from "node:assert/strict";
import {
  workflowFor,
  workflowHeadline,
  isOverdue,
  isRole,
  isStage,
  OPEN_STAGES,
  OUTREACH_STAGES,
  INNER_CIRCLE_ROLES,
} from "../../lib/innerCircle.ts";

const states = (g) => workflowFor(g).map((s) => `${s.key}:${s.state}`);
const currents = (g) => workflowFor(g).filter((s) => s.state === "current");
const blocked = (g) => workflowFor(g).filter((s) => s.state === "blocked");

test("an unfinished brief has exactly one open step; a finished one has none", () => {
  // The invariant the UI depends on: never two "you are here" markers, and
  // never zero while there is still something to do.
  const unfinished = [
    {},
    { assigned_worker_id: "w" },
    { assigned_worker_id: "w", payment_status: "HELD" },
    { assigned_worker_id: "w", payment_status: "HELD", status: "delivered" },
    { assigned_worker_id: "w", payment_status: "HELD", status: "completed" },
  ];
  for (const g of unfinished) {
    const open = currents(g).length + blocked(g).length;
    assert.equal(open, 1, `expected one open step for ${JSON.stringify(g)}, got ${open}: ${states(g)}`);
  }

  // Paid is terminal. Zero open steps is correct here — the tracker is a record
  // at that point, not a prompt.
  const done = { assigned_worker_id: "w", payment_status: "released", status: "completed", paid_out: true };
  assert.equal(currents(done).length + blocked(done).length, 0, states(done).join(","));
});

test("an unassigned brief starts at the beginning", () => {
  const steps = workflowFor({});
  assert.equal(steps[0].state, "current");
  assert.equal(steps[0].key, "assigned");
});

test("escrow is the client's move, not the worker's", () => {
  // The single most common way a student loses work: starting before the money
  // is in. The step has to say plainly whose turn it is.
  const steps = workflowFor({ assigned_worker_id: "w" });
  const funding = steps.find((s) => s.key === "funded");
  assert.equal(funding.state, "current");
  assert.equal(funding.owner, "client");
});

test("building only counts as done once something was delivered", () => {
  // Funded-but-not-delivered must not mark "build" complete just because money
  // moved — that would tell someone they had finished work they had not started.
  const funded = workflowFor({ assigned_worker_id: "w", payment_status: "HELD" });
  assert.equal(funded.find((s) => s.key === "build").state, "current");

  const delivered = workflowFor({ assigned_worker_id: "w", payment_status: "HELD", status: "delivered" });
  assert.equal(delivered.find((s) => s.key === "build").state, "done");
});

test("delivered_at counts as delivered even when status has drifted", () => {
  // gigs.status is inconsistent across the codebase (SUBMITTED / delivered /
  // DELIVERED). The timestamp is the fact.
  const steps = workflowFor({ assigned_worker_id: "w", payment_status: "HELD", delivered_at: "2026-10-01T00:00:00Z" });
  assert.equal(steps.find((s) => s.key === "submit").state, "done");
});

test("a dispute blocks review rather than appearing as normal progress", () => {
  const g = {
    assigned_worker_id: "w",
    payment_status: "HELD",
    status: "delivered",
    dispute_reason: "not what we asked for",
  };
  const steps = workflowFor(g);
  const review = steps.find((s) => s.key === "review");
  assert.equal(review.state, "blocked");
  assert.equal(review.owner, "us", "a frozen dispute is on DoItForMe, not on either party");
  assert.equal(currents(g).length, 0, "a blocked gig has no current step — nothing is in motion");
  assert.equal(workflowHeadline(steps).key, "review");
});

test("a paid brief is complete end to end", () => {
  const steps = workflowFor({
    assigned_worker_id: "w",
    payment_status: "released",
    status: "completed",
    paid_out: true,
  });
  assert.ok(steps.every((s) => s.state === "done"), states({}).join(" "));
  assert.equal(workflowHeadline(steps).key, "paid");
});

test("approved but not yet paid still points at the payout", () => {
  const g = { assigned_worker_id: "w", payment_status: "PAYOUT_PENDING", status: "completed" };
  const steps = workflowFor(g);
  assert.equal(steps.find((s) => s.key === "paid").state, "current");
  assert.equal(workflowHeadline(steps).key, "paid");
});

test("overdue only applies to leads still in play", () => {
  const past = new Date(Date.now() - 864e5).toISOString();
  for (const stage of OPEN_STAGES) {
    assert.equal(isOverdue({ stage, next_action_at: past }), true, stage);
  }
  // A closed lead with a stale date is not work. Counting it would train people
  // to ignore the badge, which costs more than the badge is worth.
  for (const stage of ["won", "lost"]) {
    assert.equal(isOverdue({ stage, next_action_at: past }), false, stage);
  }
  assert.equal(isOverdue({ stage: "new", next_action_at: null }), false);
  assert.equal(isOverdue({ stage: "new", next_action_at: new Date(Date.now() + 864e5).toISOString() }), false);
});

test("role and stage guards reject unknown values", () => {
  assert.ok(isRole("TECH") && isRole("OUTREACH"));
  for (const bad of ["tech", "ADMIN", "", null, undefined, 1]) assert.equal(isRole(bad), false, String(bad));
  assert.ok(isStage("new") && isStage("won"));
  for (const bad of ["NEW", "pending", "", null]) assert.equal(isStage(bad), false, String(bad));
});

test("the role list and the DB constraint agree", () => {
  // The CHECK in 20261006_inner_circle_roles_and_outreach.sql allows exactly
  // these two. A third added here without the migration inserts a row that the
  // database rejects at submit time.
  assert.deepEqual(INNER_CIRCLE_ROLES.map((r) => r.value).sort(), ["OUTREACH", "TECH"]);
  assert.deepEqual(
    OUTREACH_STAGES.map((s) => s.value),
    ["new", "contacted", "replied", "meeting", "won", "lost"]
  );
});
