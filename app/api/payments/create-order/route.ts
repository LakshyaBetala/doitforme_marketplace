import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { gigId } = await req.json();

    const supabase = await supabaseServer();
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: { user } } = await supabase.auth.getUser(); // The Payer
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Fetch Gig Details
    const { data: gig, error: gigError } = await supabase
      .from("gigs")
      .select("price, title, poster_id, listing_type, market_type, security_deposit, assigned_worker_id")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // 3. Determine Recipient (Who gets the money/whose stats determine fee?)
    // Market: Poster (Seller)
    // Hustle: Assigned Worker (Worker)
    let recipientId = gig.poster_id;
    if (gig.listing_type === 'HUSTLE') {
      if (!gig.assigned_worker_id) return NextResponse.json({ error: "No worker assigned to pay" }, { status: 400 });
      recipientId = gig.assigned_worker_id;
    }

    // 4. Fetch Recipient Stats (for Tiered Fee) & Payer Details (for Gateway)
    // We need Payer's phone/email for Cashfree
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

    if (gig.listing_type === 'MARKET') {
      // I am the Buyer (User). I have an application.
      const { data: myApp } = await supabase
        .from('applications')
        .select('negotiated_price')
        .eq('gig_id', gigId)
        .eq('worker_id', user.id)
        .maybeSingle();

      if (myApp?.negotiated_price) {
        finalPrice = Number(myApp.negotiated_price);
      }
    } else if (gig.listing_type === 'HUSTLE') {
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
    }

    // 5. Calculate Fees
    const price = finalPrice;
    const jobsCompleted = recipientProfile?.jobs_completed || 0;

    // Security Deposit (Only for Market Rent)
    let deposit = 0;
    if (gig.listing_type === 'MARKET' && gig.market_type === 'RENT') {
      deposit = Number(gig.security_deposit) || 0;
    }

    // Platform Fee Logic
    let platformFee = 0; // The deduction taken from the Seller/Worker
    let renterFee = 0;   // The upfront fee added to the Subtotal for the Renter
    let netWorkerPay = 0;
    let discountApplied = false;

    if (gig.listing_type === 'MARKET' && gig.market_type === 'RENT') {
      // Rental Fee: 1% added to the Upfront Renter Price, 2% deducted from the Owner Output
      renterFee = Math.ceil((price + deposit) * 0.01);
      platformFee = Math.ceil(price * 0.02);
      netWorkerPay = price - platformFee;
    } else {
      // Hustle/Sell Tiered: 7.5% if jobs > 10, else 10%
      // This is purely a deduction from Net Pay. The buyer DOES NOT pay this fee upfront.
      renterFee = 0;
      if (jobsCompleted > 10) {
        platformFee = Math.ceil(price * 0.075);
        discountApplied = true;
      } else {
        platformFee = Math.ceil(price * 0.10);
      }
      netWorkerPay = price - platformFee;
    }

    // Subtotal (Base charge before Gateway)
    // Logic: User Pays: Price + Deposit + Renter Fee (if applicable)
    const subtotal = price + deposit + renterFee;

    // Gateway Fee (2% applied on everything)
    const gatewayFee = Math.ceil(subtotal * 0.02);

    const totalAmount = subtotal + gatewayFee;

    const orderId = `order_${gigId}_${Date.now()}`;

    // [New] Create Transaction Record (PENDING) with Fee Breakdown
    const breakdown = {
      subtotal: subtotal,
      renter_fee: renterFee,
      gateway_fee: gatewayFee,
      discount_applied: discountApplied,
      total: totalAmount,
      platform_fee: platformFee, // Stores the Deduction Amount
      base_price: price,
      deposit: deposit,
      net_worker_pay: netWorkerPay
    };

    const { error: txnError } = await supabaseAdmin.from('transactions').insert({
      gig_id: gigId,
      user_id: user.id, // Payer
      amount: totalAmount,
      type: 'ESCROW_DEPOSIT',
      status: 'PENDING',
      gateway: 'CASHFREE',
      gateway_order_id: orderId,
      provider_data: { breakdown }
    });

    if (txnError) throw txnError;

    // 6. Create Cashfree Order using native fetch
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL}/gig/${gigId}?payment=verify&order_id={order_id}&worker_id=${encodeURIComponent(user.id)}`;

    const payload = {
      order_amount: totalAmount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: user.id,
        customer_name: payerProfile.name || "User",
        customer_email: payerProfile.email || "no-email@example.com",
        customer_phone: String(payerProfile.phone || "9999999999"),
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/cashfree`,
      },
      order_tags: {
        gig_id: gigId,
        worker_id: user.id,
        type: "ESCROW_DEPOSIT"
      },
      order_note: `Gig Payment: ${gig.title}`
    };

    const CASHFREE_ENV = process.env.NODE_ENV === 'production' ? 'api' : 'sandbox';
    const cashfreeUrl = `https://${CASHFREE_ENV}.cashfree.com/pg/orders`;

    console.log("Initiating Payment via native fetch:", orderId, "| Amount:", totalAmount);

    const response = await fetch(cashfreeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": "2023-08-01",
        "x-client-id": process.env.CASHFREE_APP_ID!,
        "x-client-secret": process.env.CASHFREE_SECRET_KEY!
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cashfree API Error:", data);
      throw new Error(data.message || "Payment initiation failed at gateway");
    }

    const paymentSessionId = data.payment_session_id;

    await supabase.from('gigs').update({
      gateway_order_id: orderId,
      payment_gateway: 'CASHFREE',
      escrow_amount: totalAmount,
    }).eq('id', gigId);

    // Duplicate Transaction Insert Removed.
    // The "PENDING" transaction created earlier is the Single Source of Truth V3.

    return NextResponse.json({
      success: true,
      payment_session_id: paymentSessionId,
      order_id: orderId,
      breakdown
    });

  } catch (error: any) {
    console.error("Order Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}