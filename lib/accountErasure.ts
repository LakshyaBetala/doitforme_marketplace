/**
 * What "delete my account" actually means here, in one place.
 *
 * There are two callers — the self-serve route at /api/account/delete and the
 * operator script scripts/delete-account.mjs — and the rules below are the kind
 * that must not differ between them. This codebase has twice paid for the
 * opposite: the admin whitelist lived in eight files, and the KYC prompt lived
 * in two, so broadening one silently left the other refusing people.
 *
 * WHY THIS IS NOT `DELETE FROM users`
 *
 * Every foreign key into public.users is either ON DELETE CASCADE or NO ACTION,
 * and both are wrong:
 *
 *   CASCADE   takes the OTHER party's history with it — messages they sent,
 *             ratings they wrote, gigs they posted. One person's erasure
 *             request is not consent to delete someone else's records.
 *   NO ACTION on disputes.raised_by, payout_queue.worker_id and
 *             notifications.user_id means a hard delete simply FAILS as soon as
 *             any of those rows exist.
 *
 * Transaction and escrow rows are retained regardless: they are financial
 * records and India's tax and payment-gateway rules require keeping them.
 *
 * So: anonymise the profile in place, destroy the identity documents, and
 * delete the auth identity — which is the part that actually constitutes "the
 * account". What remains is a row with no personal data in it that other
 * people's history can still point at.
 */

/**
 * Every column on public.users that identifies a person. Anything absent is a
 * counter, a timestamp, or a foreign key other rows depend on.
 *
 * kyc_status and kyc_verified are reset together and must stay that way — a
 * CHECK constraint enforces `kyc_verified = (kyc_status = 'approved')`
 * (20261011_kyc_verified_cannot_drift.sql), so blanking one without the other
 * fails the write outright.
 */
export const ERASE_COLUMNS: Record<string, unknown> = {
  email: null,
  name: "Deleted user",
  phone: null,
  college: null,
  avatar_url: null,
  username: null,
  display_name: null,
  bio: null,
  upi_id: null,
  id_card_url: null,
  resume_url: null,
  telegram_chat_id: null,
  experience: null,
  year_of_study: null,
  branch: null,
  skills: [],
  portfolio_links: [],
  preferences: [],
  referral_code: null,
  kyc_status: "none",
  kyc_verified: false,
  kyc_institution: null,
  kyc_rejection_reason: null,
  kyc_confidence: null,
  kyc_reviewed_at: null,
  signup_source: null,
  signup_source_detail: null,
  signup_referrer: null,
  signup_landing: null,
};

/** Private buckets holding identity documents, keyed by `<userId>/` prefix. */
export const DOC_BUCKETS = ["resumes", "kyc-ids", "verification-docs"] as const;

export type InFlight = {
  blocked: boolean;
  postedFunded: number;
  workingFunded: number;
  pendingPayouts: number;
  heldEscrow: number;
};

/**
 * Money in flight is a hard stop, for both callers.
 *
 * Erasing a party mid-transaction strands the other side with no counterparty
 * and no way to dispute: the poster has paid and cannot ask anyone for the
 * work, or the worker has delivered and cannot be paid. Apple's guideline
 * 5.1.1(v) requires that account deletion be reachable in the app; it does not
 * require handing someone else's money back, and a dispute needs two parties.
 *
 * Checks the escrow table directly as well as the gig columns. A gig can be
 * left at payment_status='assigned' while its escrow row still reads HELD —
 * that is exactly the shape of the ₹500 that has been stuck for 35 days — so
 * keying only off gigs would let that user erase themselves out of a live
 * escrow.
 */
/**
 * What counts as money in flight, as data rather than as a function taking a
 * client.
 *
 * The first version of this took the Supabase client so both callers could
 * share one query. It typechecked for the .mjs script and failed for the route
 * with TS2589, "type instantiation is excessively deep" — the generated
 * database types are too large to match against a hand-written structural
 * interface, and the honest alternatives were a cast or an `any`.
 *
 * The part that must never differ between an operator and a user is the RULE,
 * not the plumbing: which tables, which column holds the user, which value
 * means the money has not settled. That is what lives here. Each caller runs
 * five counts with the client it already has, which is about six lines and
 * needs no shared generic.
 */
export const IN_FLIGHT_CHECKS = [
  { key: "postedFunded", table: "gigs", userColumn: "poster_id", column: "payment_status", value: "ESCROW_FUNDED" },
  { key: "workingFunded", table: "gigs", userColumn: "assigned_worker_id", column: "payment_status", value: "ESCROW_FUNDED" },
  { key: "pendingPayouts", table: "payout_queue", userColumn: "worker_id", column: "status", value: "PENDING" },
  // Checked as well as the gig columns, not instead of them. A gig can sit at
  // status 'assigned' while its escrow row still reads HELD — the shape of the
  // ₹500 that has been stuck for 35 days — so keying off gigs alone would let
  // someone erase themselves out of a live escrow.
  { key: "heldEscrowPoster", table: "escrow", userColumn: "poster_id", column: "status", value: "HELD" },
  { key: "heldEscrowWorker", table: "escrow", userColumn: "worker_id", column: "status", value: "HELD" },
] as const;

export type InFlightCounts = Partial<Record<(typeof IN_FLIGHT_CHECKS)[number]["key"], number>>;

/** Fold the five counts into the answer both callers act on. */
export function summarizeInFlight(counts: InFlightCounts): InFlight {
  const postedFunded = counts.postedFunded ?? 0;
  const workingFunded = counts.workingFunded ?? 0;
  const pendingPayouts = counts.pendingPayouts ?? 0;
  const heldEscrow = (counts.heldEscrowPoster ?? 0) + (counts.heldEscrowWorker ?? 0);
  return {
    blocked: postedFunded + workingFunded + pendingPayouts + heldEscrow > 0,
    postedFunded,
    workingFunded,
    pendingPayouts,
    heldEscrow,
  };
}

/** A sentence a person can act on, not a dump of counters. */
export function inFlightMessage(f: InFlight): string {
  const parts: string[] = [];
  if (f.pendingPayouts > 0)
    parts.push(`${f.pendingPayouts} payout${f.pendingPayouts > 1 ? "s" : ""} still owed to you`);
  if (f.postedFunded > 0)
    parts.push(`${f.postedFunded} gig${f.postedFunded > 1 ? "s" : ""} you paid for that nobody has delivered yet`);
  if (f.workingFunded > 0)
    parts.push(`${f.workingFunded} gig${f.workingFunded > 1 ? "s" : ""} you are being paid for`);
  if (f.heldEscrow > 0 && f.postedFunded + f.workingFunded === 0)
    parts.push(`${f.heldEscrow} escrow payment${f.heldEscrow > 1 ? "s" : ""} still held`);
  return parts.length
    ? `There is money in flight: ${parts.join(", ")}. That has to be settled before the account can be erased, so nobody is left without a counterparty.`
    : "There is money in flight on this account. It has to be settled first.";
}
