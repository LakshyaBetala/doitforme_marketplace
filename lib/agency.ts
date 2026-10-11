/**
 * The agency side: what we sell, for how much, and who gets paid what.
 *
 * WHY THIS FILE EXISTS.
 *
 * DoItForMe has supply and no demand. 1,254 gigs were posted and 12 were ever
 * assigned, because there was never a buyer — only students who wanted to earn.
 * The fix is not more students. It is a buyer: Almmatix sells software services
 * to real clients and hires the students to build them, paying through this
 * platform. Almmatix is the demand side, and this file is its price list.
 *
 * ONE DIAL, NOT TWENTY HARDCODED FEES.
 *
 * Every rupee in a project is derived from the deal value and `DEAL_SPLIT`. The
 * first version of this model had the student fees written down as literals
 * (frontend 5k, backend 7k) against an 80k deal, and the fees were therefore
 * invisible arithmetic: they were whatever was left after the margin, not
 * whatever the work was worth. When the deal was repriced every literal had to
 * be rediscovered by hand. Here, changing one price moves the commission, both
 * student fees, the PM fee and the margin together and provably — see
 * tests/unit/agency.test.mjs, which asserts the split always sums to the deal.
 *
 * WHY THE PRICES LOOK LIKE THIS.
 *
 * Market rate for a 3-4 person team on a 3-month build is 3-6 lakh (Clutch and
 * Indian agency pricing surveys, 2026); a simple MVP floors around 50k-2L. The
 * anchor here is 1.5L for a web platform, which is deliberately at the BOTTOM
 * of that band — cheap enough to win against an agency, expensive enough that
 * the people building it can be paid properly. The earlier 80k anchor was the
 * root cause of the 5k student fee: at the agency floor rate of 1,000/hr, 80k
 * buys 80 billable hours total across three people for an entire frontend, an
 * entire backend, integration and client management. The price implied far less
 * work than the scope described, and the shortfall came out of the students.
 *
 * NOT JUST APPS. The catalogue carries AI automation, internal tooling, audits
 * and a retainer on purpose. A single 1.5L price point makes outreach discard
 * every lead with a smaller budget; AUDIT exists so a 20k conversation becomes
 * a client instead of a "lost - no budget", and RETAINER is the difference
 * between an agency and a project shop that starts from zero every month.
 *
 * INTERNATIONAL IS LATER, DELIBERATELY. Everything here is INR for Indian
 * clients. International work is a multiplier on this same catalogue plus an
 * export-invoicing and FX question, not a different product — so it needs no
 * structure today, and adding a dormant currency field now would be a second
 * source of truth for prices before there is a single international client.
 */

import { platformFeeFor, type FeeAudience } from "./fees";

/* -------------------------------------------------------------------------- */
/* How a deal divides                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Where every rupee of a deal goes, as a share of deal value.
 *
 * These are shares of the CLIENT price, before the platform fee. The platform
 * fee is deducted from each recipient's payout (lib/fees.ts), so it is not a
 * line here — it is a slice of the three lines that are paid to people, and
 * `quoteFor()` reports it separately because it is money the workers pay, not
 * money Almmatix pays.
 */
export const DEAL_SPLIT = {
  /** Paid to the outreach member who found the client. */
  OUTREACH_COMMISSION: 0.1,
  /** Split between the students who build it, by role weight. */
  DELIVERY_POOL: 0.18,
  /** The project manager: client contact, integration, QA, second developer. */
  PROJECT_MANAGER: 0.13,
  /** Hosting, licences, tooling, payment charges, the unglamorous rest. */
  OVERHEAD: 0.08,
} as const;

/** Almmatix's share, by subtraction. Never written down twice. */
export const MARGIN_SHARE =
  1 -
  DEAL_SPLIT.OUTREACH_COMMISSION -
  DEAL_SPLIT.DELIVERY_POOL -
  DEAL_SPLIT.PROJECT_MANAGER -
  DEAL_SPLIT.OVERHEAD;

