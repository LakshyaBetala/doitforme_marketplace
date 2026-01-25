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

    // 2. Idempotency: Check if already processed to prevent duplicates
    const { data: existingTxn } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("gateway_order_id", orderId)
      .single();

    if (existingTxn) {
      return NextResponse.json({ success: true, message: "Transaction already processed" });
    }

    // 3. Fetch Gig Details (Price & Poster ID)
    const { data: gig } = await supabaseAdmin
      .from("gigs")
      .select("poster_id, price") 
      .eq("id", gigId)
      .single();

    if (!gig) throw new Error("Gig not found");

    // 4. Calculate Fees
    // Logic: User pays Price + Gateway Fee. 
    // Platform takes 10% of Price. Worker gets 90% of Price.
    const basePrice = Number(gig.price); 
    const platformFee = basePrice * 0.10; 
    const amountHeld = basePrice * 0.90; // Net worker pay
    const gatewayFee = paidAmount - basePrice; // Extra amount paid by user

    // 5. Create Transaction Record (Log the money coming in)
    const { error: txnError } = await supabaseAdmin.from("transactions").insert({
      gig_id: gigId,
      user_id: gig.poster_id,
      amount: paidAmount, // Full amount from user
      type: "ESCROW_DEPOSIT",
      status: "COMPLETED",
      gateway: "CASHFREE",
      gateway_order_id: orderId,
      gateway_payment_id: validPayment.cf_payment_id,
      provider_data: validPayment 
    });

    if (txnError) {
        console.error("Transaction Create Error", txnError);
        throw txnError;
    }

    // 6. Create Escrow Record (The "Liability" Ledger)
    const { error: escrowError } = await supabaseAdmin.from("escrow").upsert({
        gig_id: gigId,
        poster_id: gig.poster_id,
        worker_id: workerId,
        original_amount: basePrice, 
        platform_fee: platformFee, 
        gateway_fee: gatewayFee, 
        amount_held: amountHeld, 
        status: "HELD",
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
      net_worker_pay: amountHeld,
      gateway_fee: gatewayFee
    }).eq("id", gigId);

    if (gigUpdateError) {
        console.error("Gig Update Error", gigUpdateError);
        throw gigUpdateError;
    }

    // 8. UPDATE APPLICATIONS (CRITICAL FIX FOR "PENDING" STATUS)
    // Accept the selected worker
    await supabaseAdmin
        .from("applications")
        .update({ status: "accepted" })
        .eq("gig_id", gigId)
        .eq("worker_id", workerId);

    // Reject everyone else
    await supabaseAdmin
        .from("applications")
        .update({ status: "rejected" })
        .eq("gig_id", gigId)
        .neq("worker_id", workerId);

    return NextResponse.json({ success: true, message: "Escrow funded and worker assigned successfully" });

  } catch (error: any) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}