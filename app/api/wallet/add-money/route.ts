import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: Request) {
  try {
    const { amount, userId } = await req.json();

    if (!amount || !userId)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `wallet_add_${userId}_${Date.now()}`,
      notes: { userId },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: amount * 100,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
