// Who is selling, who is buying, and who gets paid.
//
// This exists because two code paths answered that question differently and only
// agreed by accident:
//
//   payments/create-order  set recipientId = poster_id, then immediately
//                          overwrote it with assigned_worker_id, with no
//                          listing_type check at all.
//   cron/auto-release      paid the poster when listing_type === 'MARKET' and
//                          the worker otherwise.
//
// There are zero MARKET rows in the database, so both happened to land on the
// worker and nobody noticed. The moment a listing type that pays the poster
// actually settles, they would disagree and money would move to the wrong
// person. Import from here instead of re-deciding at each call site — same
// reason lib/fees.ts exists.
//
// THE TWO DIRECTIONS
//
// A listing is one of two things, and the difference is who owes whom:
//
//   DEMAND  ("I need something done")  HUSTLE, COMPANY_TASK
//           The poster is paying. Students apply; the poster picks one, funds
//           escrow, and the assigned worker is paid on approval.
//
//   SUPPLY  ("I'm offering a service") SERVICE, MARKET
//           The poster is being paid. Someone browsing wants to hire them, so
//           the interested party is the client and the POSTER is the recipient.
//
// SUPPLY is 407 of 444 live listings and had never once settled — 787 people
// registered interest and not one transaction completed, because every screen
// told the buyer to "Apply for Task" and the payout would have gone to whoever
// clicked apply.

export type GigLike = {
  listing_type?: string | null;
  poster_id?: string | null;
  assigned_worker_id?: string | null;
};

/** Listing types where the POSTER is the one being paid. */
const POSTER_IS_PAID = new Set(["SERVICE", "MARKET"]);

/** Listing types where the poster is paying someone else. */
const POSTER_PAYS = new Set(["HUSTLE", "COMPANY_TASK"]);

/**
 * True when the poster is selling — advertising a service or an item — so the
 * money flows toward them rather than away.
 */
export function posterIsRecipient(gig: GigLike): boolean {
  return POSTER_IS_PAID.has(String(gig.listing_type || "").toUpperCase());
}

/** Human-facing direction, for copy and CTAs. */
export function gigDirection(gig: GigLike): "SUPPLY" | "DEMAND" {
  return posterIsRecipient(gig) ? "SUPPLY" : "DEMAND";
}

/**
 * The user id that receives the payout.
 *
 * SUPPLY  -> the poster (they did the work / sold the item)
 * DEMAND  -> the assigned worker
 *
 * Returns null when the counterparty is not yet decided, which callers must
 * treat as "cannot settle yet" rather than falling back to a default — paying
 * the wrong side is worse than refusing.
 */
export function payoutRecipientId(gig: GigLike): string | null {
  return (posterIsRecipient(gig) ? gig.poster_id : gig.assigned_worker_id) ?? null;
}

/**
 * The user id expected to FUND escrow — the mirror of payoutRecipientId.
 *
 * SUPPLY  -> the interested party held in assigned_worker_id (the client)
 * DEMAND  -> the poster
 */
export function payerId(gig: GigLike): string | null {
  return (posterIsRecipient(gig) ? gig.assigned_worker_id : gig.poster_id) ?? null;
}

/**
 * What the person browsing this listing is about to do, as a verb they will
 * recognise. A service listing is not a task, and telling someone to "apply"
 * for one is what made 787 applications go nowhere.
 */
export function browserActionLabel(gig: GigLike): string {
  return posterIsRecipient(gig) ? "Request this service" : "Apply for task";
}

/** Badge text. Never render listing_type raw — "SERVICE" in caps is a database value, not a label. */
export function listingTypeLabel(gig: GigLike): string {
  switch (String(gig.listing_type || "").toUpperCase()) {
    case "COMPANY_TASK": return "Company task";
    case "HUSTLE": return "Task";
    case "SERVICE": return "Service";
    case "MARKET": return "Listing";
    default: return "Listing";
  }
}

/** Sanity guard for tests and callers: every known type is classified exactly once. */
export const KNOWN_LISTING_TYPES = [...POSTER_IS_PAID, ...POSTER_PAYS];
