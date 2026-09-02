import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    let body;
    try {
      body = await request.json();
    } catch (e: any) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { gigId, rating, review } = body;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: gig, error: gigError } = await supabaseAdmin
      .from("gigs")
      .select("poster_id, assigned_worker_id, listing_type, market_type, security_deposit, title")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    if (gig.poster_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // 2. Move the money through manual_release_escrow.
    //
    // This route used to perform the release by hand — update escrow, update the
    // gig, write the ledger rows — and never inserted a payout_queue row. Neither
    // did the Activity approve button or the auto-release cron, so payout_queue
    // sat empty database-wide and no worker was ever queued to be paid while the
    // UI cheerfully reported "funds released".
    //
    // The RPC is the only implementation that locks the HELD escrow row against a
    // double payout, refuses when the worker has no UPI to pay into, and queues
    // the payout. Every release path goes through it now.

    // Read the fee actually charged at funding, for the ledger rows below.
    const { data: escrowRecord } = await supabaseAdmin
      .from("escrow")
      .select("platform_fee")
      .eq("gig_id", gigId)
      .maybeSingle();
    const platformFee = Math.max(0, Number(escrowRecord?.platform_fee) || 0);

    const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("manual_release_escrow", {
      p_gig_id: gigId,
    });

    if (rpcErr) {
      console.error(`[gig/complete] release RPC failed gig=${gigId}:`, rpcErr);
      return NextResponse.json({ error: rpcErr.message || "Release failed" }, { status: 500 });
    }
    // The RPC reports refusal in its RETURN VALUE, not as a Postgres error, so
    // checking only rpcErr reports success for every refused release.
    if (!rpcData?.success) {
      const reason = rpcData?.error || "Release failed";
      const status = rpcData?.code === "WORKER_UPI_MISSING" ? 409 : 400;
      console.error(`[gig/complete] release refused gig=${gigId}: ${reason}`);
      return NextResponse.json({ error: reason, code: rpcData?.code }, { status });
    }

    const payoutAmount = Number(rpcData.amount) || 0;
    const payoutDestination = gig.assigned_worker_id;

    // The RPC owns escrow / gigs / payout_queue. These rows are the
    // human-readable history behind that move.
    if (platformFee > 0) {
      await supabaseAdmin.from("transactions").insert({
        gig_id: gigId,
        user_id: user.id,
        amount: platformFee,
        type: "PLATFORM_FEE",
        status: "COMPLETED",
        provider_data: { description: `Platform fee for ${gig.title}` }
      });
    }

    if (payoutAmount > 0 && payoutDestination) {
      await supabaseAdmin.from("transactions").insert({
        gig_id: gigId,
        user_id: payoutDestination,
        amount: payoutAmount,
        type: "PAYOUT_CREDIT",
        status: "COMPLETED", // internal credit; the actual UPI transfer is manual
        provider_data: { description: `Payout for ${gig.title}` }
      });
    }

    // The RPC does not clear the auto-release timer; without this the cron would
    // still consider the gig eligible.
    await supabaseAdmin.from("gigs").update({ auto_release_at: null }).eq("id", gigId);

    // 3. Add Rating
    if (rating && gig.assigned_worker_id) {
      await supabaseAdmin.from("ratings").insert({
        gig_id: gigId,
        rater_id: user.id,
        rated_id: gig.assigned_worker_id,
        score: rating,
        review: review || ""
      });

      // 4. Update Worker Stats
      const { data: worker } = await supabaseAdmin
        .from("users")
        .select("rating, rating_count, jobs_completed")
        .eq("id", gig.assigned_worker_id)
        .single();

      if (worker) {
        const oldRating = Number(worker.rating) || 5.0;
        const oldCount = Number(worker.rating_count) || 0;
        const oldJobs = Number(worker.jobs_completed) || 0;
        const newCount = oldCount + 1;
        const newRating = ((oldRating * oldCount) + Number(rating)) / newCount;

        const updateData: any = {
          rating: newRating,
          rating_count: newCount,
        };

        updateData.jobs_completed = oldJobs + 1;
        // If total_earned exists, update it here as well
        const { data: userCurrent } = await supabaseAdmin.from('users').select('total_earned').eq('id', gig.assigned_worker_id).maybeSingle();
        if (userCurrent) {
          updateData.total_earned = (Number(userCurrent.total_earned) || 0) + payoutAmount;
        }

        await supabaseAdmin
          .from("users")
          .update(updateData)
          .eq("id", gig.assigned_worker_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Complete API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to complete gig" }, { status: 500 });
  }
}