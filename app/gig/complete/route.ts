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
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch (e) {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch (e) {} },
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

    // 1. Fetch Gig Data including Price/Pay Info
    const { data: gig, error: gigError } = await supabaseAdmin
      .from("gigs")
      .select("poster_id, assigned_worker_id, price, net_worker_pay") // Fetch financial info
      .eq("id", gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });
    
    if (gig.poster_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // 2. Update Gig Status -> COMPLETED
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

    // 3. Update Escrow Ledger
    await supabaseAdmin
      .from("escrow")
      .update({
        status: 'RELEASED',
        released_at: new Date().toISOString()
      })
      .eq("gig_id", gigId);

    // 4. Update Worker Stats & EARNINGS
    if (rating && gig.assigned_worker_id) {
        // A. Insert Rating
        await supabaseAdmin.from("ratings").insert({
            gig_id: gigId,
            rater_id: user.id,
            rated_id: gig.assigned_worker_id,
            score: rating,
            review: review || ""
        });

        // B. Update Worker Profile
        const { data: worker } = await supabaseAdmin
          .from("users")
          .select("rating, rating_count, jobs_completed, total_earned") // Fetch current earnings
          .eq("id", gig.assigned_worker_id)
          .single();

        if (worker) {
          const oldRating = Number(worker.rating) || 5.0; 
          const oldCount = Number(worker.rating_count) || 0;
          const oldJobs = Number(worker.jobs_completed) || 0;
          const currentTotalEarned = Number(worker.total_earned) || 0;

          // Calculate Pay: Use stored net pay, or fallback to 90% of price
          const payoutAmount = gig.net_worker_pay ? Number(gig.net_worker_pay) : (Number(gig.price) * 0.90);

          const newCount = oldCount + 1;
          const newRating = ((oldRating * oldCount) + Number(rating)) / newCount;

          await supabaseAdmin
            .from("users")
            .update({
              rating: newRating,
              rating_count: newCount,
              jobs_completed: oldJobs + 1,
              total_earned: currentTotalEarned + payoutAmount // <--- CRITICAL FIX: Add money
            })
            .eq("id", gig.assigned_worker_id);
        }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}