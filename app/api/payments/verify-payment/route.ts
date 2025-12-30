import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const { 
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
      gigId,
      posterId 
    } = await req.json();

    // Basic validations
    if (
      !razorpay_payment_id ||
      !razorpay_order_id ||
      !razorpay_signature ||
      !amount ||
      !gigId ||
      !posterId
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    const isValid = generatedSignature === razorpay_signature;

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Invalid Razorpay Signature" },
        { status: 400 }
      );
    }

    // Admin client for DB writes
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Idempotency: if transaction with this razorpay_payment_id already exists, return success
    const { data: existingTxn } = await supabase
      .from("transactions")
      .select("*")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .single();

    if (existingTxn) {
      return NextResponse.json({ success: true, message: "Payment already processed" });
    }

    // Insert a wallet transaction entry with ESCROW_HOLD
    const { error: txnError } = await supabase.from("transactions").insert({
      user_id: posterId,
      gig_id: gigId,
      amount: Number(amount),
      type: "PAYMENT",
      status: "ESCROW_HELD",
      razorpay_payment_id,
      razorpay_order_id,
    });

    if (txnError) throw txnError;

    // Update gig payment status and create an escrow row atomically
    const { error: gigError } = await supabase
      .from("gigs")
      .update({
        payment_status: "ESCROW_HELD",
        escrow_amount: Number(amount),
        escrow_locked_at: new Date().toISOString(),
      })
      .eq("id", gigId);

    if (gigError) throw gigError;

    // Ensure an escrow row exists for this gig
    const { data: escrowExisting } = await supabase
      .from("escrow")
      .select("*")
      .eq("gig_id", gigId)
      .single();

    if (!escrowExisting) {
      const { error: escrowInsertErr } = await supabase.from("escrow").insert({
        gig_id: gigId,
        poster_id: posterId,
        amount: Number(amount),
        status: "HOLDING",
        created_at: new Date().toISOString(),
      });
      if (escrowInsertErr) throw escrowInsertErr;
    }

    return NextResponse.json({
      success: true,
      message: "Payment verified. Amount is now held in escrow.",
    });
  } catch (err: any) {
    console.error("Verify Payment Error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