/** Almmatix posts as a company, so every project payment is Business rate. */
export const AGENCY_FEE_AUDIENCE: FeeAudience = "BUSINESS";

/** Fees are quoted in whole hundreds. A 12,340 fee reads as a mistake. */
const ROUND_TO = 100;
const roundFee = (n: number) => Math.round(n / ROUND_TO) * ROUND_TO;

/* -------------------------------------------------------------------------- */
/* Delivery roles                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A build role a student can hold.
 *
 * Deliberately specialised rather than "full stack". A specialist is faster on
 * their second project because they have seen the pattern; a generalist starts
 * over every time, and the bench never compounds.
 */
export type DeliveryRole = "FRONTEND" | "BACKEND" | "MOBILE" | "AI" | "QA" | "CONTENT";

export const DELIVERY_ROLE_LABEL: Record<DeliveryRole, string> = {
  FRONTEND: "Frontend",
  BACKEND: "Backend",
  MOBILE: "Mobile",
  AI: "AI / automation",
  QA: "QA & integration",
  CONTENT: "Content & copy",
};

/** One build slot on a project: the role, and its share of the delivery pool. */
export type RoleSlot = { role: DeliveryRole; weight: number };

/* -------------------------------------------------------------------------- */
/* The catalogue                                                              */
/* -------------------------------------------------------------------------- */

export type ServiceKey =
  | "WEB_PLATFORM"
  | "MARKETING_SITE"
  | "MOBILE_APP"
  | "ECOMMERCE"
  | "AI_ASSISTANT"
  | "AI_WORKFLOW"
  | "AI_DOCUMENTS"
  | "INTERNAL_TOOL"
  | "AUDIT"
  | "RETAINER";

export type Service = {
  key: ServiceKey;
  /** What the client sees on a quote. */
  name: string;
  /** One line a 20-year-old can say on a cold call without stumbling. */
  pitch: string;
  /** Client price in rupees, excluding GST. */
  price: number;
  /** Working days, start to client acceptance. Quote this, not a guess. */
  days: number;
  /** The build slots, weighted. Weights need not sum to anything. */
  slots: RoleSlot[];
  /** True for recurring revenue, where `price` is per month. */
  recurring?: boolean;
  /** Grouping for the quote sheet. */
  family: "Build" | "AI automation" | "Advisory";
};

/**
 * What Almmatix sells. Ordered so the quote sheet reads from the anchor
 * downward, with the cheap entry points last where they belong.
 */
