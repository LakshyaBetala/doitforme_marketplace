import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, amount, orderId, razorpayPaymentId } = await req.json();

    if (!userId || !amount || !orderId)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // credit wallet
    await supabase.rpc("increment_wallet_balance", {
      user_id_input: userId,
      amount_input: amount,
    });

    // log transaction
    await supabase.from("transactions").insert({
      user_id: userId,
      type: "WALLET_TOPUP",
      amount,
      payment_id: razorpayPaymentId,
      order_id: orderId,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to verify payment" },
      { status: 500 }
    );
  }
}
