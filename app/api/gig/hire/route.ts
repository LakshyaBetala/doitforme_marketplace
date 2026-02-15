import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch (error) { }
        },
        remove(name: string, options: CookieOptions) {
          // FIX: 'value' is not in scope here, so we must explicitly set it to empty string
          try { cookieStore.set({ name, value: '', ...options }) } catch (error) { }
        }
      },
    }
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

    // 3. Calculate Total Amount (Including 2% Gateway Fee)
    const basePrice = Number(gig.price);
    const deposit = Number(gig.security_deposit) || 0;
    const subtotal = basePrice + deposit;

    const surcharge = Math.ceil(subtotal * 0.02); // 2% Surcharge on total
    const totalAmountToCharge = subtotal + surcharge;

    // 4. Prepare Cashfree Order Data
    const orderId = `ORDER_${gigId}_${Date.now()}`;

    // FIX: Return URL must point to the FRONTEND page, not the API
    // We add query params so the frontend knows to verify the payment on load
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/gig/${gigId}?payment=verify&order_id={order_id}&worker_id=${workerId}`;

    const payload = {
      order_amount: totalAmountToCharge,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: user.id,
        customer_name: user.user_metadata?.name || "Client",
        customer_phone: user.phone || "9999999999",
        customer_email: user.email || "no-email@example.com"
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/cashfree`
      },
      order_tags: {
        gig_id: gigId,
        worker_id: workerId,
        type: "GIG_PAYMENT"
      },
      order_note: `Gig: ${gig.title}`
    };

    console.log("Initiating Payment:", orderId, "| Amount:", totalAmountToCharge);

    // 5. Dynamic URL (Sandbox vs Production)
    const CASHFREE_ENV = process.env.NODE_ENV === 'production' ? 'api' : 'sandbox';
    const cashfreeUrl = `https://${CASHFREE_ENV}.cashfree.com/pg/orders`;

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}