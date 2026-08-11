// Cashfree Payouts API — automated UPI transfers out of payout_queue.
//
// IMPORTANT ELIGIBILITY NOTE: Cashfree does NOT offer the Payouts product to
// unregistered or proprietorship businesses (stated during their onboarding
// flow). Until doitforme is a registered entity with a Business PAN and the
// Payouts product is approved, these credentials will not exist and every
// helper here no-ops. That is deliberate — the payout cron degrades to "leave
// it PENDING for manual processing" rather than failing or, worse, pretending
// money moved.
//
// Env (all required for automation to switch on):
//   CASHFREE_PAYOUT_CLIENT_ID
//   CASHFREE_PAYOUT_CLIENT_SECRET
//   CASHFREE_PAYOUT_ENV = "production" | "sandbox"

const BASE = (env?: string) =>
  env === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";

export function payoutsConfigured(): boolean {
  return Boolean(
    process.env.CASHFREE_PAYOUT_CLIENT_ID && process.env.CASHFREE_PAYOUT_CLIENT_SECRET
  );
}

interface TokenCache {
  token: string;
  expiresAt: number;
}
let cached: TokenCache | null = null;

/** Cashfree payout tokens last ~10 minutes; cache with a safety margin. */
async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const res = await fetch(`${BASE(process.env.CASHFREE_PAYOUT_ENV)}/payout/v1/authorize`, {
    method: "POST",
    headers: {
      "X-Client-Id": process.env.CASHFREE_PAYOUT_CLIENT_ID!,
      "X-Client-Secret": process.env.CASHFREE_PAYOUT_CLIENT_SECRET!,
    },
  });

  const body = await res.json().catch(() => ({}));
  const token = body?.data?.token;
  if (!res.ok || !token) {
    throw new Error(`Cashfree payout auth failed: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  }

  cached = { token, expiresAt: Date.now() + 9 * 60 * 1000 };
  return token;
}

export interface TransferResult {
  ok: boolean;
  /** Terminal failure — do not retry (bad UPI, rejected). Distinct from transient. */
  permanent: boolean;
  referenceId?: string;
  message: string;
}

/**
 * Send one UPI transfer.
 *
 * `transferId` MUST be stable and unique per payout row — Cashfree treats a
 * repeated transferId as the same transfer and will not double-pay. That is the
 * idempotency key that makes a retrying cron safe.
 */
export async function sendUpiPayout(args: {
  transferId: string;
  amount: number;
  upiId: string;
  name: string;
  remarks?: string;
}): Promise<TransferResult> {
  if (!payoutsConfigured()) {
    return { ok: false, permanent: false, message: "Payouts not configured" };
  }

  let token: string;
  try {
    token = await getToken();
  } catch (e) {
    return { ok: false, permanent: false, message: e instanceof Error ? e.message : "auth failed" };
  }

  const res = await fetch(`${BASE(process.env.CASHFREE_PAYOUT_ENV)}/payout/v1/directTransfer`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      beneDetails: {
        beneId: `difm_${args.transferId}`.slice(0, 50),
        name: (args.name || "doitforme user").slice(0, 50),
        email: "payouts@doitforme.in",
        phone: "9999999999",
        vpa: args.upiId,
        address1: "India",
      },
      amount: args.amount.toFixed(2),
      transferId: args.transferId,
      remarks: (args.remarks || "doitforme payout").slice(0, 70),
    }),
  });

  const body = await res.json().catch(() => ({}));
  const status = String(body?.status || "");
  const subCode = String(body?.subCode || res.status);

  if (status === "SUCCESS" || status === "PENDING") {
    return {
      ok: true,
      permanent: false,
      referenceId: String(body?.data?.referenceId ?? ""),
      message: status,
    };
  }

  // 4xx from Cashfree means the request itself is wrong (invalid VPA, duplicate,
  // insufficient balance is 5xx-ish) — retrying an invalid UPI forever just
  // burns the cron, so mark those terminal and surface them to an admin.
  const permanent = /invalid|not found|beneficiary|vpa/i.test(String(body?.message || "")) ||
    subCode.startsWith("4");

  return {
    ok: false,
    permanent,
    message: `${subCode}: ${String(body?.message || "transfer failed").slice(0, 200)}`,
  };
}
