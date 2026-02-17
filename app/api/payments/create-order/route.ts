import { NextResponse } from "next/server";
import { Cashfree } from "cashfree-pg";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    // 1. Setup Cashfree
    // @ts-ignore
    Cashfree.XClientId = process.env.CASHFREE_APP_ID!;
    // @ts-ignore
    Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY!;
    // @ts-ignore
    Cashfree.XEnvironment = process.env.NODE_ENV === "production" ? "PRODUCTION" : "SANDBOX";

    const { gigId } = await req.json();

    const supabase = await supabaseServer();
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
    let platformFee = 0;
    let discountApplied = false;

    if (gig.listing_type === 'MARKET' && gig.market_type === 'RENT') {
      // Rental Fee: 3% of (Price + Deposit)
      platformFee = Math.ceil((price + deposit) * 0.03);
    } else {
      // Hustle/Sell Tiered: 7.5% if jobs > 10, else 10%
      // Veteran Discount for Experienced Workers (or Sellers)
      if (jobsCompleted > 10) {
        platformFee = Math.ceil(price * 0.075);
        discountApplied = true;
      } else {
        platformFee = Math.ceil(price * 0.10);
      }
    }

    // Subtotal (Base charge before Gateway)
    // Logic: User Pays: Price + Deposit + Platform Fee + Gateway Fee
    const subtotal = price + deposit + platformFee;

    // Gateway Fee (2%)
    const gatewayFee = Math.ceil(subtotal * 0.02);

    const totalAmount = subtotal + gatewayFee;

    const orderId = `order_${gigId}_${Date.now()}`;

    // [New] Create Transaction Record (PENDING) with Fee Breakdown
    const breakdown = {
      subtotal: subtotal,
      processingFee: gatewayFee,
      discountApplied: discountApplied, // "Campus Pro Discount Applied" UI trigger
      total: totalAmount,
      platformFee: platformFee,
      basePrice: price,
      deposit: deposit
    };

    const { error: txnError } = await supabase.from('transactions').insert({
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

    // 6. Create Cashfree Order
    const request = {
      order_amount: totalAmount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: user.id,
        customer_name: payerProfile.name || "User",
        customer_email: payerProfile.email || "user@example.com",
        customer_phone: String(payerProfile.phone || "9999999999"),
      },
      order_meta: {
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/gig/${gigId}?payment_status={order_status}`,
        notify_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/payments/webhook`,
      },
    };

    // @ts-ignore
    const response = await Cashfree.PGCreateOrder("2023-08-01", request);

    await supabase.from('gigs').update({
      gateway_order_id: orderId,
      payment_gateway: 'CASHFREE',
      escrow_amount: totalAmount,
    }).eq('id', gigId);

    // Duplicate Transaction Insert Removed.
    // The "PENDING" transaction created earlier is the Single Source of Truth V3.

    return NextResponse.json({ ...response.data, breakdown });

  } catch (error: any) {
    console.error("Order Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}