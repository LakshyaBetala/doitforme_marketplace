import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const provided = req.headers.get("x-cron-secret");
      if (!provided || provided !== secret) {
        return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
      }
    }
  } catch (_) {}

  const details: Array<any> = [];
  let releasedCount = 0;

  try {
    const now = new Date().toISOString();

    // 1. Fetch eligible gigs (Timer Passed + Held + No Dispute)
    const { data: gigs, error: gigsErr } = await supabase
      .from("gigs")
      .select("*, users!assigned_worker_id(id, upi_id)")
      .eq("status", "DELIVERED")
      .lt("auto_release_at", now) // <--- Check 24h timer
      .eq("payment_status", "HELD")
      .is("dispute_reason", null)   
      .limit(50);

    if (gigsErr) return NextResponse.json({ error: gigsErr.message }, { status: 500 });
    if (!gigs || gigs.length === 0) return NextResponse.json({ success: true, releasedCount: 0, message: "No gigs to release" });

    // 2. Process Auto-Release
    for (const gig of gigs) {
      const payoutAmount = gig.price * 0.90;
      console.log(`[AUTO-RELEASE] Pay ₹${payoutAmount} to UPI: ${gig.users?.upi_id}`);

      // Update Gig Status -> PAYOUT_PENDING
      const { error: updateErr } = await supabase
        .from("gigs")
        .update({
            status: 'COMPLETED',
            payment_status: 'PAYOUT_PENDING',
            auto_release_at: null
        })
        .eq('id', gig.id);
      
      if (!updateErr) {
          releasedCount++;
          // Update stats too (optional for auto-release)
          await supabase.rpc('increment_worker_stats', { worker_id: gig.assigned_worker_id, amount: payoutAmount });
          details.push({ gigId: gig.id, status: "Queued for Manual Payout" });
      } else {
          details.push({ gigId: gig.id, error: updateErr.message });
      }
    }

    return NextResponse.json({ success: true, releasedCount, details });

  } catch (err: any) {
    console.error("Auto-release cron failed:", err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}