// Shared payment settlement.
//
// Funding escrow must behave identically no matter which path observes the
// payment: the Cashfree webhook, the Razorpay webhook, or the browser callback.
// Keeping one implementation is what makes that true — the two webhooks used to
// be the only copy, and a second gateway would have meant a second copy.
//
// Every entry point is safe to call repeatedly: the transaction row is claimed
// with a conditional UPDATE, and only the caller that wins the claim funds
// escrow. Concurrent webhook retries and browser callbacks are expected.

import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface SettlementResult {
  ok: boolean;
  settled?: string;
  skipped?: string;
  pro_until?: string;
}

export async function settleGigEscrow(
  orderId: string,
  gigId: string,
  workerId: string,
  cfPaymentId?: string,
  paidAmount?: number
) {
  // Fetch the PENDING transaction created at order-creation time.
  const { data: txn } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("gateway_order_id", orderId)
    .single();

  if (!txn) {
    console.error(`[settlement] no txn for order ${orderId}`);
    return ({ ok: true, skipped: "no txn" });
  }
  if (txn.status === "COMPLETED") {
    return ({ ok: true, skipped: "already completed" });
  }

  // Underpayment guard. Fails closed: a missing or short amount is never settled.
  const expected = Number(txn.amount || 0);
  if (!Number.isFinite(paidAmount as number) || (paidAmount as number) <= 0 || expected - (paidAmount as number) > 1) {
    console.error(`[settlement] amount mismatch order=${orderId} paid=${paidAmount} expected=${expected}`);
    return ({ ok: true, skipped: "amount mismatch" });
  }

  const breakdown = txn.provider_data?.breakdown || {};
  const basePrice = Number(breakdown.base_price || 0);
  const deposit = Number(breakdown.deposit || 0);
  const platformFee = Number(breakdown.platform_fee || 0);
  const gatewayFee = Number(breakdown.gateway_fee || 0);
  const amountHeld = basePrice + deposit;

  // Claim atomically — Cashfree retries webhooks, and the browser redirect path
  // (/api/payments/verify-payment) can be settling the same order concurrently.
  // Only the caller whose UPDATE returns a row proceeds to fund escrow.
  const { data: claimed } = await supabaseAdmin
    .from("transactions")
    .update({ status: "COMPLETED", gateway_payment_id: cfPaymentId || null })
    .eq("id", txn.id)
    .neq("status", "COMPLETED")
    .select("id");

  if (!claimed || claimed.length === 0) {
    return ({ ok: true, skipped: "already settled by another path" });
  }

  const { data: gig } = await supabaseAdmin
    .from("gigs")
    .select("title, poster_id, status, max_workers")
    .eq("id", gigId)
    .single();
  if (!gig) return ({ ok: true, skipped: "no gig" });

  if (gig.status === "assigned") {
    return ({ ok: true, skipped: "gig already assigned" });
  }

  const handshakeCode = Math.floor(1000 + Math.random() * 9000).toString();

  await supabaseAdmin.from("escrow").upsert(
    {
      gig_id: gigId,
      poster_id: gig.poster_id,
      worker_id: workerId,
      original_amount: basePrice,
      platform_fee: platformFee,
      gateway_fee: gatewayFee,
      amount_held: amountHeld,
      status: "HELD",
      release_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      handshake_code: handshakeCode,
      escrow_category: deposit > 0 ? "RENTAL_DEPOSIT" : "GIG",
    },
    { onConflict: "gig_id,worker_id" }
  );

  await supabaseAdmin
    .from("applications")
    .update({ status: "accepted" })
    .eq("gig_id", gigId)
    .eq("worker_id", workerId);

  const { count: acceptedCountRaw } = await supabaseAdmin
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("gig_id", gigId)
    .eq("status", "accepted");
  const acceptedCount = acceptedCountRaw || 1;
  const isFull = acceptedCount >= (gig.max_workers || 1);

  const { data: allEscrows } = await supabaseAdmin
    .from("escrow")
    .select("amount_held, platform_fee, gateway_fee, original_amount")
    .eq("gig_id", gigId);

  let totalAmountHeld = 0,
    totalPlatformFee = 0,
    totalGatewayFee = 0,
    totalOriginalAmount = 0;
  for (const e of allEscrows || []) {
    totalAmountHeld += Number(e.amount_held || 0);
    totalPlatformFee += Number(e.platform_fee || 0);
    totalGatewayFee += Number(e.gateway_fee || 0);
    totalOriginalAmount += Number(e.original_amount || 0);
  }

  const gigUpdate: any = {
    assigned_worker_id: workerId,
    payment_status: "ESCROW_FUNDED",
    escrow_status: "HELD",
    escrow_amount: totalAmountHeld,
    escrow_locked_at: new Date().toISOString(),
    platform_fee: totalPlatformFee,
    net_worker_pay: totalOriginalAmount - totalPlatformFee,
    gateway_fee: totalGatewayFee,
  };
  if (isFull) {
    gigUpdate.status = "assigned";
    await supabaseAdmin
      .from("applications")
      .update({ status: "rejected" })
      .eq("gig_id", gigId)
      .eq("status", "applied");
  }
  await supabaseAdmin.from("gigs").update(gigUpdate).eq("id", gigId);

  return ({ ok: true, settled: orderId });
}

export async function settleCompanyPro(orderId: string, cfPaymentId: string | undefined, tags: any) {
  const userId: string | undefined = tags.user_id;
  if (!userId) return ({ ok: true, skipped: "no user_id" });

  const { data: txn } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("gateway_order_id", orderId)
    .single();
  if (!txn || txn.status === "COMPLETED") {
    return ({ ok: true, skipped: "already processed or missing" });
  }

  await supabaseAdmin
    .from("transactions")
    .update({ status: "COMPLETED", gateway_payment_id: cfPaymentId || null })
    .eq("id", txn.id);

  const proUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseAdmin
    .from("companies")
    .update({ pro_until: proUntil })
    .eq("user_id", userId);

  return ({ ok: true, pro_until: proUntil });
}
