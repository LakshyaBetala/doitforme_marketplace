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
      return NextResponse.json({ error: "Missing verification data (order, gig, or worker)" }, { status: 400 });
    }

    // 1. Verify Status with Cashfree DIRECTLY (No SDK)
    // NOTE: using sandbox.cashfree.com. Change to api.cashfree.com for production.
    const response = await fetch(`https://sandbox.cashfree.com/pg/orders/${orderId}/payments`, {
        method: "GET",
        headers: {
            "x-client-id": process.env.CASHFREE_APP_ID!,
            "x-client-secret": process.env.CASHFREE_SECRET_KEY!,
            "x-api-version": "2023-08-01"
        }
    });

    const data = await response.json();
    
    // Check if any transaction in the list is successful
    // Cashfree returns an array of payment attempts for an order
    const validPayment = Array.isArray(data) 
        ? data.find((p: any) => p.payment_status === "SUCCESS") 
        : null;

    if (!validPayment) {
      console.error("Cashfree Payment Verification Failed:", data);
      return NextResponse.json({ error: "Payment pending or failed" }, { status: 400 });
    }

    const paidAmount = validPayment.payment_amount;

    // 2. Idempotency: Check if already processed to prevent double recording
    const { data: existingTxn } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("gateway_order_id", orderId)
      .single();

    if (existingTxn) {
      return NextResponse.json({ success: true, message: "Transaction already processed" });
    }

    // 3. Fetch Gig Details to get Poster ID
    const { data: gig } = await supabaseAdmin
      .from("gigs")
      .select("poster_id")
      .eq("id", gigId)
      .single();

    if (!gig) throw new Error("Gig not found");

    // 4. Calculate Fees (10% Platform Fee)
    const platformFee = paidAmount * 0.10;
    const amountHeld = paidAmount - platformFee;

    // 5. Create Transaction Record (Audit Log)
    const { error: txnError } = await supabaseAdmin.from("transactions").insert({
      gig_id: gigId,
      user_id: gig.poster_id,
      amount: paidAmount,
      type: "ESCROW_DEPOSIT",
      status: "COMPLETED",
      gateway: "CASHFREE",
      gateway_order_id: orderId,
      gateway_payment_id: validPayment.cf_payment_id,
      provider_data: validPayment // Store full JSON for debugging
    });

    if (txnError) throw txnError;

    // 6. Create Escrow Record (THE IMPORTANT PART)
    // We upsert here just in case, but usually this is a new insert
    const { error: escrowError } = await supabaseAdmin.from("escrow").upsert({
        gig_id: gigId,
        poster_id: gig.poster_id,
        worker_id: workerId, // Assign the worker now
        original_amount: paidAmount,
        platform_fee: platformFee, // 10%
        gateway_fee: 0, // Absorbed or calculated separately if needed
        amount_held: amountHeld, // 90%
        status: "HELD",
        release_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // Default 14 days
    }, { onConflict: 'gig_id' });

    if (escrowError) throw escrowError;

    // 7. Update Gig Status (Official Assignment)
    await supabaseAdmin.from("gigs").update({
      status: "assigned", // Gig is now active
      assigned_worker_id: workerId,
      payment_status: "ESCROW_FUNDED",
      escrow_status: "HELD",
      escrow_amount: amountHeld,
      escrow_locked_at: new Date().toISOString()
    }).eq("id", gigId);

    return NextResponse.json({ success: true, message: "Escrow funded and worker assigned successfully" });

  } catch (error: any) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}