/**
 * THE ACCESS MATRIX: who may see what, written down so it can be TESTED.
 *
 * This file does not enforce anything. RLS does. It exists because the rules
 * were only ever implicit in a dozen policies across four migrations, and an
 * implicit rule cannot be checked — so nobody could answer "can a builder see
 * the deal value" except by reading SQL and hoping.
 *
 * scripts/access-matrix-audit.mjs takes every row below and proves it against
 * the live database by actually becoming each role and running the query. A
 * claim here that the database does not honour is a FAILING TEST, not a stale
 * comment.
 *
 * THE ONE RULE THE WHOLE BUSINESS RESTS ON:
 *
 *   Only the PM sees the deal value and the build cost TOGETHER.
 *
 * Outreach sees deal value — it is their commission base. A builder sees their
 * own fee — it is their pay. Either alone is fine. Both together is the
 * arbitrage, and anybody holding it can either undercut Almmatix or walk the
 * client. That is why `projects` and `project_tasks` are two tables with
 * different policies instead of one convenient table: hiding a column in the UI
 * is not access control, and RLS is row-level so it cannot hide a column at
 * all. See 20261013_projects_and_pm_desk.sql.
 */

/** The roles that can hold data access. Not the same as the app's surfaces. */
export type Actor = "ANON" | "STUDENT" | "BUILDER" | "OUTREACH" | "PM" | "ADMIN";

export type Rule = {
  /** The table being read. */
  table: string;
  actor: Actor;
  /** "none" = not a single row. "own" = only rows tied to them. "all" = everything. */
  read: "none" | "own" | "all";
  /** Why this is the right answer, in business terms rather than SQL terms. */
  why: string;
};

export const MATRIX: Rule[] = [
  /* ---- projects: the client and what they paid ------------------------- */
  {
    table: "projects",
    actor: "ANON",
    read: "none",
    why: "Third-party contact details and contract values. The anon key ships inside every page load, so anything readable by it is public.",
  },
  {
    table: "projects",
    actor: "STUDENT",
    read: "none",
    why: "A marketplace user has no relationship to agency projects at all.",
  },
  {
    table: "projects",
    actor: "BUILDER",
    read: "none",
    why: "THE LOAD-BEARING ONE. A builder who sees the deal value next to their own fee is holding the arbitrage. They see their task and their pay, never the contract.",
  },
  {
    table: "projects",
    actor: "OUTREACH",
    read: "own",
    why: "Only projects from leads they personally found. A salesperson whose client asks 'how is it going' and cannot answer stops selling — and the deal value is their own commission base.",
  },
  {
    table: "projects",
    actor: "PM",
    read: "own",
    why: "The projects they run. They are the single point of contact, so they need the client identity, the value and the scope.",
  },
  { table: "projects", actor: "ADMIN", read: "all", why: "Signs the contracts and carries the risk." },

  /* ---- project_tasks: what each builder is paid ------------------------ */
  {
    table: "project_tasks",
    actor: "ANON",
    read: "none",
    why: "People's pay.",
  },
  {
    table: "project_tasks",
    actor: "BUILDER",
    read: "own",
    why: "Their own task and their own fee. Not a teammate's — one builder knowing another's rate for the same slot is a grievance, not transparency, because the slots are not identical work.",
  },
  {
    table: "project_tasks",
    actor: "OUTREACH",
    read: "none",
    why: "THE OTHER HALF OF THE LOAD-BEARING RULE. Outreach already sees deal value; giving them build cost hands them the full margin. Deliberately NOT in the projects_read policy's outreach branch.",
  },
  {
    table: "project_tasks",
    actor: "PM",
    read: "own",
    why: "The only role that sees value and cost together, because somebody has to price the work and that somebody carries the delivery risk.",
  },
  { table: "project_tasks", actor: "ADMIN", read: "all", why: "Sets the split in the first place." },

  /* ---- outreach_leads: other companies' contact details --------------- */
  {
    table: "outreach_leads",
    actor: "ANON",
    read: "none",
    why: "Third-party contact details. This is the table a competitor would most like to read.",
  },
  {
    table: "outreach_leads",
    actor: "BUILDER",
    read: "none",
    why: "A builder has no business in a lead list, and the nav deliberately does not show one.",
  },
  {
    table: "outreach_leads",
    actor: "OUTREACH",
    read: "all",
    why: "Deliberately team-wide, unlike earnings. A shared pipeline is what stops two members cold-emailing the same company in the same week — there is a unique index on the lowercased name for the same reason.",
  },
  { table: "outreach_leads", actor: "ADMIN", read: "all", why: "Runs the pipeline." },

  /* ---- outreach_commissions: somebody's pay --------------------------- */
  {
    table: "outreach_commissions",
    actor: "ANON",
    read: "none",
    why: "Pay, plus the value of a third party's deal.",
  },
  {
    table: "outreach_commissions",
    actor: "OUTREACH",
    read: "own",
    why: "Earnings are NOT team-readable. The shared-pipeline argument that makes leads visible to everyone does not extend to anybody's pay.",
  },
  { table: "outreach_commissions", actor: "ADMIN", read: "all", why: "Admin-write only: letting the person owed the money raise the row is not a pipeline, it is an invoice generator." },

  /* ---- program_probation_tasks: a score before anyone was told -------- */
  {
    table: "program_probation_tasks",
    actor: "ANON",
    read: "none",
    why: "A person's score, often before a decision has been communicated to them.",
  },
  {
    table: "program_probation_tasks",
    actor: "BUILDER",
    read: "own",
    why: "Their own rounds. Round two's timing is deliberately unannounced, so the row may exist before they know of it.",
  },
  { table: "program_probation_tasks", actor: "ADMIN", read: "all", why: "Scores them." },

  /* ---- users: the column-privilege case ------------------------------- */
  {
    table: "users",
    actor: "ANON",
    read: "own",
    why: "A deliberate, NARROW exception and the subtlest row here. `anon` keeps SELECT on a named safe column list only — RLS is row-level and cannot hide a column, so email, phone, upi_id and id_card_url are closed by COLUMN PRIVILEGES instead. A column added later is private by default, which is the right way round. 'own' here means 'the public columns', not 'the row'.",
  },
];

/** Every distinct table the matrix covers. */
export const TABLES = [...new Set(MATRIX.map((r) => r.table))];

export function rulesFor(table: string): Rule[] {
  return MATRIX.filter((r) => r.table === table);
}

export function ruleFor(table: string, actor: Actor): Rule | undefined {
  return MATRIX.find((r) => r.table === table && r.actor === actor);
}

/**
 * The combinations that must never co-occur, checked independently of the
 * matrix above so a careless edit to one row cannot quietly open the gap.
 *
 * Stated as "no single actor may read both of these tables beyond `none`,
 * except the roles listed". If a future migration adds an outreach branch to
 * project_tasks for convenience, this is what fails.
 */
export const FORBIDDEN_COMBINATIONS = [
  {
    tables: ["projects", "project_tasks"] as const,
    allowed: ["PM", "ADMIN"] as const,
    why: "Deal value plus build cost is the entire margin. Only the PM and the admin may hold both.",
  },
] as const;
