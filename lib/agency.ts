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
 * Every rupee in a project is derived from the deal value and the split for its
 * tier. The first version of this model had the student fees written down as
 * literals (frontend 5k, backend 7k) against an 80k deal, and the fees were
 * therefore invisible arithmetic: they were whatever was left after the margin,
 * not whatever the work was worth. When the deal was repriced every literal had
 * to be rediscovered by hand. Here, changing one price moves the commission,
 * every student fee, the PM fee and the margin together and provably — see
 * tests/unit/agency.test.mjs, which asserts the lines always sum back to the
 * deal exactly.
 *
 * WHY WE UNDERCUT THE MARKET FLOOR, DELIBERATELY.
 *
 * Market rate for a 3-4 person team on a 3-month build is 3-6 lakh, and a
 * simple MVP floors around 50k-2L. Almmatix has no portfolio and no name, so it
 * cannot win at mid-market and should not try: the prices here sit at or under
 * the low end on purpose, to buy the first fifteen references. They are
 * expected to rise once there are case studies to point at.
 *
 * THE SMALL TIER IS A FUNNEL, NOT A BUSINESS. A 30k website pays its builder
 * about 8,100 net. That is a fair week for a second or third project and it is
 * not an income. The point of the small tier is that it converts a client
 * cheaply, and a converted client buys a CARE_PLAN — a 30k site that becomes an
 * 8k/month retainer is 1,26,000 in the first year. The income for students is
 * in the 1L+ tier; the income for Almmatix is in the retainer book.
 *
 * WHY THE SPLIT TIERS INSTEAD OF BEING FLAT. A flat 18% delivery pool is fine
 * at 1.5L and absurd at 30k, where it pays 5,400 for an entire website. Small
 * work is nearly all build and almost no management, so the pool share goes UP
 * as the price goes down and the margin share goes down with it. A flat split
 * would have quietly made every cheap job exploitative.
 *
 * SERVER COSTS ARE NOT OURS. Hosting, domains, app-store fees and third-party
 * API usage are billed to the client directly — see PASS_THROUGH. They used to
 * be absorbed in overhead, which meant a chatty AI feature silently ate the
 * margin of the project that shipped it. Overhead here is now only the things
 * that genuinely scale with our own work.
 *
 * INTERNATIONAL IS LATER, DELIBERATELY. Everything here is INR for Indian
 * clients. International work is a multiplier on this same catalogue plus an
 * export-invoicing and FX question, not a different product — so it needs no
 * structure today, and a dormant currency field would be a second source of
 * truth for prices before there is a single international client.
 */

import { platformFeeFor, type FeeAudience } from "./fees";

/* -------------------------------------------------------------------------- */
/* How a deal divides                                                         */
/* -------------------------------------------------------------------------- */

export type DealSplit = {
  /** Paid to the outreach member who found the client. */
  commission: number;
  /** Split between the students who build it, by role weight. */
  delivery: number;
  /** The project manager: client contact, integration, QA, second developer. */
  pm: number;
  /** Tooling, payment charges, our own licences. NOT servers — see PASS_THROUGH. */
  overhead: number;
};

/**
 * The split by deal size, cheapest tier first.
 *
 * `upTo` is exclusive. The commission share is constant at 10% across all three
 * on purpose: an outreach member should never have a reason to prefer one
 * service over another beyond its price, or they will steer every client toward
 * whichever one pays them best rather than whichever one the client needs.
 */
export const SPLIT_TIERS: Array<{ upTo: number; label: string; split: DealSplit }> = [
  {
    upTo: 50_000,
    label: "small",
    // Almost all build, almost no management. 44% margin.
    split: { commission: 0.1, delivery: 0.3, pm: 0.12, overhead: 0.04 },
  },
  {
    upTo: 100_000,
    label: "mid",
    // 47% margin.
    split: { commission: 0.1, delivery: 0.24, pm: 0.15, overhead: 0.04 },
  },
  {
    upTo: Number.POSITIVE_INFINITY,
    label: "large",
    // Three builders, integration, store submission, a client who expects
    // weekly answers. 48% margin.
    split: { commission: 0.1, delivery: 0.2, pm: 0.18, overhead: 0.04 },
  },
];

