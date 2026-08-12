// Which Cashfree environment to talk to.
//
// This used to be derived from NODE_ENV alone, which is always "production" on
// Vercel — so a deployed site ALWAYS hit api.cashfree.com. If the Cashfree
// account only has test access enabled (a fresh account, or one reactivated
// after dormancy), every payment fails with "Transactions are not enabled for
// your payment gateway account" and there is no way to run a real end-to-end
// test on the deployed site.
//
// CASHFREE_MODE makes it explicit and independent of where the code runs:
//   CASHFREE_MODE=sandbox     -> sandbox.cashfree.com (test keys)
//   CASHFREE_MODE=production  -> api.cashfree.com     (live keys)
//
// Unset falls back to the old NODE_ENV behaviour, so nothing changes for an
// account that is already live.
//
// The keys must match the mode: test keys against api.cashfree.com fail
// authentication, and live keys against sandbox do the same.

export type CashfreeMode = "sandbox" | "production";

export function cashfreeMode(): CashfreeMode {
  const explicit = process.env.CASHFREE_MODE?.trim().toLowerCase();
  if (explicit === "sandbox") return "sandbox";
  if (explicit === "production") return "production";
  return process.env.NODE_ENV === "production" ? "production" : "sandbox";
}

/** Hostname segment used in Cashfree PG URLs: `api` or `sandbox`. */
export function cashfreeHost(): "api" | "sandbox" {
  return cashfreeMode() === "production" ? "api" : "sandbox";
}
