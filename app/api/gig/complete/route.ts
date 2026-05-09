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

    // 2. Determine Payout Logic


    // Payout to Worker
    let payoutDestination = gig.assigned_worker_id;
    let payoutAmount = 0; // Will fetch from Escrow

    // Fetch Escrow Record to get the held amount safely
    const { data: escrowRecord, error: escrowFetchError } = await supabaseAdmin
      .from("escrow")
      .select("amount_held")
      .eq("gig_id", gigId)
      .maybeSingle();

    if (escrowFetchError) {
      console.error("Escrow Fetch Error:", escrowFetchError);
    }

    const totalHeld = Number(escrowRecord?.amount_held) || 0;

    if (!escrowRecord) {
      return NextResponse.json({ error: "Escrow record not found" }, { status: 500 });
    }

    // Hustle — Flat 3% escrow fee deducted from worker payout
    const feeRate = 0.03;
    const platformFee = Math.max(0, Math.ceil(totalHeld * feeRate));

    payoutAmount = Math.max(0, totalHeld - platformFee);

      // Log Fee Transaction
      if (platformFee > 0) {
        await supabaseAdmin.from("transactions").insert({
    // Log Fee Transaction
    if (platformFee > 0) {
      await supabaseAdmin.from("transactions").insert({
        gig_id: gigId,
        user_id: user.id,
        amount: platformFee,
        type: "PLATFORM_FEE",
        status: "COMPLETED",
        provider_data: { description: `Escrow Fee (3%) for ${gig.title}` }
      });
    }

    // 3. Update Gig Status -> COMPLETED
    const { error: updateError } = await supabaseAdmin
      .from("gigs")
      .update({
        status: "completed",
        escrow_status: 'RELEASED',
        payment_status: 'PAYOUT_PENDING',
        auto_release_at: null
      })
      .eq("id", gigId);

    if (updateError) return NextResponse.json({ error: "Failed to update gig" }, { status: 500 });

    // 4. Update Escrow Ledger & Log Transactions
    await supabaseAdmin
      .from("escrow")
      .update({
        status: 'RELEASED',
        released_at: new Date().toISOString()
      })
      .eq("gig_id", gigId);

    // Log Payout Transaction
    if (payoutAmount > 0 && payoutDestination) {
      await supabaseAdmin.from("transactions").insert({
        gig_id: gigId,
        user_id: payoutDestination,
        amount: payoutAmount,
        type: "PAYOUT_CREDIT",
        status: "COMPLETED", // Internal credit
        provider_data: { description: `Payout for ${gig.title}` }
      });
    }

    // Refund Logic Removed

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