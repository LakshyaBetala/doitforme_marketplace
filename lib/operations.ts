/**
 * HOW THE AGENCY ACTUALLY RUNS: one pipeline, every owner, every deadline.
 *
 * This file is the operating model. It exists because the model was previously
 * spread across three places that could not be reconciled — PLAYBOOK in
 * lib/agency.ts described the money, the outreach stages in lib/innerCircle.ts
 * described the front of the funnel, and the gate timestamps on `projects`
 * described delivery — with nothing stating who owns a step or how long it may
 * take. "The PM chases it" is not a process; it is a person remembering.
 *
 * THREE RULES THIS ENCODES, AND THEY ARE THE WHOLE DESIGN:
 *
 * 1. EVERY STEP HAS ONE OWNER. Not a team, not "the PM and the builder". A
 *    step with two owners is a step with none, and the failure mode of this
 *    business is not laziness — it is the fourth project going quiet while the
 *    second is on fire.
 *
 * 2. EVERY STEP HAS A CLOCK, and the clock is measured from a FACT already in
 *    the database — a timestamp on `projects`, a gig's `delivered_at`, a lead's
 *    `next_action_at`. Nothing here needs a new status column to be enforced,
 *    which is why it cannot go stale. See CLAUDE.md on `managed_status`.
 *
 * 3. MONEY MOVES ONLY AT GATES. No builder starts before escrow is funded, no
 *    commission tranche is raised before the gate that justifies it, and no
 *    work begins before the scope is signed. Escrow is what makes each of
 *    those a fact rather than a promise.
 */

import { PLATFORM_FEES } from "@/lib/fees";
import { AGENCY_FEE_AUDIENCE } from "@/lib/agency";

/** Who is accountable. Exactly one per step. */
export type Owner = "OUTREACH" | "ADMIN" | "PM" | "BUILDER" | "CLIENT";

/**
 * The twelve steps, in order, from a cold company to a signed-off project.
 *
 * `clock` is the number of WORKING days the owner has, measured from `from`.
 * `null` means the step has no deadline of its own because it is gated by
 * somebody else — a client deciding is not a step we can time.
 *
 * `gate` is the fact in the database that proves the step happened. If a step
 * has no gate it cannot be reported on, and a step nobody can report on is a
 * step that quietly stops happening.
 */
export type Step = {
  key: string;
  title: string;
  owner: Owner;
  /** What has to be true to move on. */
  exit: string;
  /** Working days allowed, from `from`. */
  clock: number | null;
  from: string;
  /** Column or row whose existence proves it. */
  gate: string;
  /** Why this deadline and not a different one. */
  why: string;
};

