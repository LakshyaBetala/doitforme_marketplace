import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch (e) { } },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch (e) { } },
      },
    }
  )

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { gigId, rating, review } = await request.json();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: gig, error: gigError } = await supabaseAdmin
      .from("gigs")
      .select("poster_id, assigned_worker_id, listing_type, market_type, security_deposit, title")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    if (gig.poster_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // 2. Determine Payout Logic based on Type
    const listingType = gig.listing_type || 'HUSTLE';
    const marketType = gig.market_type;
    const deposit = gig.security_deposit || 0;

    // Default: Hustle -> Payout to Worker
    let payoutDestination = gig.assigned_worker_id;
    let payoutAmount = 0; // Will fetch from Escrow
    let refundDestination = null;
    let refundAmount = 0;

    // Fetch Escrow Record to get the held amount
    const { data: escrowRecord } = await supabaseAdmin
      .from("escrow")
      .select("amount_held")
      .eq("gig_id", gigId)
      .single();

    if (!escrowRecord) return NextResponse.json({ error: "Escrow record not found" }, { status: 500 });

    const totalHeld = Number(escrowRecord.amount_held);

    if (listingType === 'MARKET') {
      if (marketType === 'SELL') {
        // Sell: Payout to POSTER (Seller)
        payoutDestination = gig.poster_id;
        payoutAmount = totalHeld;
      } else if (marketType === 'RENT') {
        // Rent: Refund Deposit to WORKER (Renter), Payout Rest to POSTER (Owner)
        refundDestination = gig.assigned_worker_id;
        refundAmount = deposit;

        payoutDestination = gig.poster_id;
        payoutAmount = totalHeld - deposit;
      }
    } else {
      // Hustle
      // ADAPTIVE FEE LOGIC
      // Fetch user stats to determine fee tier
      const { data: workerStats } = await supabaseAdmin
        .from("users")
        .select("jobs_completed")
        .eq("id", gig.assigned_worker_id)
        .single();

      const jobsDone = workerStats?.jobs_completed || 0;
      const feeRate = jobsDone > 10 ? 0.075 : 0.10; // 7.5% for experienced, 10% for new
      const platformFee = Math.ceil(totalHeld * feeRate);

      payoutAmount = totalHeld - platformFee;

      // Log Fee Transaction
      await supabaseAdmin.from("transactions").insert({
        gig_id: gigId,
        user_id: user.id, // Log under admin/system? Or just no user_id for system? 
        // Better: user_id = null usually means system, but let's just log description
        amount: platformFee,
        type: "PLATFORM_FEE",
        status: "COMPLETED",
        description: `Platform Fee (${(feeRate * 100).toFixed(1)}%) for ${gig.title}`
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
        description: `Payout for ${gig.title}`
      });
    }

    // Log Refund Transaction (if any)
    if (refundAmount > 0 && refundDestination) {
      await supabaseAdmin.from("transactions").insert({
        gig_id: gigId,
        user_id: refundDestination,
        amount: refundAmount,
        type: "REFUND_CREDIT",
        status: "COMPLETED",
        description: `Security Deposit Refund for ${gig.title}`
      });
    }

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

        await supabaseAdmin
          .from("users")
          .update({
            rating: newRating,
            rating_count: newCount,
            jobs_completed: oldJobs + 1
          })
          .eq("id", gig.assigned_worker_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}