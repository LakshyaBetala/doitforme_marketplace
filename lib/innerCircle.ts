/**
 * The Inner Circle: two roles, and the tech delivery workflow.
 *
 * WHY THE WORKFLOW IS DERIVED AND NOT STORED.
 *
 * The obvious move when someone asks for "the tech workflow, each step" is a
 * steps table with a current_step column. That would be the fourth state
 * machine describing the same gig. There are already three — `gigs.status`,
 * `gigs.payment_status` and `gigs.managed_status` — and CLAUDE.md records that
 * the third having to be kept manually in sync with the first is a standing
 * hazard. A fourth could disagree with all of them, and the one that disagrees
 * is always the one the UI reads.
 *
 * So `workflowFor()` is a pure projection of the columns that already decide
 * what is true: who it is assigned to, whether escrow is funded, whether work
 * was delivered, whether it was approved, whether a payout row exists. The
 * steps cannot drift from reality because they have no independent existence.
 * It is also directly unit-testable, which a table is not.
 */

export type InnerCircleRole = "TECH" | "OUTREACH";

export const INNER_CIRCLE_ROLES: {
  value: InnerCircleRole;
  label: string;
  tagline: string;
  blurb: string;
}[] = [
  {
    value: "TECH",
    label: "Build",
    tagline: "You do the work",
    blurb:
      "You take company briefs and ship them — code, design, writing, research. Paid per brief, money held in escrow before you start.",
  },
  {
    value: "OUTREACH",
    label: "Outreach",
    tagline: "You bring the work in",
    blurb:
      "You find the companies and open the conversation. You get a pipeline to work, and credit for what you close.",
  },
];

export function isRole(v: unknown): v is InnerCircleRole {
  return v === "TECH" || v === "OUTREACH";
}

/* -------------------------------------------------------------------------- */
/* The tech delivery workflow                                                 */
/* -------------------------------------------------------------------------- */

export type StepState = "done" | "current" | "blocked" | "todo";

export type WorkflowStep = {
  key: string;
  title: string;
  /** What the member should understand or do at this step. */
  detail: string;
  state: StepState;
  /** Whose move it is. Shown so nobody waits on themselves by mistake. */
  owner: "you" | "client" | "us";
};

export type WorkflowGig = {
  status?: string | null;
  payment_status?: string | null;
  assigned_worker_id?: string | null;
  delivered_at?: string | null;
  auto_release_at?: string | null;
  dispute_reason?: string | null;
  /** True when a payout_queue row for this gig has been paid out. */
  paid_out?: boolean | null;
};

const lc = (v: unknown) => String(v ?? "").toLowerCase();

/**
 * The seven steps of a brief, with exactly one marked `current`.
 *
 * A `blocked` step is deliberately distinct from `current`: a disputed gig is
 * not "in review", it is stopped and waiting on a human at DoItForMe. Collapsing
 * the two is how someone ends up refreshing a page for two days.
 */
export function workflowFor(gig: WorkflowGig): WorkflowStep[] {
  const status = lc(gig.status);
  const pay = lc(gig.payment_status);

  const assigned = Boolean(gig.assigned_worker_id);
  const funded = pay === "held" || pay === "escrow_funded" || pay === "payout_pending" || pay === "released";
  const delivered = status === "delivered" || Boolean(gig.delivered_at);
  const approved = status === "completed";
  const disputed = Boolean(gig.dispute_reason);
  const paid = Boolean(gig.paid_out);

  // Each step is (reached, isBlocked). The first step that is not reached
  // becomes `current`; a blocked step wins over being current.
  const spec: Array<[string, string, string, WorkflowStep["owner"], boolean, boolean]> = [
    [
      "assigned",
      "Brief is yours",
      "We put your name forward and the client accepted. Read the brief and say hello in chat.",
      "you",
      assigned,
      false,
    ],
    [
      "funded",
      "Money in escrow",
      "The client pays before you start. Do not begin unpaid work — if this is stuck, tell us.",
      "client",
      funded,
      false,
    ],
    [
      "build",
      "Build it",
      "Keep questions in the gig chat so there is a record. Anything agreed off-platform does not exist.",
      "you",
      funded && (delivered || approved || paid),
      false,
    ],
    [
      "submit",
      "Submit the work",
      "Upload files or a link. This starts a 24-hour clock — if the client goes quiet it releases on its own.",
      "you",
      delivered || approved || paid,
      false,
    ],
    [
      "review",
      disputed ? "On hold — we are reviewing" : "Client reviews it",
      disputed
        ? "The client raised a dispute, so escrow is frozen until someone here reads both sides. You do not need to do anything yet."
        : "They can approve, ask for changes, or let the 24 hours run out — all three pay you.",
      disputed ? "us" : "client",
      approved || paid,
      disputed,
    ],
    [
      "released",
      "Approved and released",
      "Escrow released and you are queued for payout, minus the platform fee.",
      "client",
      approved || paid,
      false,
    ],
    [
      "paid",
      "Paid to your UPI",
      "Payouts are sent by hand, usually within a day. Your UPI has to be on file or this cannot move.",
      "us",
      paid,
      false,
    ],
  ];

  let currentTaken = false;
  return spec.map(([key, title, detail, owner, reached, blocked]) => {
    let state: StepState;
    if (blocked) {
      state = "blocked";
      currentTaken = true;
    } else if (reached) {
      state = "done";
    } else if (!currentTaken) {
      state = "current";
      currentTaken = true;
    } else {
      state = "todo";
    }
    return { key, title, detail, state, owner };
  });
}

/** The one line to show on a card: what is happening, and whose move it is. */
export function workflowHeadline(steps: WorkflowStep[]): WorkflowStep | null {
  return (
    steps.find((s) => s.state === "blocked") ??
    steps.find((s) => s.state === "current") ??
    [...steps].reverse().find((s) => s.state === "done") ??
    null
  );
}

/* -------------------------------------------------------------------------- */
/* The outreach pipeline                                                      */
/* -------------------------------------------------------------------------- */

export const OUTREACH_STAGES = [
  { value: "new", label: "New", hint: "Not contacted yet" },
  { value: "contacted", label: "Contacted", hint: "Reached out, no reply yet" },
  { value: "replied", label: "Replied", hint: "They answered" },
  { value: "meeting", label: "Meeting", hint: "A call is booked or done" },
  { value: "won", label: "Won", hint: "They posted work" },
  { value: "lost", label: "Lost", hint: "Not now — note why" },
] as const;

export type OutreachStage = (typeof OUTREACH_STAGES)[number]["value"];

export const OPEN_STAGES: OutreachStage[] = ["new", "contacted", "replied", "meeting"];

export function isStage(v: unknown): v is OutreachStage {
  return OUTREACH_STAGES.some((s) => s.value === v);
}

export function stageLabel(v: string): string {
  return OUTREACH_STAGES.find((s) => s.value === v)?.label ?? v;
}

/**
 * Is this lead overdue a touch?
 *
 * Only open stages can be overdue. A won or lost lead with a stale
 * next_action_at is not work, and counting it as work is how a CRM trains people
 * to ignore its own red badges.
 */
export function isOverdue(lead: { stage: string; next_action_at?: string | null }, now = Date.now()): boolean {
  if (!lead.next_action_at) return false;
  if (!OPEN_STAGES.includes(lead.stage as OutreachStage)) return false;
  return new Date(lead.next_action_at).getTime() < now;
}
