/**
 * The terms a member accepts before they are given any paid work.
 *
 * WHY THE TERMS ARE CODE AND NOT A PDF.
 *
 * Two reasons. First, acceptance has to be enforceable at the point of work:
 * /api/program/terms writes a row, and the probation and assignment paths
 * refuse without one. A PDF emailed around cannot gate anything. Second, the
 * clause that matters most — IP assignment — is worthless unless we can say
 * exactly which words a specific person agreed to on a specific date. So the
 * text lives here under version control, `TERMS_VERSION` is stored on every
 * acceptance, and changing a clause materially means bumping the version, which
 * re-asks everyone. A terms page that can be edited without invalidating old
 * acceptances is a terms page that proves nothing.
 *
 * THE ONE THAT CAN COST REAL MONEY. Under Indian copyright law the author owns
 * the work unless it is assigned in writing. Without IP_ASSIGNMENT below, a
 * client paying 1.5L for software is buying something whose copyright sits with
 * a 19-year-old who signed nothing, and Almmatix cannot give the IP warranty
 * and indemnity any serious client asks for at contract stage. That is the
 * clause that voids a deal after the invoice is paid.
 *
 * THIS IS NOT LEGAL ADVICE AND IT IS NOT FINISHED. The text below is drafted to
 * be read and understood by a 19-year-old, which is a real requirement — an
 * unread clause is a weak clause. It still needs a lawyer's pass before anyone
 * signs, particularly IP_ASSIGNMENT and NON_CIRCUMVENTION, which are the two
 * that have to survive being tested.
 */

/**
 * Bump on any material change. Acceptances store this, and a member whose
 * accepted version is older than the current one is asked again.
 *
 * Format is date plus a revision, so the order is obvious at a glance and two
 * changes on the same day do not collide.
 */
export const TERMS_VERSION = "2026-10-12.1";

export type ClauseAudience = "ALL" | "TECH" | "OUTREACH";

export type Clause = {
  key: string;
  title: string;
  /** Plain-English body. Written to be read, not to be skipped. */
  body: string;
  applies: ClauseAudience;
  /**
   * True when breaking it ends the arrangement rather than starting a
   * conversation. Rendered differently, because a list where everything is
   * equally important is a list where nothing is.
   */
  strict: boolean;
};

