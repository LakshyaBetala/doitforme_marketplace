// Who pays, who is paid, and which listings can hold money at all.
//
// DoItForMe is a freelance platform, not a marketplace. That single sentence
// settles the question this file exists to answer, and it is the opposite of
// what the code had drifted into believing.
//
// THE ONE MONEY DIRECTION
//
// On a freelance platform there is exactly one shape of transaction:
//
//     the POSTER is the client and pays.
//     the assigned WORKER does the work and is paid.
//
// Every lifecycle step is built on that and only that — /api/gig/deliver checks
// the worker, manual_release_escrow authorizes the poster, dispute and
// request-changes are poster actions. Those are correct and must stay.
//
// WHERE IT WENT WRONG
//
// SERVICE listings ("I am offering a service") were modelled as a second,
// mirrored money direction where the poster collects instead of pays. That
// inverted every one of the guards above, so a service listing could not
// complete even in principle: the customer was not allowed to fund it, the
// customer would have had to deliver the work, and the provider would have
// approved their own delivery.
//
// It never actually paid anyone the wrong amount, because it never got that
// far — 407 of 444 listings are SERVICE, they took 787 applications, and not
// one was ever funded, assigned, completed or paid.
//
// THE FIX IS TO STOP MIRRORING
//
// A SERVICE listing is a shopfront advert. app/post/page.tsx already calls it
// exactly that, and /talent browses them while /feed carries the task board, so
// the separation was already in the product — only the money model disagreed.
// An advert never holds escrow. Hiring from one creates a NORMAL engagement via
// /api/gig/request-service, where the customer is the poster and the provider
// is the assigned worker. The whole lifecycle then applies unchanged.
//
// So there is no second direction to support, and no seller/buyer concept to
// introduce. There is one direction, plus a kind of listing that is not a
// transaction.

export type GigLike = {
  listing_type?: string | null;
  poster_id?: string | null;
  assigned_worker_id?: string | null;
};

const typeOf = (gig: GigLike) => String(gig.listing_type || "").toUpperCase();

/**
 * A shopfront advert — someone publishing what they can do, not a job.
 *
 * Adverts are browsable and messageable but cannot be applied to, assigned,
 * funded or settled. canFundEscrow is the guard that enforces it.
 */
export function isServiceAdvert(gig: GigLike): boolean {
  return typeOf(gig) === "SERVICE";
}

/**
 * Listings that can hold escrow. Everything except an advert.
 *
 * Payment routes check this so a service listing is refused at the door with an
 * explanation, rather than funding a gig whose delivery step nobody can perform.
 */
export function canFundEscrow(gig: GigLike): boolean {
  return !isServiceAdvert(gig);
}

/**
 * True only for MARKET — a sold or rented item, where the poster is the seller
 * and therefore the one being paid.
 *
 * MARKET belongs to the sister marketplace on marketforme.in and has ZERO rows
 * in this database. It is preserved because the fee and release code already
 * handles it and removing it is a separate migration, not because this product
 * has a second money direction. For every listing this platform actually runs,
 * the answer here is false.
 */
export function posterIsRecipient(gig: GigLike): boolean {
  return typeOf(gig) === "MARKET";
}

/**
 * The user id that receives the payout: the assigned worker.
 *
 * Returns null when nobody is assigned, which callers must treat as "cannot
 * settle yet" rather than falling back to a default — refusing to pay is always
 * recoverable, paying the wrong person is not.
 */
export function payoutRecipientId(gig: GigLike): string | null {
  return (posterIsRecipient(gig) ? gig.poster_id : gig.assigned_worker_id) ?? null;
}

/** The user id expected to fund escrow — the mirror of payoutRecipientId. */
export function payerId(gig: GigLike): string | null {
  return (posterIsRecipient(gig) ? gig.assigned_worker_id : gig.poster_id) ?? null;
}

/**
 * What the person reading this listing is about to do.
 *
 * An advert is not a task, and telling a prospective customer to "apply" for
 * one described the opposite transaction — which is what 787 people followed.
 */
export function browserActionLabel(gig: GigLike): string {
  return isServiceAdvert(gig) ? "Request this service" : "Apply for task";
}

/** Badge text. Never render listing_type raw — "SERVICE" in caps is a column value, not a label. */
export function listingTypeLabel(gig: GigLike): string {
  switch (typeOf(gig)) {
    case "COMPANY_TASK": return "Company task";
    case "HUSTLE": return "Task";
    case "SERVICE": return "Service";
    case "MARKET": return "Listing";
    default: return "Listing";
  }
}

/**
 * What to call the people who responded to a listing.
 *
 * Nobody "applies" to an advert — they enquire. Calling a prospective customer
 * an applicant is what put a "Hire & pay" button in front of the provider,
 * pointed at the person who was supposed to be paying them.
 */
export function responderNoun(gig: GigLike, count: number): string {
  if (isServiceAdvert(gig)) return count === 1 ? "enquiry" : "enquiries";
  return count === 1 ? "applicant" : "applicants";
}

/** Every listing type this platform recognises. */
export const KNOWN_LISTING_TYPES = ["HUSTLE", "COMPANY_TASK", "SERVICE", "MARKET"];
