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
  } catch (_) { }

  const details: Array<any> = [];
  let releasedCount = 0;

  try {
    const now = new Date().toISOString();

    // 1. Fetch eligible gigs (Timer Passed + Held + No Dispute)
    const { data: gigs, error: gigsErr } = await supabase
      .from("gigs")
      .select("*, worker:users!assigned_worker_id(id, upi_id, jobs_completed), poster:users!poster_id(id, upi_id, jobs_completed)")
      .eq("status", "DELIVERED")
      .lt("auto_release_at", now) // <--- Check 24h timer
      .eq("payment_status", "HELD")
      .is("dispute_reason", null)
      .limit(50);

    if (gigsErr) return NextResponse.json({ error: gigsErr.message }, { status: 500 });
    if (!gigs || gigs.length === 0) return NextResponse.json({ success: true, releasedCount: 0, message: "No gigs to release" });

    // 2. Process Auto-Release
    for (const gig of gigs) {
      // MARKET: Pay Poster (Seller)
      // HUSTLE: Pay Assigned Worker
      const recipient = (gig.listing_type === 'MARKET') ? gig.poster : gig.worker;
      const recipientId = (gig.listing_type === 'MARKET') ? gig.poster_id : gig.assigned_worker_id;

      // ADAPTIVE FEE LOGIC (Phase 4)
      // Base Fee: 10%
      // Experienced (>10 jobs): 7.5%
      const completedJobs = recipient?.jobs_completed || 0;
      const feeRate = completedJobs > 10 ? 0.075 : 0.10;
      const platformFee = Math.ceil(gig.price * feeRate);

      const payoutAmount = gig.price - platformFee;

      // Handle Rental Deposit Refund (if applicable)
      if (gig.listing_type === 'MARKET' && gig.market_type === 'RENT' && gig.security_deposit > 0) {
        await supabase.from("transactions").insert({
          gig_id: gig.id,
          user_id: gig.assigned_worker_id, // Renter
          amount: gig.security_deposit,
          type: "REFUND_CREDIT",
          status: "COMPLETED",
          description: `Auto-Release: Security Deposit Refund for ${gig.title}`
        });
      }

      // Log Fee
      await supabase.from("transactions").insert({
        gig_id: gig.id,
        amount: platformFee,
        type: "PLATFORM_FEE",
        status: "COMPLETED",
        description: `Auto-Release Fee (${(feeRate * 100).toFixed(1)}%)`
      });

      console.log(`[AUTO-RELEASE] Fee: ₹${platformFee} | Payout: ₹${payoutAmount} | Recipient: ${recipient?.upi_id}`);

      // Transaction for Payout
      await supabase.from("transactions").insert({
        gig_id: gig.id,
        user_id: recipientId,
        amount: payoutAmount,
        type: "PAYOUT_CREDIT",
        status: "COMPLETED",
        description: `Auto-Release Payout for ${gig.title}`
      });

      // Update Gig Status -> COMPLETED
      const { error: updateErr } = await supabase
        .from("gigs")
        .update({
          status: 'completed',
          escrow_status: 'RELEASED', // Make sure to mark escrow as released
          payment_status: 'PAYOUT_PENDING',
          auto_release_at: null
        })
        .eq('id', gig.id);

      if (!updateErr) {
        releasedCount++;
        // Update stats too (optional for auto-release)
        // Update stats too (recipient gets the stats)
        await supabase.rpc('increment_worker_stats', { worker_id: recipientId, amount: payoutAmount });
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