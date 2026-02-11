import { NextResponse } from "next/server";
import { Cashfree } from "cashfree-pg";
import { supabaseServer } from "@/lib/supabaseServer";

// @ts-ignore
Cashfree.XClientId = process.env.CASHFREE_APP_ID!;
// @ts-ignore
Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY!;
// @ts-ignore
Cashfree.XEnvironment = Cashfree.Environment.SANDBOX; // Switch to PRODUCTION when live

export async function POST(req: Request) {
  try {
    const { gigId, posterId, posterPhone, posterEmail } = await req.json();

    const supabase = await supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch the REAL price from DB (Security: Never trust the client side)
    const { data: gig, error } = await supabase
      .from("gigs")
      .select("price, title")
      .eq("id", gigId)
      .single();

    if (error || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // 2. Calculate Surcharge (The 2% Gateway Fee)
    // We add this to the total so the Poster pays it, not you.
    const basePrice = Number(gig.price);
    const surcharge = Math.ceil(basePrice * 0.02); // 2% 
    const totalAmountToCharge = basePrice + surcharge;

    // Generate Order ID
    const orderId = `gig_${gigId}_${Date.now()}`;

    const request = {
      order_amount: totalAmountToCharge, // <--- We send the Higher Amount here
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: posterId,
        customer_phone: posterPhone || "9999999999",
        customer_email: posterEmail || user?.email || "user@example.com",
      },
      order_meta: {
        // Pass gig_id in return_url so we can read it in the Verify step
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/verify-payment?order_id={order_id}&gig_id=${gigId}`, 
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
      },
      order_note: `Gig: ${gig.title} (Incl. Gateway Fee)`,
    };

    // @ts-ignore
    const response = await Cashfree.PGCreateOrder("2023-08-01", request);

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Cashfree Create Order Error:", error.response?.data?.message || error.message);
    return NextResponse.json(
      { error: error.response?.data?.message || "Payment initialization failed" },
      { status: 500 }
    );
  }
}