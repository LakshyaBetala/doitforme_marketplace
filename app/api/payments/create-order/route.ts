import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { buildPaymentBreakdown, audienceForGig } from "@/lib/fees";
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";


export async function POST(req: Request) {
  try {
    const { gigId } = await req.json();

    const supabase = await supabaseServer();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(); // The Payer
    if (!user) return NextResponse.json({ error: "Please log in to proceed with payment." }, { status: 401 });

    // 2. Fetch Gig Details
    const { data: gig, error: gigError } = await supabase
      .from("gigs")
      .select("price, title, poster_id, listing_type, market_type, security_deposit, assigned_worker_id, is_managed, company_id")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // 3. Determine Recipient (Who gets the money/whose stats determine fee?)
    // Market: Poster (Seller)
    // Hustle: Assigned Worker (Worker)
    let recipientId = gig.poster_id;
    if (!gig.assigned_worker_id) return NextResponse.json({ error: "No worker assigned to pay" }, { status: 400 });
    recipientId = gig.assigned_worker_id;

    // 4. Fetch Recipient Stats (for Tiered Fee) & Payer Details (for Gateway)
    // We need the payer's name/email/phone to prefill checkout
    const { data: payerProfile } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('id', user.id) // Payer is current user
      .single();

    if (!payerProfile) return NextResponse.json({ error: "Complete your profile to pay" }, { status: 400 });

    const { data: recipientProfile } = await supabase
      .from('users')
      .select('jobs_completed')
      .eq('id', recipientId)
      .single();

    // 4.5 Check for Negotiated Price (V4 Handshake)
    // If the payer is the Poster (Marketplace Buy/Rent or Hustle Payout), 
    // we need to check if there's an accepted application with a negotiated price.
    // Logic: 
    // - Market Buy: Payer = User (Worker/Buyer), Recipient = Poster. Application is by User.
    // - Hustle Pay: Payer = Poster, Recipient = User (Worker). Application is by Recipient.

    let finalPrice = Number(gig.price);

    // I am the Poster. Paying the Worker (Recipient).
    const { data: workerApp } = await supabase
      .from('applications')
      .select('negotiated_price')
      .eq('gig_id', gigId)
      .eq('worker_id', recipientId)
      .maybeSingle();

    if (workerApp?.negotiated_price) {
      finalPrice = Number(workerApp.negotiated_price);
    }

    // 5. Calculate Fees
    const price = finalPrice;
    const jobsCompleted = recipientProfile?.jobs_completed || 0;

    // Rentals hold a refundable deposit on top of the price; hustles never do.
    const deposit = gig.market_type === "RENT" ? Number(gig.security_deposit || 0) : 0;

    // Take rate by audience (see lib/fees.ts): student economy 5%, business 10%.
    // Managed is a business delivery mode — still 10%, not a separate rate.
    //
    // All arithmetic goes through buildPaymentBreakdown so the gateway order,
    // the transaction record, the escrow row and manual_release_escrow cannot
    // drift apart. Verified by tests/unit/payout.test.mjs.
    const feeAudience = audienceForGig(gig);
    const b = buildPaymentBreakdown({ price, deposit, audience: feeAudience });

    const platformFee = b.platformFee;
    const netWorkerPay = b.netWorkerPay;
    const renterFee = 0;
    const discountApplied = false;
    const subtotal = b.subtotal;
    const gatewayFee = b.gatewayFee;
    const totalAmount = b.total;

    // Our internal receipt. Razorpay caps `receipt` at 40 characters.
    const orderId = `ord_${Date.now()}_${gigId.split('-')[0]}`;

    // [New] Create Transaction Record (PENDING) with Fee Breakdown
    const breakdown = {
      subtotal: subtotal,
      renter_fee: renterFee,
      gateway_fee: gatewayFee,
      discount_applied: discountApplied,
      total: totalAmount,
      platform_fee: platformFee, // Stores the Deduction Amount
      fee_audience: feeAudience,
      // Server-recorded recipient. Settlement reads the worker from HERE rather
      // than from the request body or a client-controlled redirect param, so a
      // caller cannot redirect someone else's payment to themselves.
      recipient_id: recipientId,
      base_price: price,
      deposit: deposit,
      net_worker_pay: netWorkerPay
    };

    // Razorpay is the only gateway. Cashfree never completed marketplace
    // onboarding, so that code path is gone rather than left as dead weight.
    if (!razorpayConfigured()) {
      console.error("[create-order] Razorpay credentials missing");
      return NextResponse.json({ error: "Payments are temporarily unavailable." }, { status: 503 });
    }

    // Create the gateway order FIRST so a gateway failure cannot leave an
    // orphan PENDING transaction behind.
    const rzpOrder = await createRazorpayOrder({
      amountRupees: totalAmount,
      receipt: orderId,
      notes: { gig_id: gigId, worker_id: recipientId, type: "ESCROW_DEPOSIT" },
    });

    const { error: rzpTxnError } = await supabaseAdmin.from('transactions').insert({
      gig_id: gigId,
      user_id: user.id, // Payer
      amount: totalAmount,
      type: 'ESCROW_DEPOSIT',
      status: 'PENDING',
      gateway: 'RAZORPAY',
      // The Razorpay order id is the lookup key on the way back — the webhook
      // and the browser callback both find this row by it.
      gateway_order_id: rzpOrder.id,
      provider_data: { breakdown, receipt: orderId }
    });
    if (rzpTxnError) throw rzpTxnError;

    await supabase.from('gigs').update({
      gateway_order_id: rzpOrder.id,
      payment_gateway: 'RAZORPAY',
      escrow_amount: totalAmount,
    }).eq('id', gigId);

    return NextResponse.json({
      success: true,
      provider: "RAZORPAY",
      order_id: rzpOrder.id,
      amount: rzpOrder.amount,          // paise, straight from the gateway
      currency: rzpOrder.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      gig_title: gig.title,
      prefill: {
        name: payerProfile.name || "",
        email: payerProfile.email || "",
        contact: String(payerProfile.phone || "").replace(/\D/g, "").slice(-10),
      },
      breakdown
    });
  } catch (error: any) {
    console.error("Order Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}