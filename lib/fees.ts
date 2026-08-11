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

/** Cashfree gateway pass-through, charged on top of the subtotal to the payer. */
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
