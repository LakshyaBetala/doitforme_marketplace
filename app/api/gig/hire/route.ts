import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from "@supabase/supabase-js";
import fs from 'fs';

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  try {
    const body = await req.json();
    // SECURITY: strictly ignore 'price' from the body
    const { gigId, workerId } = body;

    // 1. Authenticate User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. SECURITY: Fetch Real Price from DB
    const { data: gig, error: gigError } = await supabase
      .from("gigs")
      .select("price, title, security_deposit")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) {
      return NextResponse.json({ error: "Gig not found or invalid" }, { status: 404 });
    }

    // Check for Negotiated Price in Applications
    const { data: application } = await supabase
      .from("applications")
      .select("negotiated_price")
      .eq("gig_id", gigId)
      .eq("worker_id", workerId)
      .single();

    // 3. Calculate Total Amount
    // Use negotiated price if available, otherwise base gig price
    const basePrice = application?.negotiated_price ? Number(application.negotiated_price) : Number(gig.price);
    const deposit = Number(gig.security_deposit) || 0;

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Hustle: Flat 3% escrow fee deducted from hustler payout
    // Client pays exact listed price — hustler receives 97%
    const platformFee = Math.ceil(basePrice * 0.03);

    // Payer (Hiring Client) Subtotal is just Price + Deposit
    const subtotal = basePrice + deposit;
    const gatewayFee = Math.ceil(subtotal * 0.02); // 2% Gateway surcharge
    const totalAmountToCharge = subtotal + gatewayFee;

    // 4. Prepare Cashfree Order Data
    // Shorten orderId to avoid 50 character limit in Cashfree
    const orderId = `ORD_${Date.now()}_${gigId.split('-')[0]}`;

    // Create Transaction Record (PENDING) so verify-payment succeeds
    const breakdown = {
      subtotal: subtotal,
      renter_fee: 0,
      gateway_fee: gatewayFee,
      discount_applied: false,
      total: totalAmountToCharge,
      platform_fee: platformFee, // 3% deducted from hustler payout
      base_price: basePrice,
      deposit: deposit,
      net_worker_pay: basePrice - platformFee
    };

    const { error: txnError } = await supabaseAdmin.from('transactions').insert({
      gig_id: gigId,
      user_id: user.id, // Payer (Poster)
      amount: totalAmountToCharge,
      type: 'ESCROW_DEPOSIT',
      status: 'PENDING',
      gateway: 'CASHFREE',
      gateway_order_id: orderId,
      provider_data: { breakdown }
    });

    if (txnError) throw txnError;

    // FIX: Return URL must point to the FRONTEND page, not the API
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/gig/${gigId}?payment=verify&order_id={order_id}&worker_id=${encodeURIComponent(workerId)}`;

    // Ensure phone is exactly 10 digits to prevent Cashfree validation errors
    const validPhone = (user.phone || "").replace(/\D/g, '').slice(-10) || "9999999999";

    const payload = {
      order_amount: totalAmountToCharge,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: user.id || "CUST_123",
        customer_name: (user.user_metadata?.name || "Client").substring(0, 30),
        customer_phone: validPhone.length === 10 ? validPhone : "9999999999",
        customer_email: user.email || "no-email@example.com"
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/webhooks/cashfree`
      },
      order_tags: {
        gig_id: gigId,
        worker_id: workerId,
        type: "GIG_PAYMENT"
      },
      order_note: `Gig: ${(gig.title || '').substring(0, 30)}`
    };

    console.log("Initiating Payment:", orderId, "| Amount:", totalAmountToCharge, "Payload:", JSON.stringify(payload));

    // 5. Dynamic URL (Sandbox vs Production)
    const CASHFREE_ENV = process.env.NODE_ENV === 'production' ? 'api' : 'sandbox';
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
      console.log("DEV MODE BYPASS: Skipping Cashfree network call, mocking session ID.");
    }

    // 6. Mark Gig as Payment Pending in DB
    await supabase.from("gigs").update({
      payment_gateway: 'CASHFREE',
      gateway_order_id: orderId
    }).eq("id", gigId);

    return NextResponse.json({
      success: true,
      paymentSessionId: paymentSessionId,
      orderId: orderId
    });

  } catch (error: any) {
    console.error("Hire Route Error:", error.message);
    try {
      fs.appendFileSync('hire_error.log', new Date().toISOString() + ' - ' + error.message + '\n' + error.stack + '\n\n');
    } catch (e) { }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}