/**
 * WHY THE PM SHARE WENT UP AND THE MARGIN CAME DOWN.
 *
 * At a 13% large-tier share the PM earned 27,300 a month at full capacity —
 * two concurrent projects, every slot filled. That is a junior project
 * manager's salary for a job that is project manager, senior developer, QA,
 * integrator and account manager at once. Fine while the owner IS the PM, since
 * the fee and the margin both land in the same pocket; impossible the moment a
 * second PM has to be paid, which is the thing that caps the whole business.
 *
 * The five points came out of the MARGIN, not out of the builders. Two reasons.
 * A 53% margin exists to cover fixed salaries, an office and a bench that sits
 * idle between projects — and this company has none of those, so it was
 * over-collecting for costs it does not bear. And the builders at 12,240 net on
 * a mobile app are the hardest group to replace; funding the PM out of their
 * fees would pay for the bottleneck by shrinking the bench that feeds it.
 *
 * 44-48% is still well above the 25-35% a staffed agency runs on, and the
 * client still pays 3-5x less than market. That gap is the whole arbitrage:
 * variable costs instead of fixed ones.
 */

export function tierFor(dealValue: number) {
  return SPLIT_TIERS.find((t) => dealValue < t.upTo) ?? SPLIT_TIERS[SPLIT_TIERS.length - 1];
}

export function splitFor(dealValue: number): DealSplit {
  return tierFor(dealValue).split;
}

/** Almmatix's share, by subtraction. Never written down twice. */
export function marginShareFor(dealValue: number): number {
  const s = splitFor(dealValue);
  return 1 - s.commission - s.delivery - s.pm - s.overhead;
}

/**
 * Billed to the client at cost, on their own account wherever possible.
 *
 * Listed so a quote can say it out loud. "Plus hosting" discovered at handover
 * is the argument that loses the care plan, which is the part of the deal that
 * actually compounds.
 */
export const PASS_THROUGH = [
  "Hosting and servers",
  "Domain names and SSL",
  "Third-party API usage (AI models, maps, SMS, email)",
  "Payment gateway charges on their own takings",
  "App Store and Play Store developer fees",
  "Paid fonts, stock images and plugin licences",
] as const;

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
  | "LANDING_PAGE"
  | "MARKETING_SITE"
  | "ECOMMERCE"
  | "INTERNAL_TOOL"
  | "WEB_PLATFORM"
  | "MOBILE_APP"
  | "AI_WORKFLOW"
  | "AI_ASSISTANT"
  | "AI_DOCUMENTS"
  | "AUDIT"
  | "CARE_ESSENTIAL"
  | "CARE_STANDARD"
  | "CARE_PRIORITY";

export type Service = {
  key: ServiceKey;
  /** What the client sees on a quote. */
  name: string;
  /** One line a 20-year-old can say on a cold call without stumbling. */
  pitch: string;
  /** Client price in rupees, excluding GST and everything in PASS_THROUGH. */
  price: number;
  /** Working days, start to client acceptance. Quote this, not a guess. */
  days: number;
  /** The build slots, weighted. Weights need not sum to anything. */
  slots: RoleSlot[];
  /**
   * What the price buys, in the client's words. This is the scope-creep
   * defence: the quote, the contract and the brief all read from here, so
   * "that was not in scope" is a sentence with a document behind it.
   */
  includes: string[];
  /**
   * Named exclusions. Listed because the fight is never about what was
   * promised, it is about what the client assumed was obviously included.
   */
  excludes: string[];
  /** True for recurring revenue, where `price` is per month. */
  recurring?: boolean;
  family: "Websites" | "Apps & platforms" | "AI automation" | "Advisory" | "Care plans";
};

/**
 * What Almmatix sells. Ordered cheapest-first inside each family, because the
 * cheap end is what opens a conversation with a business that has never bought
 * software before.
 */
