import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: gigs } = await supabase
      .from("gigs")
      .select("*")
      .eq("payment_status", "ESCROW_HELD")
      .lte("escrow_locked_at", cutoff.toISOString());

    if (!gigs || gigs.length === 0) {
      return NextResponse.json({ message: "No gigs to release" });
    }

    for (const gig of gigs) {
      const workerId = gig.assigned_worker_id;
      const amount = gig.escrow_amount;
      const platformFee = amount * 0.1;
      const workerAmount = amount - platformFee;

      await supabase.from("wallets").upsert(
        {
          user_id: workerId,
          balance: workerAmount,
        },
        { onConflict: "user_id" }
      );

      await supabase
        .from("gigs")
        .update({
          payment_status: "RELEASED",
          released_at: new Date().toISOString(),
        })
        .eq("id", gig.id);

      await supabase.from("transactions").insert({
        gig_id: gig.id,
        user_id: workerId,
        amount: workerAmount,
        type: "ESCROW_AUTO_RELEASE",
        status: "COMPLETED",
      });
    }

    return NextResponse.json({
      success: true,
      releasedCount: gigs.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