export const SERVICES: Service[] = [
  {
    key: "WEB_PLATFORM",
    name: "Web platform",
    pitch: "A full web application with accounts, a database and an admin panel.",
    price: 150_000,
    days: 21,
    family: "Build",
    slots: [
      { role: "FRONTEND", weight: 4 },
      { role: "BACKEND", weight: 5 },
    ],
  },
  {
    key: "MOBILE_APP",
    name: "Mobile app",
    pitch: "One Android and iOS app from a single codebase, on both stores.",
    price: 225_000,
    days: 35,
    family: "Build",
    slots: [
      { role: "MOBILE", weight: 5 },
      { role: "BACKEND", weight: 4 },
      { role: "QA", weight: 2 },
    ],
  },
  {
    key: "ECOMMERCE",
    name: "Online store",
    pitch: "A store that takes payments, tracks stock and prints invoices.",
    price: 110_000,
    days: 18,
    family: "Build",
    slots: [
      { role: "FRONTEND", weight: 5 },
      { role: "BACKEND", weight: 3 },
    ],
  },
  {
    key: "INTERNAL_TOOL",
    name: "Internal tool",
    pitch: "The dashboard that replaces the spreadsheet your team fights over.",
    price: 85_000,
    days: 14,
    family: "Build",
    slots: [
      { role: "FRONTEND", weight: 3 },
      { role: "BACKEND", weight: 3 },
    ],
  },
  {
    key: "MARKETING_SITE",
    name: "Marketing website",
    pitch: "A fast, well-written site that ranks and converts. Not a template.",
    price: 45_000,
    days: 10,
    family: "Build",
    slots: [
      { role: "FRONTEND", weight: 4 },
      { role: "CONTENT", weight: 2 },
    ],
  },
  {
    key: "AI_DOCUMENTS",
    name: "Document AI pipeline",
    pitch: "Invoices, bills and forms read automatically into your system.",
    price: 90_000,
    days: 14,
    family: "AI automation",
    slots: [
      { role: "AI", weight: 5 },
      { role: "BACKEND", weight: 3 },
    ],
  },
  {
    key: "AI_ASSISTANT",
    name: "AI support assistant",
    pitch: "An assistant trained on your own documents that answers customers.",
    price: 75_000,
    days: 12,
    family: "AI automation",
    slots: [
      { role: "AI", weight: 4 },
      { role: "FRONTEND", weight: 2 },
    ],
  },
  {
    key: "AI_WORKFLOW",
    name: "Workflow automation",
    pitch: "Your tools talk to each other, so nobody retypes anything.",
    price: 60_000,
    days: 10,
    family: "AI automation",
    slots: [
      { role: "AI", weight: 3 },
      { role: "BACKEND", weight: 2 },
    ],
  },
  {
    key: "AUDIT",
    name: "Technical audit",
    pitch: "Two weeks reading your system, then a written plan you own.",
    price: 20_000,
    days: 7,
    family: "Advisory",
    slots: [{ role: "BACKEND", weight: 2 }],
  },
  {
    key: "RETAINER",
    name: "Care plan",
    pitch: "Hosting, updates, fixes and a named person who answers. Monthly.",
    price: 15_000,
    days: 30,
    recurring: true,
    family: "Advisory",
    slots: [{ role: "QA", weight: 2 }],
  },
];

export const SERVICE_BY_KEY: Record<ServiceKey, Service> = Object.fromEntries(
  SERVICES.map((s) => [s.key, s]),
) as Record<ServiceKey, Service>;

export function isServiceKey(v: unknown): v is ServiceKey {
  return typeof v === "string" && v in SERVICE_BY_KEY;
}

/** The anchor price, referenced in copy so one number cannot drift from the list. */
export const ANCHOR_SERVICE = SERVICE_BY_KEY.WEB_PLATFORM;

/* -------------------------------------------------------------------------- */
/* Quoting                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One person's pay on a project.
 *
 * `gross` is what the gig is posted at. `net` is what lands in their bank after
 * the platform fee. BOTH are here because quoting only the gross is how the
 * first payout becomes an argument: a student told "12,000" who receives
 * 10,800 has been misled, however correct the arithmetic was.
 */
export type PaySlot = {
  role: DeliveryRole;
  label: string;
  gross: number;
  platformFee: number;
  net: number;
};

export type Quote = {
  service: Service;
  /** Client price, excluding GST. */
  dealValue: number;
  /** The outreach member's commission for finding the client. */
  outreach: { gross: number; platformFee: number; net: number };
  projectManager: { gross: number; platformFee: number; net: number };
  /** The build slots, pay derived from the pool and each slot's weight. */
  slots: PaySlot[];
  /** Hosting, licences, tooling. Not paid to a person. */
  overhead: number;
  /** Everything Almmatix pays out: commission + pool + PM + overhead. */
  totalCost: number;
  /** dealValue - totalCost. */
  margin: number;
  /** Platform revenue: the fee slice of every payment to a person. */
  platformRevenue: number;
};

/**
 * The full breakdown for one sale. The only place project money is computed.
 *
 * Rounding is applied per line and the margin absorbs the remainder, so the
 * lines always sum back to the deal value exactly. Spreading the rounding error
 * across the people being paid would mean a student's quoted fee depended on
 * floating-point drift.
 */
