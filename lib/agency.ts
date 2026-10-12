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
  /** Payment charges, our own tooling and licences. NOT servers - see PASS_THROUGH. */
  overhead: number;
};

/**
 * THE SPLIT, DERIVED FROM A REAL QUOTE RATHER THAN INVENTED.
 *
 * The owner priced one job end to end - a 1,50,000 mobile app at frontend
 * 7,000, backend and testing 13,000, PM 15,000, commission 10% - and these are
 * the shares that fall out of it. Keeping them as percentages rather than as
 * that job's rupee figures is what lets every other service in the catalogue be
 * priced the same way instead of guessed at.
 *
 *   delivery   20,000 / 1,50,000 = 13.33%  (2/15 exactly)
 *   PM         15,000 / 1,50,000 = 10%
 *   commission 15,000 / 1,50,000 = 10%
 *   overhead   12,000 / 1,50,000 = 8%   (raised from 4% - see OVERHEAD_BUDGET)
 *   Almmatix   88,000 / 1,50,000 = 58.67%
 *
 * WHY THE SPLIT IS FLAT AGAIN. An earlier version tiered it, on the grounds
 * that a flat pool share pays too little on cheap work. That reasoning was
 * wrong, and the implied STUDENT DAY RATE is what shows it: 13.33% of any price
 * buys the same roughly 900-a-day net, because the day count scales with the
 * price. A 1.5L app is 20 person-days and a 30,000 website is 4. Tiering the
 * share was quietly paying a different hourly rate for the same work depending
 * on which job it was attached to.
 *
 * WHAT THAT DOES MEAN is that a cheap service's SCOPE has to match its budget.
 * 4 person-days is a three-page site, not a six-page one. The fix for thin
 * small work is honest scope, not a bent split - see the `includes` on each
 * service.
 *
 * WHY A 62.67% MARGIN IS NOT GREED. It is high against the 25-35% a staffed
 * agency runs on, and the difference is exactly the cost base: no payroll, no
 * office, no bench sitting idle between projects, no recruiter. The client
 * still pays well under market. The one real risk is a student working out the
 * ratio - which is why the number that matters to them is the day rate, and why
 * the LADDER exists.
 */
export const DEAL_SPLIT: DealSplit = {
  commission: 0.1,
  // 2/15. Written as a fraction because 0.1333 would drift the app's frontend
  // fee off the 7,000 it was quoted at.
  delivery: 2 / 15,
  pm: 0.1,
  // Raised from 4% to fund the AI tooling the builders are given. See
  // OVERHEAD_BUDGET: the single most defensible thing this company does for a
  // student is hand them a Claude seat, and that has to be paid for somewhere
  // that is not the student's fee.
  overhead: 0.08,
};

export function splitFor(_dealValue?: number): DealSplit {
  return DEAL_SPLIT;
}

/** Almmatix's share, by subtraction. Never written down twice. */
export const MARGIN_SHARE =
  1 - DEAL_SPLIT.commission - DEAL_SPLIT.delivery - DEAL_SPLIT.pm - DEAL_SPLIT.overhead;

export function marginShareFor(_dealValue?: number): number {
  return MARGIN_SHARE;
}

/**
 * The net day rate every fee in the catalogue is really built on.
 *
 * Not used in the arithmetic - the split produces the fees - but asserted in
 * the tests, because it is the number a student actually experiences. A fee
 * that looks small next to the deal value can still be a good day's pay, and
 * this is the figure that tells you which it is.
 */
