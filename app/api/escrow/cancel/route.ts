import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { gigId, posterId } = await req.json();

    if (!gigId || !posterId) {
      return NextResponse.json(
        { error: "Missing gigId/posterId" },
        { status: 400 }
      );
    }

    const { data: gig } = await supabase
      .from("gigs")
      .select("*")
      .eq("id", gigId)
      .single();

    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    if (gig.user_id !== posterId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    if (gig.payment_status !== "ESCROW_HELD")
      return NextResponse.json({ error: "Nothing to cancel" }, { status: 400 });

    const amount = gig.escrow_amount;
    const fee = amount * 0.10;
    const refundAmount = amount - fee;

    // refund poster wallet
    await supabase.from("wallets").upsert(
      { user_id: posterId, balance: refundAmount },
      { onConflict: "user_id" }
    );

    await supabase
      .from("gigs")
      .update({
        payment_status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", gigId);

    return NextResponse.json({
      success: true,
      refundAmount,
      platformFee: fee,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
