import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: Request) {
  try {
    const { amount, gigId, posterId } = await req.json();

    if (!amount || !gigId || !posterId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const orderAmount = Number(amount) * 100;

    const order = await razorpay.orders.create({
      amount: orderAmount,
      currency: "INR",
      receipt: `gig_${gigId}_${Date.now()}`,
      notes: {
        gigId,
        posterId,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: orderAmount,
      currency: "INR",
    });
  } catch (err: any) {
    console.error("Razorpay Order Error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