export const PIPELINE: Step[] = [
  {
    key: "find",
    title: "Find the company",
    owner: "OUTREACH",
    exit: "Lead exists with a named contact and a reason to call them.",
    clock: null,
    from: "—",
    gate: "outreach_leads row",
    why: "Prospecting has no deadline; it has a weekly target instead. A clock here would reward volume over fit, and a bad lead costs the PM more than no lead.",
  },
  {
    key: "contact",
    title: "Open the conversation",
    owner: "OUTREACH",
    exit: "First message sent and logged.",
    clock: 1,
    from: "lead created",
    gate: "outreach_touches row",
    why: "A lead nobody has contacted within a day is a lead someone else will. One day also keeps the list honest — if it cannot be contacted in a day it should not have been added.",
  },
  {
    key: "chase",
    title: "Follow up until they answer or refuse",
    owner: "OUTREACH",
    exit: "A reply, or the lead is marked lost.",
    clock: 3,
    from: "last touch",
    gate: "outreach_leads.next_action_at",
    why: "Three days is long enough not to nag and short enough that the company still remembers the first message. Past STALE_DAYS the lead is closed rather than carried — a pipeline of dead rows is how a salesperson stops trusting their own list.",
  },
  {
    key: "meeting",
    title: "Book the call, with the admin on it",
    owner: "OUTREACH",
    exit: "A meeting in the calendar that the admin has accepted.",
    clock: 3,
    from: "positive reply",
    gate: "outreach_leads.stage = 'meeting'",
    why: "THE ADMIN ATTENDS EVERY FIRST CALL, and this is not a formality. Scope, price and timeline are decided on that call, and an outreach member paid per close has every incentive to agree to a scope somebody else has to build. The person who carries the delivery risk has to be in the room.",
  },
  {
    key: "quote",
    title: "Scope it and send the quote",
    owner: "ADMIN",
    exit: "Written scope, exclusions, price and a date, sent to the client.",
    clock: 2,
    from: "meeting held",
    gate: "projects.scope_signed_at (pending)",
    why: "Two days while the conversation is still warm. Quoting from the SERVICES catalogue in lib/agency.ts rather than inventing a number is what keeps the builder fees fundable — a discount agreed on a call comes out of the margin, not the students.",
  },
  {
    key: "contract",
    title: "Get it signed",
    owner: "ADMIN",
    exit: "Client has accepted the scope in writing.",
    clock: null,
    from: "quote sent",
    gate: "projects.scope_signed_at",
    why: "NOTHING IS BUILT BEFORE THIS. The signed scope is what makes a change request billable instead of an argument, and the IP assignment in the programme terms is what lets Almmatix warrant the client owns the result. Under Indian copyright law the author owns the work absent written assignment, so without both documents the client has paid for software whose copyright sits with a student.",
  },
  {
    key: "deposit",
    title: "Take the first payment",
    owner: "ADMIN",
    exit: "First payment cleared.",
    clock: null,
    from: "scope signed",
    gate: "projects.first_payment_at",
    why: "The deposit is the real commitment test, and it is the gate that releases the outreach member's first commission tranche. A client who has signed but not paid has not started.",
  },
  {
    key: "assign",
    title: "Hand it to a PM",
    owner: "ADMIN",
    exit: "projects.pm_id set; PM has read the scope and accepted the date.",
    clock: 1,
    from: "first payment",
    gate: "projects.pm_id",
    why: "One day, because the delivery window starts whether or not anybody has been told. The PM ACCEPTS the date rather than receiving it — a deadline agreed by two people who will not build it is the one that slips.",
  },
  {
    key: "staff",
    title: "Break it into tasks and hire",
    owner: "PM",
    exit: "A project_tasks row per role, each with a fee and a due_on, each with a funded gig.",
    clock: 2,
    from: "pm assigned",
    gate: "project_tasks rows with gig_id",
    why: "Two days. Hiring goes through the real gig flow so escrow, delivery and request-changes all apply — probation taught us that an imitation of the flow teaches nobody how the flow works. Builders are picked on the SCORECARD and on current load, which the app's Team screen shows: two live briefs is a stretch, three is a missed deadline.",
  },
  {
    key: "build",
    title: "Build it",
    owner: "BUILDER",
    exit: "Work delivered on the gig.",
    clock: null,
    from: "gig funded",
    gate: "gigs.delivered_at",
    why: "The clock is the task's own due_on, not a fixed number, because a frontend slot and a backend slot are not the same length. project_tasks.due_on exists precisely because gigs.auto_release_at is an escrow timer and has never said anything about when work was due.",
  },
  {
    key: "review",
    title: "Review the delivery",
    owner: "PM",
    exit: "Approved, or changes requested in writing.",
    clock: 1,
    from: "delivered_at",
    gate: "gigs.status / request-changes",
    why: "ONE DAY, and the number is not arbitrary: escrow auto-releases 24h after delivery. A review SLA longer than the release timer means money leaves before anybody looked, so the two are deliberately the same. Changes go through request-changes, which cancels the timer rather than pausing it.",
  },
  {
    key: "integrate",
    title: "Put the pieces together and test",
    owner: "PM",
    exit: "A working build the client can use.",
    clock: 3,
    from: "last task approved",
    gate: "projects.integrated_at",
    why: "Integration is the PM's own work and the step most often forgotten in the estimate: two people shipping correct halves is not a product. Three days is what the quote assumes.",
  },
  {
    key: "accept",
    title: "Client signs off",
    owner: "CLIENT",
    exit: "Written acceptance.",
    clock: null,
    from: "handed to client",
    gate: "projects.accepted_at",
    why: "Not our clock. But after ACCEPTANCE_ASSUMED_DAYS of silence following a delivery the project is treated as accepted, because an unanswered sign-off otherwise holds the final commission tranche and the AMC offer open forever.",
  },
  {
    key: "handover",
    title: "Hand over and offer care",
    owner: "PM",
    exit: "Repos, credentials and docs transferred; AMC offered and the answer recorded.",
    clock: 3,
    from: "accepted_at",
    gate: "projects.handed_over_at, care_offered_at, care_answer",
    why: "Three days while the build is fresh. The AMC answer is recorded even when it is no, because an unasked question and a declined offer look identical afterwards and only one of them is a mistake.",
  },
];

/* -------------------------------------------------------------------------- */
/* The numbers the pipeline refers to                                         */
/* -------------------------------------------------------------------------- */

/** A lead with no reply after this many days is closed, not carried. */
export const STALE_DAYS = 14;