export function quoteFor(service: Service | ServiceKey, dealValueOverride?: number): Quote {
  const svc = typeof service === "string" ? SERVICE_BY_KEY[service] : service;
  const dealValue = Math.max(0, Math.round(dealValueOverride ?? svc.price));

  const pay = (gross: number) => {
    const platformFee = platformFeeFor(gross, AGENCY_FEE_AUDIENCE);
    return { gross, platformFee, net: gross - platformFee };
  };

  const outreach = pay(roundFee(dealValue * DEAL_SPLIT.OUTREACH_COMMISSION));
  const projectManager = pay(roundFee(dealValue * DEAL_SPLIT.PROJECT_MANAGER));

  const pool = dealValue * DEAL_SPLIT.DELIVERY_POOL;
  const weightTotal = svc.slots.reduce((a, s) => a + s.weight, 0) || 1;
  const slots: PaySlot[] = svc.slots.map((s) => ({
    role: s.role,
    label: DELIVERY_ROLE_LABEL[s.role],
    ...pay(roundFee((pool * s.weight) / weightTotal)),
  }));

  const overhead = roundFee(dealValue * DEAL_SPLIT.OVERHEAD);
  const paidToPeople = outreach.gross + projectManager.gross + slots.reduce((a, s) => a + s.gross, 0);
  const totalCost = paidToPeople + overhead;

  return {
    service: svc,
    dealValue,
    outreach,
    projectManager,
    slots,
    overhead,
    totalCost,
    margin: dealValue - totalCost,
    platformRevenue:
      outreach.platformFee + projectManager.platformFee + slots.reduce((a, s) => a + s.platformFee, 0),
  };
}

/**
 * What to post a gig at so the worker nets a target figure.
 *
 * Needed if Almmatix decides to absorb the platform fee rather than have the
 * students carry it. Solving net = gross - ceil(gross * rate) exactly means
 * stepping up from the estimate, because ceil() is not invertible.
 */
export function grossUpFor(net: number, audience: FeeAudience = AGENCY_FEE_AUDIENCE): number {
  const target = Math.max(0, Math.round(net));
  if (target === 0) return 0;
  let gross = target;
  while (gross - platformFeeFor(gross, audience) < target) gross += 1;
  return gross;
}

/* -------------------------------------------------------------------------- */
/* The progression ladder                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What a member earns relative to the base fee, by projects completed.
 *
 * This is the retention mechanism, and it is published on purpose. The margin
 * here is better than the 25-35% an agency runs on, and the difference is
 * borrowed from students who do not yet know what the project sold for. They
 * will find out. The ladder is what makes staying better than leaving when they
 * do, and promotion to PM is the only scalable source of PMs — you cannot hire
 * an integrator-who-also-codes at this rate on the open market, you can only
 * grow one.
 */
export const LADDER = [
  { from: 0, multiplier: 1, title: "Builder", note: "Base rate. The PM carries you through the first one." },
  { from: 2, multiplier: 1.5, title: "Builder II", note: "You own your layer end to end." },
  { from: 4, multiplier: 2, title: "Lead", note: "You carry a junior and review their work." },
  { from: 7, multiplier: 2, title: "PM track", note: "You can run a project and hold the client." },
] as const;

export function ladderFor(projectsCompleted: number) {
  const n = Math.max(0, Math.floor(projectsCompleted || 0));
  return [...LADDER].reverse().find((l) => n >= l.from) ?? LADDER[0];
}

/** A member's actual fee for a slot, after the ladder is applied. */
export function feeForMember(baseGross: number, projectsCompleted: number): PaySlot["gross"] {
  return roundFee(baseGross * ladderFor(projectsCompleted).multiplier);
}

/* -------------------------------------------------------------------------- */
/* Capacity, and the GST wall                                                 */
/* -------------------------------------------------------------------------- */

/**
 * How many projects a month the team can actually deliver.
 *
 * The PM is the binding constraint, not the students and not the leads. A PM
 * doing client contact, integration, QA and a second developer's coding carries
 * two concurrent projects, strained. Outreach paid per close will find more
 * than that, which is why intake is capped and the cap is published: a lead
 * past the cap is queued for next month with the commission locked to whoever
 * found it, so nobody is punished for being good at their job.
 */