export const CLAUSES: Clause[] = [
  {
    key: "IP_ASSIGNMENT",
    title: "The work you are paid for belongs to the client",
    body:
      "When you are paid for a brief, the code, designs and words you produced for it transfer to Almmatix and then to its client. You keep the right to say you built it and to show it in your portfolio, unless the brief is marked confidential. You do not keep the right to resell it or reuse it for someone else.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "POINT_OF_CONTACT",
    title: "The project manager is the only person who talks to the client",
    body:
      "You will not have the client's contact details and you should not seek them out. Every question, blocker and change request goes to your project manager, who answers to the client. This protects you as much as us: you are never on the hook for a promise you did not know had been made.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "CONFIDENTIALITY",
    title: "What you learn here stays here",
    body:
      "Client names, briefs, documents, credentials and prices are confidential. Do not post them, screenshot them into a group chat, or feed them into a tool that keeps a copy. This holds after you stop working with us.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "NON_CIRCUMVENTION",
    title: "No going direct to a client we introduced you to",
    body:
      "For twelve months after your last brief, you will not take paid work directly from a client you met through us, or help someone else do so. If a client approaches you, tell your project manager — that is not a problem, and hiding it is.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "NO_SUBCONTRACTING",
    title: "The work is yours, done by you",
    body:
      "Do not pass a brief to a friend, share your account, or submit work you did not do. Your identity is verified and the money is paid against it. You can use AI tools to help you write code, and you are still the person answerable for what you submit.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "DEADLINE",
    title: "The deadline is part of the deliverable",
    body:
      "If you are going to miss a date, say so at least 24 hours before it. That is almost always fine and we will replan. Going quiet past a deadline is not, and it ends your place on the next project — this is the single thing we screen for.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "ON_PLATFORM",
    title: "All money and all messages go through DoItForMe",
    body:
      "Do not accept payment outside the platform, and do not swap phone numbers or UPI IDs to arrange one. Escrow is what guarantees you get paid for work you have done. Off the platform, you have no protection and neither do we.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "ORIGINALITY",
    title: "The work has to be yours to give",
    body:
      "Do not copy code or designs you are not licensed to use, and do not paste in anything under a licence that would force the client to open-source their product. If you use an open-source library, say which one. We have to warrant this to the client, which means we need it to be true.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "FIX_WINDOW",
    title: "You fix your own bugs for 14 days",
    body:
      "For fourteen days after the client accepts the work, you fix anything that turns out to be broken in what you built, at no extra charge. New requests are not bugs — those are quoted and paid separately.",
    applies: "ALL",
    strict: true,
  },
  {
    key: "PAY_NET",
    title: "What you are paid, exactly",
    body:
      "Every brief shows two numbers: the fee, and what reaches your bank after the platform's 10% fee. The second number is the one that matters and it is the one we will always quote you. Money is held in escrow before you start, and released when your project manager signs off that the work is integrated and working, not merely submitted.",
    applies: "ALL",
    strict: false,
  },
  {
    key: "CHANGES_BILLED",
    title: "Changes are quoted, never absorbed",
    body:
      "If the client wants something outside the agreed brief, your project manager quotes it to them and you are paid for the extra work. You are never expected to absorb new scope for the original fee. If you are asked to, escalate it.",
    applies: "ALL",
    strict: false,
  },
  {
    key: "HANDOVER",
    title: "If you have to stop, hand over properly",
    body:
      "Life happens and you may need to leave a brief. Tell your project manager, then within 48 hours hand over your code, credentials and a short note on where you got to. You are paid pro-rata for what you completed, on handover. Walking away without one is the one thing that makes us unable to work with you again.",
    applies: "ALL",
    strict: false,
  },
  {
    key: "LADDER",
    title: "Your rate goes up as you deliver",
    body:
      "The first brief is at base rate and your project manager carries you through it. After two completed briefs your rate rises by half; after four you can lead and carry a junior; after seven you can run a project yourself. This is published so you can hold us to it.",
    applies: "TECH",
    strict: false,
  },
  {
    key: "ACTIVITY",
    title: "The weekly number, and when we would stop",
    body:
      "Outreach is measured on contacts logged and conversations opened, every week, in the platform. The target is set with you before you start. Three consecutive weeks below it and we end the arrangement — stated now so it is never a surprise later.",
    applies: "OUTREACH",
    strict: false,
  },
  {
    key: "COMMISSION",
    title: "How your commission works",
    body:
      "You earn 10% of the value of any project a client you found goes on to buy, less the platform's 10% fee. On a 1,50,000 project that is 15,000, of which 13,500 reaches your bank. It is paid in two parts: 40% once the client's first payment clears, and 60% once they accept the finished work. If we are at capacity the deal waits for the next slot, and the commission stays locked to you.",
    applies: "OUTREACH",
    strict: false,
  },
  {
    key: "LEAD_DATA",
    title: "The lead list stays in the platform",
    body:
      "Companies and contacts you add belong to the pipeline, not to a private spreadsheet. Do not export the list or take a copy with you. These are other people's names and numbers, and we are responsible for them.",
    applies: "OUTREACH",
    strict: true,
  },
];

export function clausesFor(audience: Exclude<ClauseAudience, "ALL">): Clause[] {
  return CLAUSES.filter((c) => c.applies === "ALL" || c.applies === audience);
}

export function strictClausesFor(audience: Exclude<ClauseAudience, "ALL">): Clause[] {
  return clausesFor(audience).filter((c) => c.strict);
}

/** Has this person accepted a version current enough to be given work? */
export function acceptanceIsCurrent(accepted: { version?: string | null } | null | undefined): boolean {
  return Boolean(accepted?.version) && accepted?.version === TERMS_VERSION;
}

/**
 * The summary shown above the clause list.
 *
 * Deliberately leads with what the member gets. A terms page that opens with
 * nine obligations reads as a trap, and the three things below are the actual
 * deal: the money is secured before you start, the fee you are told is the fee
 * you receive, and somebody else handles the client.
 */
export const TERMS_PROMISES = [
  "The money is in escrow before you write a line. You are never working on a promise.",
  "Every fee is quoted as what reaches your bank, after the platform fee, not before it.",
  "A project manager holds the client. You are never negotiating scope or chasing payment.",
] as const;
