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

    // 5. Calculate Fees
    const price = Number(gig.price);
    const jobsCompleted = recipientProfile?.jobs_completed || 0;

    // Security Deposit (Only for Market Rent)
    let deposit = 0;
    let escrowCategory = 'PROJECT';

    if (gig.listing_type === 'MARKET' && gig.market_type === 'RENT') {
      deposit = Number(gig.security_deposit) || 0;
      escrowCategory = 'RENTAL_DEPOSIT';
    }

    // Platform Fee Logic
    let platformFee = 0;

    if (gig.listing_type === 'MARKET' && gig.market_type === 'RENT') {
      // Rental Fee: 3% of (Price + Deposit)
      platformFee = Math.ceil((price + deposit) * 0.03);
    } else {
      // Hustle Tiered: 7.5% if jobs > 10, else 10%
      // Note: "Hustle Reward Tier: If a worker has completed more than 10 jobs...". 
      // V3 says "> 10". Previous V2 said ">= 10". I will use "> 10" as per latest prompt.
      const rate = jobsCompleted > 10 ? 0.075 : 0.10;
      platformFee = Math.ceil(price * rate);
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
      base_price: price,
      deposit: deposit,
      platform_fee: platformFee,
      gateway_fee: gatewayFee,
      net_worker_pay: price // Surcharge Model: Worker gets full Price
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

    return NextResponse.json(response.data);

  } catch (error: any) {
    console.error("Order Creation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}