export const PROJECTS_PER_PM = 2;

export function monthlyCapacity(pmCount: number): number {
  return Math.max(0, Math.floor(pmCount || 0)) * PROJECTS_PER_PM;
}

/**
 * GST registration is compulsory for a service provider above this aggregate
 * annual turnover, and aggregate turnover is computed PAN-wide — so if Almmatix
 * and DoItForMe sit under the same PAN their revenues combine, platform fees
 * included. Lower in special-category states. Confirm with a CA before acting;
 * this is a planning number, not advice.
 */
export const GST_SERVICE_THRESHOLD = 2_000_000;

/** Months until the GST threshold, at a given monthly run rate. */
export function gstRunwayMonths(monthlyRevenue: number): number | null {
  if (!monthlyRevenue || monthlyRevenue <= 0) return null;
  return Math.max(0, Math.floor(GST_SERVICE_THRESHOLD / monthlyRevenue));
}

/* -------------------------------------------------------------------------- */
/* Probation: how we pick people                                              */
/* -------------------------------------------------------------------------- */

/**
 * The paid trial, and why there are two rounds.
 *
 * You cannot screen for consistency. A test measures ability; consistency is a
 * time series, so it can only be observed. Round one measures whether someone
 * can do the work. Round two, with unannounced timing, measures whether they do
 * it again — and that is the entire filter. Expect to lose half between them,
 * which is the point rather than a problem.
 *
 * Both rounds are posted as real gigs so they run the actual escrow, delivery
 * and request-changes flow. An applicant's first experience of being paid
 * should be the real thing.
 */
export const PROBATION = {
  TECH: {
    rounds: 2,
    fee: 1_500,
    hours: 6,
    deadlineHours: 72,
    gapDays: 18,
  },
  OUTREACH: {
    rounds: 2,
    /** Per qualified lead, capped at `cap`. */
    fee: 200,
    cap: 1_000,
    leads: 5,
    deadlineHours: 168,
  },
} as const;

/**
 * The scorecard, weighted toward behaviour over craft.
 *
 * On a three-week client deal the brilliant developer who goes dark for four
 * days is worse than the adequate one who answers every message, so reliability
 * carries 60 of the 100 points. Scoring craft first is how you end up with a
 * team that is individually impressive and collectively late.
 */
export const SCORECARD = [
  { key: "on_time", label: "Shipped by the deadline", weight: 40 },
  { key: "responsive", label: "Replied within 24 hours", weight: 20 },
  { key: "asked", label: "Asked a clarifying question before building", weight: 15 },
  { key: "runs", label: "Runs from a clean clone; README accurate", weight: 15 },
  { key: "craft", label: "Code structure and naming", weight: 10 },
] as const;

export type ScorecardKey = (typeof SCORECARD)[number]["key"];

export const SCORECARD_TOTAL = SCORECARD.reduce((a, s) => a + s.weight, 0);

/** Below this, a round is a fail. Two passes are needed to join. */
export const PROBATION_PASS_MARK = 70;

export function scoreFrom(marks: Partial<Record<ScorecardKey, boolean>>): number {
  return SCORECARD.reduce((a, s) => a + (marks[s.key] ? s.weight : 0), 0);
}

/* -------------------------------------------------------------------------- */
/* Cohort targets                                                             */
/* -------------------------------------------------------------------------- */

/**
 * How many people we are trying to end up with, and how many must enter.
 *
 * The funnel is the useful part. Recruiting to the target headcount instead of
 * the entry number is how you end up with four people and a three-week hole.
 */
export const COHORT = {
  OUTREACH: { target: 4, entryMultiplier: 4 },
  TECH: { target: 12, entryMultiplier: 3 },
} as const;

export function entrantsNeeded(role: keyof typeof COHORT): number {
  const c = COHORT[role];
  return c.target * c.entryMultiplier;
}
