import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createRazorpayOrder, razorpayConfigured } from "@/lib/razorpay";
import { buildPaymentBreakdown, audienceForGig } from "@/lib/fees";
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from "@supabase/supabase-js";

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
      return NextResponse.json({ error: "Please log in to hire a worker." }, { status: 401 });
    }

    // 2. SECURITY: Fetch Real Price from DB
    const { data: gig, error: gigError } = await supabase
      .from("gigs")
      .select("price, title, security_deposit, poster_id, company_id, listing_type, market_type")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) {
      return NextResponse.json({ error: "Gig not found or invalid" }, { status: 404 });
    }

    if (gig.poster_id !== user.id) {
      return NextResponse.json({ error: "You do not have permission to hire for this task." }, { status: 403 });
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
    const gigForFee = { company_id: gig.company_id, listing_type: gig.listing_type };

    // No price floor. This used to refuse escrow below Rs 500 and push people to
    // "Direct Connect" — but the median gig is Rs 499, so the majority of jobs
    // were steered off-platform by design, which is why 223 of 267 applications
    // went Direct and GMV stayed at zero. Direct is gone; escrow is the only path.
    if (!Number.isFinite(basePrice) || basePrice < 1) {
      return NextResponse.json({ error: "This gig doesn't have a valid price." }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fees come from lib/fees.ts, the single source of truth verified by
    // tests/unit/payout.test.mjs. This route previously hardcoded a flat 3%,
    // a rate that no longer exists — so the same gig priced one way through
    // create-order (5% student / 10% business) and another way through here.
    // Since this is the route the applicant-review screen actually calls, every
    // real hire was being charged the wrong fee and the worker paid the wrong
    // amount out of escrow.
    const feeAudience = audienceForGig(gigForFee);
    const b = buildPaymentBreakdown({ price: basePrice, deposit, audience: feeAudience });

    const platformFee = b.platformFee;
    const subtotal = b.subtotal;
    const gatewayFee = b.gatewayFee;
    const totalAmountToCharge = b.total;

    // 4. Prepare the order. This receipt is our own reference; Razorpay caps
    //    `receipt` at 40 characters.
    const orderId = `ORD_${Date.now()}_${gigId.split('-')[0]}`;

    // Create Transaction Record (PENDING) so verify-payment succeeds
    const breakdown = {
      subtotal: subtotal,
      renter_fee: 0,
      gateway_fee: gatewayFee,
      discount_applied: false,
      total: totalAmountToCharge,
      platform_fee: platformFee,
      fee_audience: feeAudience,
      // Settlement reads the recipient from HERE, never from the request body.
      recipient_id: workerId,
      base_price: basePrice,
      deposit: deposit,
      net_worker_pay: b.netWorkerPay
    };

    // RAZORPAY branch. The breakdown above is unchanged — only the gateway
    // differs. Order is created first so a gateway failure leaves no orphan
    // PENDING transaction.
    if (!razorpayConfigured()) {
      console.error("[hire] Razorpay credentials missing");
      return NextResponse.json({ error: "Payments are temporarily unavailable." }, { status: 503 });
    }

    const rzpOrder = await createRazorpayOrder({
      amountRupees: totalAmountToCharge,
      receipt: orderId,
      notes: { gig_id: gigId, worker_id: workerId, type: "GIG_PAYMENT" },
    });

    const { error: rzpTxnError } = await supabaseAdmin.from('transactions').insert({
      gig_id: gigId,
      user_id: user.id,
      amount: totalAmountToCharge,
      type: 'ESCROW_DEPOSIT',
      status: 'PENDING',
      gateway: 'RAZORPAY',
      gateway_order_id: rzpOrder.id,
      provider_data: { breakdown, receipt: orderId }
    });
    if (rzpTxnError) throw rzpTxnError;

    await supabase.from("gigs").update({
      payment_gateway: 'RAZORPAY',
      gateway_order_id: rzpOrder.id
    }).eq("id", gigId);

    const { data: payer } = await supabase
      .from('users').select('name, email, phone').eq('id', user.id).maybeSingle();

    return NextResponse.json({
      success: true,
      provider: "RAZORPAY",
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
      gig_title: gig.title,
      prefill: {
        name: payer?.name || "",
        email: payer?.email || "",
        contact: String(payer?.phone || "").replace(/\D/g, "").slice(-10),
      },
    });
  } catch (error: any) {
    console.error("Hire Route Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}