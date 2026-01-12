import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { get(n){return cookieStore.get(n)?.value}, set(n,v,o){}, remove(n,o){} }
  })

  try {
    const { gigId, rating, review } = await req.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. Fetch Gig
    const { data: gig } = await supabase
      .from("gigs")
      .select("*, users!assigned_worker_id(id, upi_id, email)") 
      .eq("id", gigId)
      .single();

    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });
    if (gig.poster_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    if (gig.status !== 'DELIVERED') return NextResponse.json({ error: "Work must be delivered first" }, { status: 400 });

    const worker = gig.users;

    // 2. MANUAL PAYOUT LOGIC
    // We calculate the amount you need to transfer manually
    const PLATFORM_FEE_PERCENT = 0.10; 
    const payoutAmount = gig.price * (1 - PLATFORM_FEE_PERCENT);

    // LOG THIS: You will see this in your Vercel/Server logs
    console.log(`[ACTION REQUIRED] Manual Payout of ₹${payoutAmount} needed for UPI: ${worker.upi_id}`);

    // 3. Update Database
    // We set payment_status to 'PAYOUT_PENDING' so you know you haven't paid yet.
    const { error: updateError } = await supabase.from("gigs").update({
        status: 'COMPLETED',
        payment_status: 'PAYOUT_PENDING', 
        auto_release_at: null 
    }).eq("id", gigId);

    if (updateError) throw updateError;

    // 4. Add Rating
    await supabase.from("ratings").insert({
        gig_id: gigId,
        rater_id: user.id,
        rated_id: worker.id,
        score: rating,
        review: review
    });

    // 5. Update Stats
    await supabase.rpc('increment_worker_stats', { 
        worker_id: worker.id, 
        amount: payoutAmount 
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}