export const SERVICES: Service[] = [
  {
    key: "LANDING_PAGE",
    name: "Landing page",
    pitch: "One page that explains what you do and collects enquiries.",
    price: 12_000,
    days: 3,
    family: "Websites",
    slots: [{ role: "FRONTEND", weight: 1 }],
    includes: [
      "One page, mobile and desktop",
      "An enquiry form that emails you",
      "Your logo, colours, photos and text put in place",
      "Live on your domain, Google-indexable",
      "One round of changes",
    ],
    excludes: ["Writing your copy from scratch", "Logo design", "More than one page"],
  },
  {
    key: "MARKETING_SITE",
    name: "Business website",
    pitch: "A fast, well-built site of up to six pages that people can find.",
    price: 30_000,
    days: 8,
    family: "Websites",
    slots: [{ role: "FRONTEND", weight: 1 }],
    includes: [
      "Up to six pages",
      "Contact and enquiry forms",
      "Basic on-page SEO and a sitemap",
      "Works on phones, tablets and desktop",
      "A simple way for you to edit text yourself",
      "Two rounds of changes",
    ],
    excludes: [
      "Online payments or a shopping cart",
      "Logins or user accounts",
      "Blog content written for you",
      "Ongoing changes after handover (that is the care plan)",
    ],
  },
  {
    key: "ECOMMERCE",
    name: "Online store",
    pitch: "A store that takes payments, tracks stock and prints invoices.",
    price: 55_000,
    days: 14,
    family: "Websites",
    slots: [
      { role: "FRONTEND", weight: 5 },
      { role: "BACKEND", weight: 3 },
    ],
    includes: [
      "Product catalogue you can manage yourself",
      "Cart, checkout and one payment gateway",
      "Order list, stock counts and invoices",
      "Order confirmation emails",
      "Two rounds of changes",
    ],
    excludes: [
      "Loading your product catalogue for you",
      "Courier or delivery integrations",
      "A mobile app version",
      "Gateway charges on your own sales",
    ],
  },
  {
    key: "INTERNAL_TOOL",
    name: "Internal tool",
    pitch: "The dashboard that replaces the spreadsheet your team fights over.",
    price: 60_000,
    days: 12,
    family: "Apps & platforms",
    slots: [
      { role: "FRONTEND", weight: 3 },
      { role: "BACKEND", weight: 3 },
    ],
    includes: [
      "Staff logins with roles",
      "Up to five screens of forms, lists and filters",
      "Export to Excel",
      "Your existing data imported once",
      "Two rounds of changes",
    ],
    excludes: [
      "Connecting to accounting or ERP software",
      "A mobile app version",
      "Training beyond one walkthrough call",
    ],
  },
  {
    key: "WEB_PLATFORM",
    name: "Web platform",
    pitch: "A full web application with accounts, a database and an admin panel.",
    price: 110_000,
    days: 21,
    family: "Apps & platforms",
    slots: [
      { role: "FRONTEND", weight: 4 },
      { role: "BACKEND", weight: 5 },
    ],
    includes: [
      "Customer accounts and sign-in",
      "Up to twelve screens",
      "An admin panel for your team",
      "One payment gateway if you need it",
      "Transactional emails",
      "Two rounds of changes",
    ],
    excludes: [
      "Native mobile apps",
      "Integrations with software not named in the brief",
      "Load testing or compliance audits",
      "Features discovered after the brief is signed",
    ],
  },
  {
    key: "MOBILE_APP",
    name: "Mobile app",
    pitch: "One focused Android and iOS app from a single codebase, on both stores.",
    price: 150_000,
    days: 30,
    family: "Apps & platforms",
    slots: [
      { role: "MOBILE", weight: 5 },
      { role: "BACKEND", weight: 4 },
      { role: "QA", weight: 2 },
    ],
    includes: [
      "Android and iOS from one codebase",
      "Up to ten screens and one core workflow",
      "Accounts, sign-in and push notifications",
      "An admin panel to manage content",
      "Submitted to both stores on your developer accounts",
      "Two rounds of changes",
    ],
    excludes: [
      "Store developer-account fees",
      "Chat, video, maps-heavy or marketplace features unless quoted separately",
      "Guaranteed store approval (we fix rejections, Apple decides)",
      "Offline-first behaviour",
    ],
  },
  {
    key: "AI_WORKFLOW",
    name: "Workflow automation",
    pitch: "Your tools talk to each other, so nobody retypes anything.",
    price: 35_000,
    days: 7,
    family: "AI automation",
    slots: [{ role: "AI", weight: 1 }],
    includes: [
      "Up to three systems connected",
      "One automation running on a schedule or a trigger",
      "A log you can check, and alerts when it fails",
      "One round of changes",
    ],
    excludes: [
      "Subscriptions to the tools being connected",
      "API usage charges",
      "Fixing data that was already wrong",
    ],
  },
  {
    key: "AI_ASSISTANT",
    name: "AI support assistant",
    pitch: "An assistant trained on your own documents that answers customers.",
    price: 55_000,
    days: 10,
    family: "AI automation",
    slots: [
      { role: "AI", weight: 4 },
      { role: "FRONTEND", weight: 2 },
    ],
    includes: [
      "Trained on documents you supply",
      "A chat widget for your site or WhatsApp",
      "Hands over to a human when it is unsure",
      "A dashboard of what people asked",
      "One round of changes",
    ],
    excludes: [
      "AI model usage charges",
      "Writing or cleaning up your documents",
      "Any guarantee it will never be wrong",
    ],
  },
  {
    key: "AI_DOCUMENTS",
    name: "Document AI pipeline",
    pitch: "Invoices, bills and forms read automatically into your system.",
    price: 70_000,
    days: 12,
    family: "AI automation",
    slots: [
      { role: "AI", weight: 5 },
      { role: "BACKEND", weight: 3 },
    ],
    includes: [
      "Up to three document layouts",
      "Extracted data into your sheet, database or software",
      "A review screen for anything it is unsure about",
      "Accuracy measured on a sample you give us",
      "One round of changes",
    ],
    excludes: [
      "AI model usage charges",
      "Handwritten documents",
      "Layouts not supplied before the build starts",
    ],
  },
  {
    key: "AUDIT",
    name: "Technical audit",
    pitch: "A week reading your system, then a written plan you own.",
    price: 15_000,
    days: 5,
    family: "Advisory",
    slots: [{ role: "BACKEND", weight: 1 }],
    includes: [
      "A review of your code, hosting and costs",
      "A written report with prioritised fixes",
      "A one-hour call to walk you through it",
      "The report is yours to take to anyone",
    ],
    excludes: ["Doing any of the fixes", "Penetration testing", "Legal or compliance certification"],
  },
  {
    key: "CARE_ESSENTIAL",
    name: "Care plan — Essential",
    pitch: "It stays up, stays patched, and someone answers. Monthly.",
    price: 2_500,
    days: 30,
    recurring: true,
    family: "Care plans",
    slots: [{ role: "QA", weight: 1 }],
    includes: [
      "Security and dependency updates",
      "Uptime monitoring with alerts",
      "Bug fixes on what we built",
      "A reply within two working days",
    ],
    excludes: [
      "Hosting bills (billed at cost)",
      "Any change to how it works",
      "New screens, features or content",
    ],
  },
  {
    key: "CARE_STANDARD",
    name: "Care plan — Standard",
    pitch: "Everything in Essential, plus two hours of changes a month.",
    price: 6_000,
    days: 30,
    recurring: true,
    family: "Care plans",
    slots: [{ role: "QA", weight: 1 }],
    includes: [
      "Everything in Essential",
      "Two hours of small changes a month",
      "A reply within one working day",
      "A quarterly call on what to do next",
    ],
    excludes: [
      "Hosting bills (billed at cost)",
      "Unused hours carrying over",
      "New screens or features beyond the two hours",
    ],
  },
  {
    key: "CARE_PRIORITY",
    name: "Care plan — Priority",
    pitch: "A development partner on retainer, not just a safety net.",
    price: 12_000,
    days: 30,
    recurring: true,
    family: "Care plans",
    slots: [
      { role: "QA", weight: 2 },
      { role: "BACKEND", weight: 1 },
    ],
    includes: [
      "Everything in Standard",
      "Three hours of changes a month",
      "A reply within four working hours",
      "First in the queue when something breaks",
      "A named builder who already knows your system",
    ],
    excludes: [
      "Hosting bills (billed at cost)",
      "Unused hours carrying over",
      "A full new module (that is a project)",
    ],
  },
];

