import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Cashfree } from "cashfree-pg"; 

// FIX: We cast this to 'any' to silence TypeScript
const PgCashfree = Cashfree as any;

PgCashfree.XClientId = process.env.CASHFREE_APP_ID;
PgCashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
PgCashfree.XEnvironment = PgCashfree.Environment.SANDBOX; 

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

    // 2. Create Cashfree Order
    const orderId = `ORDER_${gigId}_${Date.now()}`;
    
    // Return URL: where user goes after payment
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/gig/${gigId}?payment=verify&order_id={order_id}&worker_id=${workerId}`;

    const request = {
        order_amount: price,
        order_currency: "INR",
        order_id: orderId,
        customer_details: {
            customer_id: user.id,
            customer_phone: user.phone || "9999999999",
            customer_email: user.email || "no-email@example.com"
        },
        order_meta: {
            return_url: returnUrl,
        },
        order_tags: {
            gig_id: gigId,
            worker_id: workerId
        }
    };

    console.log("Initiating Payment for Order:", orderId);
    
    // FIX IS HERE: Use 'PgCashfree' instead of 'Cashfree'
    const response = await PgCashfree.PGCreateOrder("2023-08-01", request);
    
    const paymentSessionId = response.data.payment_session_id;

    // 3. Mark Gig as Payment Pending
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
    console.error("Cashfree Order Error:", error.response?.data?.message || error.message);
    return NextResponse.json({ error: "Payment initiation failed." }, { status: 500 });
  }
}