/** Silence after delivery that counts as acceptance. */
export const ACCEPTANCE_ASSUMED_DAYS = 5;

/**
 * Nudge a builder at this fraction of their task elapsed, not at the deadline.
 *
 * A warning that arrives on the due date is an obituary. At 60% there is still
 * time for the PM to add a second pair of hands, which is the only remedy that
 * actually works.
 */
export const NUDGE_AT = 0.6;

/** Working days a PM has before an untouched project escalates to the admin. */
export const SILENT_PROJECT_DAYS = 3;

/**
 * Two concurrent projects per PM, and the cap is published.
 *
 * The PM does client contact, integration, QA and a second developer's coding.
 * Outreach paid per close will find more than that, so intake is capped and a
 * lead past the cap is QUEUED with its commission locked to whoever found it —
 * nobody is punished for being good at their job.
 */
export const MAX_PROJECTS_PER_PM = 2;

/** Commission tranches, and the gate each one waits for. */
export const COMMISSION_GATES = [
  {
    // 'first' and 'final', not 1 and 2: these are the exact values the CHECK
    // constraint on outreach_commissions.tranche allows. Naming them anything
    // else here would be a second vocabulary for one concept, and the insert
    // would fail at runtime rather than at review.
    tranche: "first",
    share: 0.4,
    gate: "projects.first_payment_at",
    why: "The client's money actually arrived.",
  },
  {
    tranche: "final",
    share: 0.6,
    gate: "projects.accepted_at",
    why: "The client was happy with what they got.",
  },
] as const;

/**
 * Why it is split 40/60 rather than paid on signature.
 *
 * One payment on signature pays identically for a dream client and a nightmare
 * one, which gives the finder no reason to care whether the lead was any good.
 * Weighting the larger half on ACCEPTANCE means the person who sourced the work
 * is paid for work that was delivered successfully, not merely sold.
 */
export const COMMISSION_SPLIT_RATIONALE =
  "40% when the client's first payment clears, 60% on client acceptance, so the finder is paid for a good project rather than any project.";

/* -------------------------------------------------------------------------- */
/* Derived helpers                                                            */
/* -------------------------------------------------------------------------- */

/** Steps owned by one role, in pipeline order. */
export function stepsFor(owner: Owner): Step[] {
  return PIPELINE.filter((s) => s.owner === owner);
}

export function stepByKey(key: string): Step | undefined {
  return PIPELINE.find((s) => s.key === key);
}

/**
 * Working days from a date, skipping weekends.
 *
 * Every clock above is in WORKING days, because the builders are students with
 * classes and a Friday handover with a two-day SLA is not due on Sunday. A
 * deadline that lands on a day nobody works is a deadline that gets missed for
 * a reason that is not anybody's fault.
 */
export function addWorkingDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left--;
  }
  return d;
}

/** When a step is due, or null when it has no clock of its own. */
export function dueBy(step: Step, start: Date): Date | null {
  return step.clock === null ? null : addWorkingDays(start, step.clock);
}

/**
 * What DoItForMe takes, and from whom.
 *
 * The platform fee comes out of the RECIPIENT's payout, so Almmatix pays the
 * gross and the builder receives the net. That is why every quote carries both
 * and why the product only ever shows net: a student told one number who
 * receives a smaller one has been misled however correct the arithmetic was.
 */
export const COMMISSION_MODEL = {
  rate: PLATFORM_FEES[AGENCY_FEE_AUDIENCE],
  paidBy: "the recipient of the money, deducted from their payout",
  coversWhat: "escrow, KYC, the delivery record, dispute handling and payouts",
  why: "The fee buys the thing a GitHub portfolio cannot fake — a dated, client-funded, third-party-verified record that the work was delivered and paid for. That record is the platform's moat and the student's strongest credential.",
} as const;

/**
 * Escrow's role, stated once so it is not re-argued.
 *
 * Escrow is the reason this is a business and not a group chat. It converts
 * every promise in the pipeline into a fact: funded means the client really
 * paid, delivered means a dated artefact exists, released means a named person
 * approved it. A student's track record here is money-backed, which is what
 * makes the Inner Circle worth being in and what makes churn a design
 * parameter rather than a failure.
 */
export const ESCROW_ROLE = [
  "A builder never starts unfunded: the task's gig holds the money before the brief is accepted.",
  "Delivery is a dated artefact on the gig, not a message saying it is done.",
  "Release needs the payer's approval, or 24h of silence after delivery.",
  "Changes go through request-changes, which cancels the release timer rather than pausing it.",
  "Money only comes back through an admin-reviewed dispute. There is deliberately no self-serve refund anywhere in the product.",
] as const;