export const TARGET_STUDENT_DAY_RATE_NET = 900;

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
  | "AUDIT";

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
  family: "Websites" | "Apps & platforms" | "AI automation" | "Advisory";
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
    days: 5,
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
    pitch: "A fast, well-built three-page site that people can actually find.",
    price: 30_000,
    days: 10,
    family: "Websites",
    slots: [{ role: "FRONTEND", weight: 1 }],
    includes: [
      "Up to three pages",
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
    price: 70_000,
    days: 18,
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
    price: 55_000,
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
    price: 100_000,
    days: 25,
    family: "Apps & platforms",
    slots: [
      { role: "FRONTEND", weight: 7 },
      { role: "BACKEND", weight: 13 },
    ],
    includes: [
      "Customer accounts and sign-in",
      "Up to eight screens",
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
    days: 40,
    family: "Apps & platforms",
    // 7:13 so the pool pays exactly 7,000 and 13,000 at a 1.5L price - the
    // quote the whole split was derived from. Backend carries testing.
    slots: [
      { role: "MOBILE", weight: 7 },
      { role: "BACKEND", weight: 13 },
    ],
    includes: [
      "Android and iOS from one codebase",
      "Up to eight screens and one core workflow",
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
    price: 40_000,
    days: 14,
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
    price: 50_000,
    days: 14,
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
    price: 60_000,
    days: 15,
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
    days: 6,
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
];

export const SERVICE_BY_KEY: Record<ServiceKey, Service> = Object.fromEntries(
  SERVICES.map((s) => [s.key, s]),
) as Record<ServiceKey, Service>;

export function isServiceKey(v: unknown): v is ServiceKey {
  return typeof v === "string" && v in SERVICE_BY_KEY;
}

/** The most expensive thing we sell, and the quote the split was derived from. */
export const ANCHOR_SERVICE = SERVICE_BY_KEY.MOBILE_APP;


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
/* The AMC - derived from the build, not a fixed tier                         */
/* -------------------------------------------------------------------------- */

/**
 * WHY THE AMC IS A PERCENTAGE OF THE BUILD AND NOT A PRICE LIST.
 *
 * The previous version had three fixed plans - 3,500, 9,000 and 18,000 a month
 * - and attaching them to builds produced annual maintenance worth 70% to 233%
 * of the thing being maintained. Nobody who paid 18,000 for a landing page pays
 * 42,000 a year to keep it alive. A fixed plan cannot work because what there
 * is to maintain scales with what was built.
 *
 * Industry AMC on software is 15-25% of build cost a year. The owner's own
 * figure - 2,500 a month on a 1,50,000 app - is 20%, and 1,500 a month from
 * year two is 12%. So those are the rates, and every service's AMC falls out of
 * its price.
 *
 * THE RENEWAL RATE IS LOWER ON PURPOSE. Year one carries the settling-in: the
 * bugs that only appear under real use, the client still learning the system,
 * and one small change a month while they decide what they actually wanted.
 * After that a stable system genuinely costs less to keep alive, and a client
 * who sees the price go DOWN at renewal renews.
 *
 * THE FLOOR IS WHY SMALL BUILDS ARE BILLED ANNUALLY. A 30,000 website's AMC is
 * 500 a month. Invoicing, chasing and reconciling 500 costs more than 500, so
 * anything under AMC_MONTHLY_FLOOR is sold as one annual payment instead. Same
 * money, a twelfth of the admin.
 *
 * WHAT "ONE NEW FEATURE A MONTH" HAS TO MEAN. At 2,500 a month the maintainer's
 * share is 1,000, which buys about eight hours. That is comfortably enough for
 * updates, monitoring and one SMALL change - a field, a column, a report, a
 * copy change. It is not a new screen and it is not a new module. If "feature"
 * is left undefined the plan loses money on its third month, so the scope is
 * written into AMC_INCLUDES and anything larger is quoted at
 * SUPPORT_HOURLY_RATE.
 */

/** Year one, as a share of what the build cost. The owner's 2,500 on 1.5L. */
export const AMC_YEAR_ONE_RATE = 0.2;

/** Year two onward. A settled system costs less, and a falling price renews. */
export const AMC_RENEWAL_RATE = 0.12;

/** Below this a month, invoicing costs more than the invoice. Bill annually. */
export const AMC_MONTHLY_FLOOR = 1_000;

/** Charged for anything beyond the included change. Quote before doing it. */
export const SUPPORT_HOURLY_RATE = 1_500;
export const SUPPORT_MINIMUM_HOURS = 1;

export const AMC_INCLUDES = [
  "Security patches and dependency updates",
  "Uptime monitoring, with alerts to us not to you",
  "Bug fixes on anything we built",
  "One small change a month - a field, a column, a report, wording",
  "A reply within one working day",
] as const;

export const AMC_EXCLUDES = [
  "Hosting, domains and API usage (billed at cost)",
  "A new screen, module or integration - quoted separately",
  "Unused change-allowance carrying over to next month",
  "Work on anything we did not build",
] as const;

export type Amc = {
  /** The build this maintains. */
  buildPrice: number;
  yearOneAnnual: number;
  yearOneMonthly: number;
  renewalAnnual: number;
  renewalMonthly: number;
  /** 'monthly' once the monthly figure clears the floor, else one annual bill. */
  billing: "monthly" | "annual";
};

/**
 * The AMC that follows a build. Rounded to hundreds so it is quotable.
 */
export function amcFor(service: Service | ServiceKey, dealValueOverride?: number): Amc {
  const svc = typeof service === "string" ? SERVICE_BY_KEY[service] : service;
  const buildPrice = Math.max(0, Math.round(dealValueOverride ?? svc.price));

  const yearOneMonthly = roundFee((buildPrice * AMC_YEAR_ONE_RATE) / 12);
  const renewalMonthly = roundFee((buildPrice * AMC_RENEWAL_RATE) / 12);

  return {
    buildPrice,
    // The annual figure is twelve times the rounded monthly one, so the two
    // cannot disagree on an invoice.
    yearOneAnnual: yearOneMonthly * 12,
    yearOneMonthly,
    renewalAnnual: renewalMonthly * 12,
    renewalMonthly,
    billing: yearOneMonthly >= AMC_MONTHLY_FLOOR ? "monthly" : "annual",
  };
}

/**
 * How an AMC payment divides.
 *
 * DELIBERATELY NOT the build split. Most of an AMC is one person doing small
 * jobs: there is nothing to coordinate, so the PM share is small, and nobody is
 * selling it again every month, so the commission is capped at
 * RETAINER_COMMISSION_MONTHS. Running an AMC on the build split would pay a
 * recruiter and a manager in perpetuity for a sale and a handover that happened
 * once.
 */
export const RECURRING_SPLIT = {
  /** The maintainer off the tech bench. 1,000 of a 2,500 plan is ~8 hours. */
  maintainer: 0.4,
  pm: 0.1,
  /** Only for the first RETAINER_COMMISSION_MONTHS. */
  commission: 0.1,
  overhead: 0.05,
} as const;

export const RECURRING_MARGIN_SHARE =
  1 - RECURRING_SPLIT.maintainer - RECURRING_SPLIT.pm - RECURRING_SPLIT.commission - RECURRING_SPLIT.overhead;

/**
 * Outreach keeps earning on an AMC, but not for ever.
 *
 * A commission that never ends makes the first year's sales an annuity nobody
 * is still working for. Twelve months is long enough that selling the plan is
 * clearly worth doing, short enough that the book stays Almmatix's.
 */
export const RETAINER_COMMISSION_MONTHS = 12;

export type AmcBreakdown = {
  monthly: number;
  maintainer: Pay;
  projectManager: Pay;
  outreach: Pay;
  overhead: number;
  margin: number;
  platformRevenue: number;
};

/** One month of an AMC, broken out. `withCommission` is false after year one. */
export function amcBreakdown(monthly: number, withCommission = true): AmcBreakdown {
  const m = Math.max(0, Math.round(monthly));
  const pay = (gross: number): Pay => {
    const platformFee = platformFeeFor(gross, AGENCY_FEE_AUDIENCE);
    return { gross, platformFee, net: gross - platformFee };
  };

  const maintainer = pay(roundFee(m * RECURRING_SPLIT.maintainer));
  const projectManager = pay(roundFee(m * RECURRING_SPLIT.pm));
  const outreach = pay(withCommission ? roundFee(m * RECURRING_SPLIT.commission) : 0);
  const overhead = roundFee(m * RECURRING_SPLIT.overhead);
  const paidOut = maintainer.gross + projectManager.gross + outreach.gross + overhead;

  return {
    monthly: m,
    maintainer,
    projectManager,
    outreach,
    overhead,
    // The margin absorbs the rounding, so the lines always sum back to `monthly`.
    margin: m - paidOut,
    platformRevenue: maintainer.platformFee + projectManager.platformFee + outreach.platformFee,
  };
}

/* -------------------------------------------------------------------------- */
/* What the overhead actually buys                                            */
/* -------------------------------------------------------------------------- */

/**
 * ONE AI SEAT PER PROJECT, AND WHY IT IS THE BEST ARGUMENT WE HAVE.
 *
 * A student asked to accept a 10% platform fee is entitled to ask what it is
 * for. The honest answer used to be "escrow", which is real but abstract. Now
 * it is arithmetic: a frontend builder on a 7,000 fee pays a 700 fee and is
 * handed an AI seat worth 1,800 a month. They are AHEAD, before counting
 * escrow, the PM who absorbs the client, or the verified work record. That is a
 * recruiting line that happens to be true, which is the only kind worth having.
 *
 * The cost sits in OVERHEAD rather than being deducted from anyone's fee. A
 * tool taken out of a student's pay is a pay cut with extra steps.
 *
 * ONE CAVEAT WORTH KEEPING WRITTEN DOWN. A consumer Pro plan is a single-person
 * account and its usage limits are sized for one developer; three people on one
 * login will throttle, which costs exactly the speed the seat was bought for,
 * and credential sharing is not permitted on consumer plans. The per-seat team
 * plan is the product built for this. AI_SEAT_MONTHLY is therefore priced PER
 * SEAT, and SEATS_PER_PROJECT is the dial - set it to 1 to share and accept the
 * throttling, or to 3 to give the builders and the PM their own.
 */

/** Rupees per AI seat per month. Roughly USD 20 at the time of writing. */
export const AI_SEAT_MONTHLY = 1_800;

/**
 * Seats bought. One, shared, as the owner specified - with the throttling
 * caveat above.
 */
export const SEATS = 1;

/**
 * How many open projects one seat serves at a time.
 *
 * The seat is a MONTHLY SUBSCRIPTION, not a per-project purchase, so charging
 * a whole seat-month to a five-day landing page sent its overhead line
 * NEGATIVE - the 8% of a 12,000 job is 1,000 and a seat is 1,800. A PM carries
 * two projects (PROJECTS_PER_PM), and the same login serves both plus the PM,
 * so each project carries its share.
 */
export const PROJECTS_PER_SEAT = 2;

/** Working days in a month, for turning a project's length into seat-months. */
export const WORKING_DAYS_PER_MONTH = 21;

/**
 * What the overhead on one project is spent on.
 *
 * Written out because 8% is the line most likely to be quietly treated as
 * margin, and because the AI seats are the part that has to survive a cash
 * squeeze: cutting them makes every project slower, which costs more than the
 * seats did. Note that the Razorpay charge is NOT here - GATEWAY_FEE_RATE is
 * added on top of the invoice and paid by the client.
 */
export function overheadBudgetFor(service: Service | ServiceKey, dealValueOverride?: number) {
  const svc = typeof service === "string" ? SERVICE_BY_KEY[service] : service;
  const dealValue = Math.max(0, Math.round(dealValueOverride ?? svc.price));
  const total = roundFee(dealValue * DEAL_SPLIT.overhead);

  // Seat-months are billed against CALENDAR length, not effort: the
  // subscription runs while the project is open, whether or not anyone codes
  // that week. A two-month app is two seat-months.
  const months = Math.max(1, Math.ceil(svc.days / WORKING_DAYS_PER_MONTH));
  const aiSeats = roundFee((SEATS * months * AI_SEAT_MONTHLY) / PROJECTS_PER_SEAT);

  // Dev and staging hosting while it is being built. The client's own
  // production hosting is PASS_THROUGH and never ours.
  const staging = roundFee(Math.min(1_500, dealValue * 0.005));
  const rest = total - aiSeats - staging;

  return {
    total,
    months,
    aiSeats,
    staging,
    /** Design tools, licences, accounting share, and the buffer. */
    toolingAndAdmin: rest,
    /** Negative means the overhead share does not cover the seats. */
    coversSeats: rest >= 0,
  };
}

/**
 * What the platform fee costs a builder, against what they are handed.
 *
 * Exists so the recruiting claim is computed rather than asserted, and so a
 * test fails the day it stops being true rather than a student noticing first.
 *
 * SEAT VALUE IS REPLACEMENT COST, NOT OUR COST SHARE. An earlier version
 * credited each builder only their slice of what we pay - a shared seat over
 * two projects and two builders came to 450 - and on that basis a builder on a
 * 5,800 fee was 130 WORSE off. That measure is wrong. What the builder gets is
 * ACCESS for the length of the project, and the price of replacing that access
 * themselves is a full seat: AI_SEAT_MONTHLY a month, whoever else is also
 * logged in. Sharing degrades the access through throttling - that is the real
 * cost of SEATS being 1, and it is an argument for buying more seats, not for
 * valuing the benefit at a fraction.
 */
export function feeVersusToolingFor(service: Service | ServiceKey, dealValueOverride?: number) {
  const q = quoteFor(service, dealValueOverride);
  const budget = overheadBudgetFor(service, dealValueOverride);
  // What it would cost this builder to have the same access for as long as the
  // project runs.
  const seatValue = budget.months * AI_SEAT_MONTHLY;

  return q.slots.map((s) => ({
    role: s.role,
    fee: s.gross,
    platformFee: s.platformFee,
    seatValue,
    /** Positive means the access is worth more than the fee we take. */
    netBenefit: seatValue - s.platformFee,
    /** What WE pay for it, which is less because the seat is shared. */
    ourCost: budget.aiSeats,
  }));
}

/* -------------------------------------------------------------------------- */
/* The founding-client discount                                               */
/* -------------------------------------------------------------------------- */

/**
 * WHY A DISCOUNT AND NOT A LOWER PRICE LIST.
 *
 * An unknown company with no portfolio cannot win at mid-market, so the first
 * ten clients have to be bought cheaply. The obvious move is to publish cheap
 * prices. It is also the one that cannot be undone: a client who bought a
 * 30,000 website will never accept 45,000 for the same thing next year, and a
 * price list is read by everyone who was ever quoted from it.
 *
 * A discount off a real list price does the same job and reverses cleanly. The
 * client gets a visible concession in exchange for something we actually want
 * — a case study, a testimonial, a reference call — and when the references
 * exist the discount simply stops. Same catalogue, same work, 38% more
 * revenue, and no conversation in which anything "went up".
 *
 * The rate is set so the two ceilings the owner picked fall out exactly: a
 * 2,25,000 app discounts to 1,50,000 and a 45,000 website to 30,000.
 *
 * THE DISCOUNT COMES OFF EVERYONE'S SHARE, NOT OUT OF THE MARGIN ALONE. Pay is
 * derived from the money that actually arrives, so a founding project pays its
 * builders less than a full-price one. That is deliberate and it must be said
 * out loud when staffing: the alternative is absorbing the whole discount in
 * margin, which makes early clients unprofitable and quietly discourages the
 * very deals the discount exists to win. It also means every fee rises on its
 * own the day discounting ends.
 */

/** A third off, in exchange for a case study and a reference call. */
export const FOUNDING_DISCOUNT = 0.33;

/**
 * After this many delivered clients, the discount ends.
 *
 * A number rather than a date, because what retires it is having references,
 * not time passing. Written down so it is a policy and not a habit — an
 * "introductory" price with no stated end is just the price.
 */
export const FOUNDING_CLIENT_LIMIT = 10;

/** What a founding client actually pays. Rounded to a number a human would quote. */
export function foundingPrice(service: Service | ServiceKey): number {
  const svc = typeof service === "string" ? SERVICE_BY_KEY[service] : service;
  const raw = svc.price * (1 - FOUNDING_DISCOUNT);
  // Round DOWN to a clean figure: the discount should never read as calculated
  // to the rupee, and rounding down means the concession is never smaller than
  // promised.
  const step = raw >= 50_000 ? 5_000 : 1_000;
  return Math.floor(raw / step) * step;
}

/** The founding quote: same arithmetic, applied to the money that arrives. */
export function foundingQuoteFor(service: Service | ServiceKey): Quote {
  const svc = typeof service === "string" ? SERVICE_BY_KEY[service] : service;
  return quoteFor(svc, foundingPrice(svc));
}

/**
 * What the discount costs, per service — the number worth knowing before
 * offering it to the eleventh client out of habit.
 */
export function discountCost(service: Service | ServiceKey) {
  const svc = typeof service === "string" ? SERVICE_BY_KEY[service] : service;
  const list = quoteFor(svc);
  const founding = foundingQuoteFor(svc);
  return {
    listPrice: list.dealValue,
    foundingPrice: founding.dealValue,
    givenAway: list.dealValue - founding.dealValue,
    marginLost: list.margin - founding.margin,
    buildersLost: list.slots.reduce((a, s) => a + s.net, 0) - founding.slots.reduce((a, s) => a + s.net, 0),
    pmLost: list.projectManager.gross - founding.projectManager.gross,
  };
}

/* -------------------------------------------------------------------------- */
/* The long game: the AMC book, and what it costs to run                      */
/* -------------------------------------------------------------------------- */

/**
 * WHY THE AMC BOOK IS THE ACTUAL BUSINESS.
 *
 * A project is revenue once. An AMC is revenue every month for years, sold to
 * somebody who already trusts us - no outreach, no quote, and no commission
 * after the first year. Thirty plans averaging 2,000 is 60,000 a month that
 * nobody has to go and win again, arriving whether or not anything sold.
 *
 * THE TRAP. Every delivered project is a permanent support liability whether or
 * not the client pays for support. They ring regardless - it broke, it is
 * yours, they do not care what the contract says. Twenty live projects at one
 * problem each a month is twenty interruptions, and if they are free they are
 * paid for out of the margin on new work by the one person also delivering it.
 * So no plan means support billed at SUPPORT_HOURLY_RATE, quoted first, and
 * enforced from the very first client - a precedent of free fixes cannot be
 * withdrawn later.
 *
 * THE OTHER TRAP: THE BOOK EATS THE PM. Plans consume the same PM hours that
 * deliver new projects, which is the binding constraint on everything. Plans
 * are therefore staffed by a maintainer off the tech bench, and amcBook()
 * reports the headcount and the PM hours alongside the revenue - because
 * revenue on its own is the number that makes a book look free.
 */

/** Roughly how much work one plan is per month, by its monthly value. */
export function amcLoadHours(monthly: number): number {
  // The maintainer's share divided by the student day rate, in hours. A 2,500
  // plan pays 1,000, which is about a day: updates, monitoring, one small
  // change. Derived rather than tabulated so it cannot drift from the split.
  const toMaintainer = monthly * RECURRING_SPLIT.maintainer;
  return Math.max(1, Math.round((toMaintainer / TARGET_STUDENT_DAY_RATE_NET) * 8));
}

/**
 * Hours a month one maintainer covers.
 *
 * 40, not 20: maintenance is somebody's main gig rather than a side task, and
 * at 20 the forecast demanded six maintainers for nineteen plans - each
 * earning about 2,100 a month, which is too little to hold anyone. Fewer
 * people with more plans each is both cheaper to run and a better job.
 */
export const MAINTAINER_HOURS_PER_MONTH = 40;

/** Client-relationship time per plan that lands on the PM whatever the tier. */
export const PM_HOURS_PER_PLAN = 0.5;

/** A PM's own realistic monthly hours, after delivery work. */
export const PM_SPARE_HOURS_PER_MONTH = 12;

/** What share of delivered projects should end up on a plan. */
export const AMC_ATTACH_TARGET = 0.6;

/** Assumed annual churn, for planning. Zero churn is not a plan. */
export const AMC_ASSUMED_CHURN = 0.2;

/** Standard in an AMC: the price rises on renewal. Belongs in the contract. */
export const AMC_ANNUAL_ESCALATION = 0.1;

/**
 * A book of plans: the money, and what servicing it costs in people.
 *
 * Takes monthly values rather than plan names, because the AMC is derived from
 * each build and no two clients need pay the same.
 */
export function amcBook(monthlyValues: number[]) {
  const plans = monthlyValues.filter((v) => v > 0);
  const mrr = plans.reduce((a, v) => a + v, 0);
  const hours = plans.reduce((a, v) => a + amcLoadHours(v), 0);

  return {
    plans: plans.length,
    mrr,
    arr: mrr * 12,
    hours,
    maintainersNeeded: Math.ceil(hours / MAINTAINER_HOURS_PER_MONTH),
    pmHours: Number((plans.length * PM_HOURS_PER_PLAN).toFixed(1)),
    pmOverloaded: plans.length * PM_HOURS_PER_PLAN > PM_SPARE_HOURS_PER_MONTH,
  };
}

/**
 * What it costs to keep the lights on, monthly, independent of any project.
 *
 * The number the AMC book is measured against: once recurring revenue clears
 * this, every project is upside rather than survival. Estimates, to be replaced
 * with actuals - the point is that the comparison exists at all.
 */
export const FIXED_COSTS = [
  { key: "supabase", label: "Supabase (database, auth, storage)", monthly: 2_100 },
  { key: "cloudflare", label: "Cloudflare Workers and R2", monthly: 900 },
  { key: "ai_platform", label: "AI credits for the platform itself (KYC, moderation)", monthly: 1_500 },
  { key: "pm_seat", label: "The PM's own AI seat, which runs every month", monthly: AI_SEAT_MONTHLY },
  { key: "email", label: "Transactional email", monthly: 700 },
  { key: "domains", label: "Domains, SSL, misc tooling", monthly: 800 },
] as const;

export const FIXED_COSTS_MONTHLY = FIXED_COSTS.reduce((a, c) => a + c.monthly, 0);

/** How many plans at a given monthly value cover the fixed costs. */
export function plansToCoverFixedCosts(monthly: number): number {
  const perPlan = amcBreakdown(monthly).margin;
  if (perPlan <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(FIXED_COSTS_MONTHLY / perPlan);
}

/**
 * Where the book gets to, given a delivery rate and the attach target.
 *
 * Churn is applied before each month's additions, so the forecast reads
 * pessimistically. A model that flatters itself about retention is worse than
 * none, because it gets used to make hiring decisions.
 */
export function amcBookForecast(args: {
  projectsPerMonth: number;
  months: number;
  attachRate?: number;
  monthlyValue?: number;
}) {
  const attach = args.attachRate ?? AMC_ATTACH_TARGET;
  const value = args.monthlyValue ?? amcFor("WEB_PLATFORM").yearOneMonthly;
  const monthlyChurn = AMC_ASSUMED_CHURN / 12;

  let plans = 0;
  for (let m = 0; m < Math.max(0, Math.floor(args.months)); m++) {
    plans = plans * (1 - monthlyChurn) + args.projectsPerMonth * attach;
  }
  const settled = Math.floor(plans);
  return amcBook(Array.from({ length: settled }, () => value));
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
