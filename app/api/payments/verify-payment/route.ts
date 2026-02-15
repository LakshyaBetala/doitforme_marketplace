import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin (Bypasses RLS to write to Escrow/Transactions)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { orderId, gigId, workerId } = await req.json();

    if (!orderId || !gigId || !workerId) {
      return NextResponse.json({ error: "Missing verification data" }, { status: 400 });
    }

    // 1. Verify Status with Cashfree DIRECTLY
    const CASHFREE_ENV = process.env.NODE_ENV === 'production' ? 'api' : 'sandbox';

    const response = await fetch(`https://${CASHFREE_ENV}.cashfree.com/pg/orders/${orderId}/payments`, {
      method: "GET",
      headers: {
        "x-client-id": process.env.CASHFREE_APP_ID!,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
        "x-api-version": "2023-08-01"
      }
    });

    const data = await response.json();

    // Check if any transaction in the list is successful
    const validPayment = Array.isArray(data)
      ? data.find((p: any) => p.payment_status === "SUCCESS")
      : null;

    if (!validPayment) {
      console.error("Cashfree Payment Verification Failed:", data);
      return NextResponse.json({ error: "Payment pending or failed" }, { status: 400 });
    }

    const paidAmount = validPayment.payment_amount;

    // 2. Idempotency & Fetch Breakdown (Created in create-order)
    const { data: txn } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("gateway_order_id", orderId)
      .single();

    if (txn) {
      if (txn.status === 'COMPLETED') {
        return NextResponse.json({ success: true, message: "Transaction already processed" });
      }
    } else {
      // If no transaction record exists, create-order failed or wasn't called.
      // We could recalculate here as fallback, but V3 requires using the stored breakdown.
      return NextResponse.json({ error: "Order record not found" }, { status: 404 });
    }

    // 3. Extract Breakdown from Pending Transaction
    const breakdown = txn.provider_data?.breakdown || {};
    const basePrice = breakdown.base_price || 0;
    const deposit = breakdown.deposit || 0;
    const platformFee = breakdown.platform_fee || 0;
    const netWorkerPay = breakdown.net_worker_pay || 0;

    // 4. Update Transaction to COMPLETED
    const { error: updateError } = await supabaseAdmin
      .from("transactions")
      .update({
        status: 'COMPLETED',
        gateway_payment_id: validPayment.cf_payment_id,
        // amount should match paidAmount
      })
      .eq('id', txn.id);

    if (updateError) {
      console.error("Transaction Update Error", updateError);
      throw updateError;
    }

    // 5. Create Escrow Record (The "Liability" Ledger)
    // Fetch Poster ID for Escrow
    const { data: gig } = await supabaseAdmin.from('gigs').select('poster_id').eq('id', gigId).single();
    if (!gig) throw new Error("Gig not found");

    const amountHeld = basePrice + deposit;
    const gatewayFee = breakdown.gateway_fee || 0;

    const { error: escrowError } = await supabaseAdmin.from("escrow").upsert({
      gig_id: gigId,
      poster_id: gig.poster_id,
      worker_id: workerId,
      original_amount: basePrice,
      platform_fee: platformFee,
      gateway_fee: gatewayFee,
      amount_held: amountHeld,
      net_amount: netWorkerPay,
      status: "HELD",
      release_condition: deposit > 0 ? "RENTAL_RETURN" : "GIG_COMPLETION",
      release_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    }, { onConflict: 'gig_id' });

    if (escrowError) {
      console.error("Escrow Create Error", escrowError);
      throw escrowError;
    }

    // 7. Update Gig Status
    const { error: gigUpdateError } = await supabaseAdmin.from("gigs").update({
      status: "assigned",
      assigned_worker_id: workerId,
      payment_status: "ESCROW_FUNDED",
      escrow_status: "HELD",
      escrow_amount: amountHeld,
      escrow_locked_at: new Date().toISOString(),
      platform_fee: platformFee,
      net_worker_pay: netWorkerPay,
      gateway_fee: gatewayFee
    }).eq("id", gigId);

    if (gigUpdateError) {
      console.error("Gig Update Error", gigUpdateError);
      throw gigUpdateError;
    }

    // 8. UPDATE APPLICATIONS (CRITICAL FIX FOR "PENDING" STATUS)
    console.log(`Updating applications for Gig ${gigId}, Worker ${workerId}`);

    // Accept the selected worker
    const { error: appUpdateError } = await supabaseAdmin
      .from("applications")
      .update({ status: "accepted" })
      .eq("gig_id", gigId)
      .eq("worker_id", workerId);

    if (appUpdateError) console.error("Error accepting application:", appUpdateError);

    // Reject everyone else
    const { error: rejectError } = await supabaseAdmin
      .from("applications")
      .update({ status: "rejected" })
      .eq("gig_id", gigId)
      .neq("worker_id", workerId);

    if (rejectError) console.error("Error rejecting other applications:", rejectError);

    return NextResponse.json({ success: true, message: "Escrow funded and worker assigned successfully" });

  } catch (error: any) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}