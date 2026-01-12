import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

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

  const { gigId, rating, review } = await request.json();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Get Gig Data & Worker Details
  // FIX: Added 'poster_id' to the select list so we can check ownership below
  const { data: gig, error: gigError } = await supabase
    .from("gigs")
    .select("poster_id, assigned_worker_id, price, users!assigned_worker_id(upi_id)")
    .eq("id", gigId)
    .single();

  if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });
  
  // Now 'poster_id' exists and this check will pass
  if (gig.poster_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  // --- 3. MANUAL PAYOUT CALCULATION (90%) ---
  const PLATFORM_FEE_PERCENT = 0.10; 
  const payoutAmount = gig.price * (1 - PLATFORM_FEE_PERCENT);
  
  // FIX: Handle 'users' being an array or object to satisfy TypeScript
  const workerData: any = gig.users;
  const workerUpi = Array.isArray(workerData) ? workerData[0]?.upi_id : workerData?.upi_id;

  // LOG FOR ADMIN: This tells you exactly what to do in your server logs
  console.log(`[MANUAL PAYOUT ACTION] Pay ₹${payoutAmount} to UPI: ${workerUpi}`);

  // 4. Update Gig Status -> PAYOUT_PENDING
  // This is crucial: It marks the gig as 'Waiting for you to send money'
  const { error: updateError } = await supabase
    .from("gigs")
    .update({ 
      status: "COMPLETED", 
      payment_status: 'PAYOUT_PENDING', // <--- IMPORTANT
      auto_release_at: null, // Stop the timer
    })
    .eq("id", gigId);

  if (updateError) return NextResponse.json({ error: "Failed to update gig" }, { status: 500 });

  // 5. Add Rating
  await supabase.from("ratings").insert({
      gig_id: gigId,
      rater_id: user.id,
      rated_id: gig.assigned_worker_id,
      score: rating,
      review: review
  });

  // 6. Update Worker Stats (Weighted Rating + 90% Earnings)
  if (gig.assigned_worker_id) {
    const { data: worker } = await supabase
      .from("users")
      .select("rating, rating_count, total_earned")
      .eq("id", gig.assigned_worker_id)
      .single();

    const oldRating = Number(worker?.rating) || 5.0; 
    const oldCount = Number(worker?.rating_count) || 0;
    const currentEarned = Number(worker?.total_earned) || 0;

    // Weighted Average Calculation
    const newCount = oldCount + 1;
    const newRating = ((oldRating * oldCount) + Number(rating)) / newCount;

    await supabase
      .from("users")
      .update({
        rating: newRating,
        rating_count: newCount,
        // Add ONLY the payout amount (90%), not the full price
        total_earned: currentEarned + payoutAmount 
      })
      .eq("id", gig.assigned_worker_id);
  }

  return NextResponse.json({ success: true });
}