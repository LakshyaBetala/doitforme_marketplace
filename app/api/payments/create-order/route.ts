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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Fetch GIG AND POSTER details in one go using a Join or separate query
    // Fetch the gig price
    const { data: gig, error: gigError } = await supabase
      .from("gigs")
      .select("price, title, poster_id")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // 3. FETCH ACTUAL USER DETAILS (Phone and Email) from the users table
    const { data: dbUser, error: userError } = await supabase
      .from("users")
      .select("email, phone, name")
      .eq("id", gig.poster_id)
      .single();

    if (userError || !dbUser) {
        return NextResponse.json({ error: "Poster profile not found" }, { status: 404 });
    }

    // 4. Calculate Surcharge
    const basePrice = Number(gig.price);
    const surcharge = Math.ceil(basePrice * 0.02); 
    const totalAmountToCharge = basePrice + surcharge;

    const orderId = `gig_${gigId}_${Date.now()}`;

    // 5. Build Cashfree Request using DATABASE values
    const request = {
      order_amount: totalAmountToCharge, 
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: gig.poster_id,
        // Convert numeric phone from DB to string for Cashfree
        customer_phone: dbUser.phone ? String(dbUser.phone) : "9999999999", 
        customer_email: dbUser.email || user.email,
        customer_name: dbUser.name || "Customer"
      },
      order_meta: {
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/verify-payment?order_id={order_id}&gig_id=${gigId}`, 
        notify_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
      },
      order_note: `Gig: ${gig.title}`,
    };

    // @ts-ignore
    const response = await Cashfree.PGCreateOrder("2023-08-01", request);

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Cashfree Order Error:", error.message);
    return NextResponse.json({ error: "Payment setup failed" }, { status: 500 });
  }
}