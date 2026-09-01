import { NextResponse } from "next/server";
import { cashfreeHost } from "@/lib/cashfreeEnv";
import { supabaseServer } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { buildPaymentBreakdown, audienceForGig } from "@/lib/fees";
import { activeProvider } from "@/lib/paymentProvider";
import { createRazorpayOrder } from "@/lib/razorpay";

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
    // All arithmetic goes through buildPaymentBreakdown so the Cashfree order,
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

    // Shorten orderId to avoid 50 character limit in Cashfree
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

    const provider = activeProvider();

    // RAZORPAY branch. Everything above this line — price re-read from the DB,
    // recipient resolved server-side, fee breakdown — is shared and unchanged;
    // only the gateway call differs. The client never supplies an amount.
    if (provider === "RAZORPAY") {
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
        // The Razorpay order id is the lookup key on the way back, exactly as
        // the Cashfree order id is on that path.
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
    }

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
    // recipientId, NOT user.id. The payer is the poster; the worker is who gets
    // paid. Passing the payer here made the settlement path treat the poster as
    // their own worker and payout recipient.
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL}/gig/${gigId}?payment=verify&order_id={order_id}&worker_id=${encodeURIComponent(recipientId)}`;

    // Ensure phone is exactly 10 digits to prevent Cashfree validation errors
    const validPhone = String(payerProfile.phone || "").replace(/\D/g, '').slice(-10) || "9999999999";

    const payload = {
      order_amount: totalAmount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: user.id || "CUST_R_123",
        customer_name: (payerProfile.name || "User").substring(0, 30),
        customer_email: payerProfile.email || "no-email@example.com",
        customer_phone: validPhone.length === 10 ? validPhone : "9999999999",
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/webhooks/cashfree`,
      },
      order_tags: {
        gig_id: gigId,
        // The money recipient — the assigned worker. Was user.id (the payer),
        // which would have funded escrow to the poster themselves.
        worker_id: recipientId,
        type: "ESCROW_DEPOSIT"
      },
      order_note: `Gig Payment: ${(gig.title || '').substring(0, 30)}`
    };

    const CASHFREE_ENV = cashfreeHost();
    const cashfreeUrl = `https://${CASHFREE_ENV}.cashfree.com/pg/orders`;



    let paymentSessionId = "fake_session_123";

    if (process.env.NODE_ENV !== 'development') {
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

      paymentSessionId = data.payment_session_id;
    } else {

    }

    await supabase.from('gigs').update({
      gateway_order_id: orderId,
      payment_gateway: 'CASHFREE',
      escrow_amount: totalAmount,
    }).eq('id', gigId);

    // Duplicate Transaction Insert Removed.
    // The "PENDING" transaction created earlier is the Single Source of Truth V3.

    return NextResponse.json({
      success: true,
      provider: "CASHFREE",
      payment_session_id: paymentSessionId,
      order_id: orderId,
      breakdown
    });

  } catch (error: any) {
    console.error("Order Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}