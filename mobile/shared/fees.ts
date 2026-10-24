// Single source of truth for platform take rates.
//
// Final model (2026-06): two customer types, two flat rates.
//   STUDENT economy  — students helping students (PPTs, tutoring, design…) → 5%
//   BUSINESS work     — company/agency tasks (self-serve OR managed)        → 10%
// Managed is a *delivery mode* within Business, not a separate price — kept at
// the flat 10% on purpose so the pricing stays dead simple ("DoItForMe = 10%").
// The fee is paid by the worker (deducted from their payout).
//
// The rate is a business dial: change the numbers here, every handler follows.

export const PLATFORM_FEES = {
  STUDENT: 0.05,
  BUSINESS: 0.1,
} as const;

export type FeeAudience = keyof typeof PLATFORM_FEES;

/** Gateway pass-through, charged on top of the subtotal to the payer. */
export const GATEWAY_FEE_RATE = 0.02;

/**
 * Who a gig's fee applies to. Business = posted by a company (company_id set)
 * or an explicit company task; everything else is the student economy.
 * Managed (`is_managed`) does NOT change the rate — managed work is Business 10%.
 */
export function audienceForGig(gig: {
  company_id?: string | null;
  listing_type?: string | null;
}): FeeAudience {
  if (gig?.company_id || gig?.listing_type === "COMPANY_TASK") return "BUSINESS";
  return "STUDENT";
}

/** Platform take (deducted from the recipient's payout), rounded up to the rupee. */
export function platformFeeFor(price: number, audience: FeeAudience = "STUDENT"): number {
  return Math.ceil(price * PLATFORM_FEES[audience]);
}

/** Gateway fee added on top of the subtotal the payer is charged. */
export function gatewayFeeFor(subtotal: number): number {
  return Math.ceil(subtotal * GATEWAY_FEE_RATE);
}

export interface PaymentBreakdown {
  /** Task price agreed with the worker. */
  basePrice: number;
  /** Refundable rental deposit, 0 for normal gigs. */
  deposit: number;
  /** Platform commission, deducted from the worker's payout. */
  platformFee: number;
  /** Gateway pass-through, added on top and paid by the payer. */
  gatewayFee: number;
  /** basePrice + deposit, before the gateway fee. */
  subtotal: number;
  /** What the payer is actually charged. */
  total: number;
  /** What is held in escrow (price + deposit). */
  amountHeld: number;
  /** What the worker receives on release. Deposit is refunded, never paid out. */
  netWorkerPay: number;
  audience: FeeAudience;
}

/**
 * The single arithmetic for a gig payment. Every number the payer sees, the
 * escrow row stores, and the payout queue pays out comes from here.
 *
 * Kept as one pure function because these values have to agree across four
 * places (the gateway order, transactions.provider_data, the escrow row, and
 * manual_release_escrow). When they were computed inline they could drift, and
 * a drift here means either the worker is underpaid or we are.
 *
 * Invariants (enforced by tests/unit/payout.test.mjs):
 *   total       = basePrice + deposit + gatewayFee
 *   amountHeld  = basePrice + deposit
 *   netWorkerPay = basePrice - platformFee   (deposit excluded)
 *   0 <= netWorkerPay <= basePrice
 */
export function buildPaymentBreakdown(args: {
  price: number;
  deposit?: number;
  audience: FeeAudience;
}): PaymentBreakdown {
  const basePrice = Math.max(0, Math.round(args.price));
  const deposit = Math.max(0, Math.round(args.deposit ?? 0));
  const platformFee = platformFeeFor(basePrice, args.audience);
  const subtotal = basePrice + deposit;
  const gatewayFee = gatewayFeeFor(subtotal);

  return {
    basePrice,
    deposit,
    platformFee,
    gatewayFee,
    subtotal,
    total: subtotal + gatewayFee,
    amountHeld: subtotal,
    // The deposit belongs to the renter and is refunded on release — paying it
    // to the worker would hand over money that is not theirs.
    netWorkerPay: basePrice - platformFee,
    audience: args.audience,
  };
}
