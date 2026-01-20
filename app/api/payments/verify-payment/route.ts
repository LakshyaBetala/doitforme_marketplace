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

    // 1. Verify Status with Cashfree DIRECTLY
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
    const validPayment = Array.isArray(data) 
        ? data.find((p: any) => p.payment_status === "SUCCESS") 
        : null;

    if (!validPayment) {
      console.error("Cashfree Payment Verification Failed:", data);
      return NextResponse.json({ error: "Payment pending or failed" }, { status: 400 });
    }

    const paidAmount = validPayment.payment_amount; // e.g., 1020

    // 2. Idempotency: Check if already processed
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
      .select("poster_id, price") // Fetch price here!
      .eq("id", gigId)
      .single();

    if (!gig) throw new Error("Gig not found");

    // 4. Calculate Fees (FIXED LOGIC)
    // We use the DB Price (1000) for splits, NOT the Paid Amount (1020)
    const basePrice = Number(gig.price); 
    const platformFee = basePrice * 0.10; // 100
    const amountHeld = basePrice * 0.90;  // 900 (This is net worker pay)
    const gatewayFee = paidAmount - basePrice; // 20 (The surcharge)

    // 5. Create Transaction Record
    const { error: txnError } = await supabaseAdmin.from("transactions").insert({
      gig_id: gigId,
      user_id: gig.poster_id,
      amount: paidAmount, // Record full amount paid by user
      type: "ESCROW_DEPOSIT",
      status: "COMPLETED",
      gateway: "CASHFREE",
      gateway_order_id: orderId,
      gateway_payment_id: validPayment.cf_payment_id,
      provider_data: validPayment 
    });

    if (txnError) throw txnError;

    // 6. Create Escrow Record (The "Manual Payout" Ledger)
    const { error: escrowError } = await supabaseAdmin.from("escrow").upsert({
        gig_id: gigId,
        poster_id: gig.poster_id,
        worker_id: workerId,
        original_amount: basePrice, // Store 1000
        platform_fee: platformFee,  // Store 100
        gateway_fee: gatewayFee,    // Store 20
        amount_held: amountHeld,    // Store 900 (Liability)
        status: "HELD",
        release_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    }, { onConflict: 'gig_id' });

    if (escrowError) throw escrowError;

    // 7. Update Gig Status
    await supabaseAdmin.from("gigs").update({
      status: "assigned", 
      assigned_worker_id: workerId,
      payment_status: "ESCROW_FUNDED",
      escrow_status: "HELD",
      escrow_amount: amountHeld,
      escrow_locked_at: new Date().toISOString(),
      // Track splits for easy reference
      platform_fee: platformFee, 
      net_worker_pay: amountHeld,
      gateway_fee: gatewayFee
    }).eq("id", gigId);

    return NextResponse.json({ success: true, message: "Escrow funded and worker assigned successfully" });

  } catch (error: any) {
    console.error("Verification Error:", error);
    return NextResponse.json({ error: error.message || "Verification failed" }, { status: 500 });
  }
}