export const SERVICE_BY_KEY: Record<ServiceKey, Service> = Object.fromEntries(
  SERVICES.map((s) => [s.key, s]),
) as Record<ServiceKey, Service>;

export function isServiceKey(v: unknown): v is ServiceKey {
  return typeof v === "string" && v in SERVICE_BY_KEY;
}

/** The most expensive thing we sell, and the ceiling the owner set. */
export const ANCHOR_SERVICE = SERVICE_BY_KEY.MOBILE_APP;

/**
 * Outreach keeps earning on a retainer, but not for ever.
 *
 * A commission that never ends makes the first year's sales an annuity nobody
 * is still working for; twelve months is long enough that selling a care plan
 * is clearly worth doing, and short enough that the book stays Almmatix's.
 */
export const RETAINER_COMMISSION_MONTHS = 12;

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

export type Pay = { gross: number; platformFee: number; net: number };

export type Quote = {
  service: Service;
  /** Client price, excluding GST and PASS_THROUGH items. */
  dealValue: number;
  /** Which split tier this landed in, for showing our work. */
  tier: string;
  /** The outreach member's commission for finding the client. */
  outreach: Pay;
  projectManager: Pay;
  /** The build slots, pay derived from the pool and each slot's weight. */
  slots: PaySlot[];
  /** Tooling and payment charges. Not paid to a person, and not servers. */
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
  const split = splitFor(dealValue);

  const pay = (gross: number): Pay => {
    const platformFee = platformFeeFor(gross, AGENCY_FEE_AUDIENCE);
    return { gross, platformFee, net: gross - platformFee };
  };

  const outreach = pay(roundFee(dealValue * split.commission));
  const projectManager = pay(roundFee(dealValue * split.pm));

  const pool = dealValue * split.delivery;
  const weightTotal = svc.slots.reduce((a, s) => a + s.weight, 0) || 1;
  const slots: PaySlot[] = svc.slots.map((s) => ({
    role: s.role,
    label: DELIVERY_ROLE_LABEL[s.role],
    ...pay(roundFee((pool * s.weight) / weightTotal)),
  }));

  const overhead = roundFee(dealValue * split.overhead);
  const paidToPeople = outreach.gross + projectManager.gross + slots.reduce((a, s) => a + s.gross, 0);
  const totalCost = paidToPeople + overhead;

  return {
    service: svc,
    dealValue,
    tier: tierFor(dealValue).label,
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
/* The long game: the care book, and what it costs to run                     */
/* -------------------------------------------------------------------------- */

/**
 * WHY THE RETAINER BOOK IS THE ACTUAL BUSINESS.
 *
 * A project is revenue once. A care plan is revenue every month for years, and
 * it is sold to somebody who already trusts us — no outreach, no quote, no
 * commission after the first year. Fifteen Standard plans is 90,000 a month
 * that nobody has to go and win again, which is more than the margin on a
 * mobile app, arriving whether or not anyone sold anything that month.
 *
 * That is also what makes the cheap end of the catalogue rational. A 30,000
 * website is thin on its own; a 30,000 website that becomes a 6,000/month plan
 * is 1,02,000 in the first year and 72,000 a year after that. The small tier is
 * customer acquisition. The care book is the return.
 *
 * THE TRAP, AND IT IS A BIG ONE.
 *
 * Every project delivered is a permanent support liability whether or not the
 * client pays for support. They will ring regardless — it broke, it is yours,
 * they do not care what the contract says. Twenty live projects generating one
 * problem each a month is twenty interruptions, and if they are free they are
 * paid for out of the margin on new work, by the one person who is also
 * delivering it. So: no plan means support is billed at
 * SUPPORT_HOURLY_RATE, quoted before the work and with a minimum charge. That
 * has to be enforced from the first client, because a precedent of free fixes
 * cannot be withdrawn later.
 *
 * THE OTHER TRAP: A CARE BOOK EATS THE PM.
 *
 * Care plans are not passive income — they consume the same PM hours that
 * deliver new projects, which is the binding constraint on everything (see
 * monthlyCapacity). At 30 plans on PM_HOURS_PER_PLAN, the PM has lost most of a
 * working week before a single new project starts. The answer is that plans are
 * staffed by a MAINTAINER off the tech bench, not by the PM, and that
 * maintainer capacity is planned with the same seriousness as delivery
 * capacity. careCapacity() exists so the book cannot silently outgrow the
 * people servicing it.
 */

/** Charged when a client without a care plan asks for work. Quote before doing it. */
export const SUPPORT_HOURLY_RATE = 1_500;

/** Nothing is billed below this, because the admin alone costs more. */
export const SUPPORT_MINIMUM_HOURS = 1;

/**
 * Standard in an AMC: the price rises each year on renewal.
 *
 * Written down because the alternative is a plan sold in year one at a price
 * that is still being honoured in year four while every cost behind it has
 * risen. It belongs in the contract, not in a later awkward conversation.
 */
export const CARE_ANNUAL_ESCALATION = 0.1;

/**
 * Assumed annual churn on the care book, for planning only.
 *
 * Businesses close, get acquired, or decide their nephew can do it. Planning on
 * zero churn is how a revenue forecast becomes fiction; 20% is a cautious
 * industry-typical figure and should be replaced with the real number as soon
 * as there are twelve months of history.
 */
export const CARE_ASSUMED_CHURN = 0.2;

/**
 * What share of delivered projects should end up on a plan.
 *
 * The offer has to be made within a week of handover — see the `care` stage of
 * the PLAYBOOK. Asking a month later is asking a stranger, and the attach rate
 * collapses.
 */
export const CARE_ATTACH_TARGET = 0.6;

/** Roughly how much work one plan is, per month. */
export const CARE_LOAD_HOURS: Record<"CARE_ESSENTIAL" | "CARE_STANDARD" | "CARE_PRIORITY", number> = {
  CARE_ESSENTIAL: 1,
  CARE_STANDARD: 3,
  CARE_PRIORITY: 5,
};

/** A student on maintenance alongside their studies. Deliberately not 40. */
export const MAINTAINER_HOURS_PER_MONTH = 20;

/** Client relationship time per plan that lands on the PM regardless of tier. */
export const PM_HOURS_PER_PLAN = 0.5;

/** A PM's own realistic monthly hours, after delivery work. */
export const PM_SPARE_HOURS_PER_MONTH = 12;

export type CareKey = keyof typeof CARE_LOAD_HOURS;
export type CareBook = Partial<Record<CareKey, number>>;

/**
 * Monthly recurring revenue from a book of plans, and what servicing it costs
 * in people.
 *
 * Returns the constraint as well as the money, because the money on its own is
 * the number that makes a care book look free. `maintainersNeeded` is the real
 * hiring signal and `pmHours` is the one that quietly runs out first.
 */
export function careBook(book: CareBook) {
  let mrr = 0;
  let hours = 0;
  let plans = 0;

  for (const key of Object.keys(CARE_LOAD_HOURS) as CareKey[]) {
    const n = Math.max(0, Math.floor(book[key] ?? 0));
    if (!n) continue;
    plans += n;
    mrr += n * SERVICE_BY_KEY[key].price;
    hours += n * CARE_LOAD_HOURS[key];
  }

  return {
    plans,
    mrr,
    arr: mrr * 12,
    /** Maintenance hours a month across the whole book. */
    hours,
    maintainersNeeded: Math.ceil(hours / MAINTAINER_HOURS_PER_MONTH),
    /** PM hours the book consumes before any new project is touched. */
    pmHours: Number((plans * PM_HOURS_PER_PLAN).toFixed(1)),
    /** True when the book alone has outgrown one PM's spare capacity. */
    pmOverloaded: plans * PM_HOURS_PER_PLAN > PM_SPARE_HOURS_PER_MONTH,
  };
}

/**
 * What it costs to keep the lights on, monthly, independent of any project.
 *
 * Kept here rather than in a spreadsheet because it is the number the care book
 * is measured against: once recurring revenue clears this, every project is
 * upside rather than survival. These are estimates and should be replaced with
 * actuals — the point is that the comparison exists at all.
 */
export const FIXED_COSTS = [
  { key: "supabase", label: "Supabase (database, auth, storage)", monthly: 2_100 },
  { key: "cloudflare", label: "Cloudflare Workers and R2", monthly: 900 },
  { key: "ai", label: "AI model credits (KYC, assistants)", monthly: 1_500 },
  { key: "email", label: "Transactional email", monthly: 700 },
  { key: "domains", label: "Domains, SSL, misc tooling", monthly: 800 },
] as const;

export const FIXED_COSTS_MONTHLY = FIXED_COSTS.reduce((a, c) => a + c.monthly, 0);

/**
 * How many plans of one tier it takes to cover the fixed costs.
 *
 * The answer for Standard is small enough to be motivating, which is the
 * reason to compute it rather than guess: the first handful of care plans is
 * the moment the company stops being funded by whatever landed that month.
 */
export function plansToCoverFixedCosts(tier: CareKey): number {
  const q = quoteFor(tier);
  // Only the margin covers overheads. The commission, the maintainer's fee and
  // the PM fee are all real money going out the door.
  const perPlan = q.margin;
  if (perPlan <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(FIXED_COSTS_MONTHLY / perPlan);
}

/**
 * Where the care book gets to, given a delivery rate and the attach target.
 *
 * Churn is applied before the year's additions rather than after, so the
 * forecast is the pessimistic reading. A model that flatters itself about
 * retention is worse than no model, because it is used to make hiring
 * decisions.
 */
export function careBookForecast(args: {
  projectsPerMonth: number;
  months: number;
  attachRate?: number;
  tier?: CareKey;
}) {
  const attach = args.attachRate ?? CARE_ATTACH_TARGET;
  const tier = args.tier ?? "CARE_STANDARD";
  const monthlyChurn = CARE_ASSUMED_CHURN / 12;

  let plans = 0;
  for (let m = 0; m < Math.max(0, Math.floor(args.months)); m++) {
    plans = plans * (1 - monthlyChurn) + args.projectsPerMonth * attach;
  }
  const settled = Math.floor(plans);
  // careBook already reports `plans`, so it is not restated here — spreading it
  // over an explicit field silently wins and the two could disagree.
  return careBook({ [tier]: settled });
}

/* -------------------------------------------------------------------------- */
/* The playbook: what the PM actually does                                    */
/* -------------------------------------------------------------------------- */

/**
 * The stages of a project, in order, with the one thing that must be true
 * before the next can start.
 *
 * This exists because the PM is a single human doing client contact,
 * integration, QA and a second developer's coding, and the failure mode of that
 * job is not laziness — it is forgetting step three on the fourth project while
 * firefighting the second. A checklist that the dashboard can tick is the
 * difference between a process and a good intention.
 *
 * `gate` is deliberately a hard precondition, not advice. Most agency disasters
 * are a stage started before its gate was met: building before the scope was
 * signed, or releasing escrow before the work was integrated.
 */
export const PLAYBOOK = [
  {
    key: "qualify",
    title: "Qualify",
    owner: "outreach",
    gate: "You know their budget range and who signs.",
    detail:
      "Do not quote before this. A proposal written for someone who cannot sign is a day spent on nothing.",
  },
  {
    key: "quote",
    title: "Quote and scope",
    owner: "pm",
    gate: "The client has the written scope: what is included, what is not, the price and the date.",
    detail:
      "Read the service's includes and excludes to them out loud. The fight is never about what was promised, it is about what they assumed was obviously included.",
  },
  {
    key: "sign",
    title: "Signed and first payment",
    owner: "client",
    gate: "Scope accepted in writing and the first instalment has cleared.",
    detail:
      "No build starts on a verbal yes. This is also the gate that releases the outreach member's first commission tranche.",
  },
  {
    key: "staff",
    title: "Staff it",
    owner: "pm",
    gate: "Every role slot has a named member who has accepted the brief.",
    detail:
      "Check their current load before assigning. A member on two briefs will be late on both, and you will find out at the deadline.",
  },
  {
    key: "kickoff",
    title: "Kick off",
    owner: "pm",
    gate: "Everyone has the brief, the deadline and the repo; the client has given their assets.",
    detail:
      "Missing logos and missing content are the commonest cause of a slipped date, and they are always discovered in week two.",
  },
  {
    key: "build",
    title: "Build",
    owner: "builders",
    gate: "Each task delivered by its own due date.",
    detail:
      "You hold the client. Builders never talk to them. Chase a silent builder on day two, not on the deadline.",
  },
  {
    key: "integrate",
    title: "Integrate and test",
    owner: "pm",
    gate: "It runs end to end from a clean install, on a real phone or browser.",
    detail:
      "This is the step that is always skipped under time pressure, and it is the one the client judges you on.",
  },
  {
    key: "review",
    title: "Client review",
    owner: "client",
    gate: "Written acceptance, or changes listed and booked in.",
    detail:
      "Changes inside the agreed rounds are free. Anything else is quoted — never absorbed by you or by a builder.",
  },
  {
    key: "handover",
    title: "Hand over",
    owner: "pm",
    gate: "Client holds the accounts, the code and a short written handover.",
    detail:
      "Transfer hosting and store accounts into their name. Holding their infrastructure feels like security and reads as a hostage.",
  },
  {
    key: "settle",
    title: "Pay everyone",
    owner: "pm",
    gate: "Escrow released on every task and the final commission tranche raised.",
    detail:
      "Release only what is integrated and working, not what was merely submitted. Then pay out, the same week.",
  },
  {
    key: "care",
    title: "Offer the care plan",
    owner: "pm",
    gate: "Offered within a week of handover, and the answer recorded.",
    detail:
      "The retainer is where a cheap project becomes a real client. Asking a month later is asking a stranger.",
  },
] as const;

export type PlaybookStage = (typeof PLAYBOOK)[number]["key"];

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
export function feeForMember(baseGross: number, projectsCompleted: number): number {
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
