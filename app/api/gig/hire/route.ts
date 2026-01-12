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
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch (error) {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch (error) {} },
      },
    }
  )

  try {
    const body = await req.json();
    const { gigId, workerId, price } = body;

    // 1. Authenticate User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Prepare Cashfree Order Data
    const orderId = `ORDER_${gigId}_${Date.now()}`;
    
    // Return URL: This is where Cashfree sends the user after payment
    // We pass worker_id so the verification route knows who to assign
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/gig/${gigId}?payment=verify&order_id={order_id}&worker_id=${workerId}`;

    const payload = {
        order_amount: price,
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
            notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/cashfree` // Optional backup
        },
        order_tags: {
            gig_id: gigId,
            worker_id: workerId,
            type: "GIG_PAYMENT"
        }
    };

    console.log("Initiating Payment via Fetch:", orderId);

    // 3. Call Cashfree API Directly (Bypasses SDK Version Issues)
    // NOTE: using 'sandbox.cashfree.com'. Change to 'api.cashfree.com' for production.
    const response = await fetch("https://sandbox.cashfree.com/pg/orders", { 
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

    // 4. Mark Gig as Payment Pending in DB
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