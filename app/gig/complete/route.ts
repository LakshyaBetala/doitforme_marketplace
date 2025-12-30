import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
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

  try {
    const { gigId, rating, review } = await req.json();
    
    // 1. Authenticate Poster
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Fetch Gig Details
    const { data: gig } = await supabase.from("gigs").select("*").eq("id", gigId).single();
    if (!gig) throw new Error("Gig not found");
    if (gig.poster_id !== user.id) throw new Error("Unauthorized");

    const workerId = gig.assigned_worker_id;

    // 3. TRANSFER FUNDS (Wallet Logic)
    // Fetch Worker Wallet
    let { data: workerWallet } = await supabase.from("wallets").select("*").eq("user_id", workerId).single();
    
    // Create if missing
    if (!workerWallet) {
      const { data: newW } = await supabase.from("wallets").insert({ user_id: workerId, balance: 0 }).select().single();
      workerWallet = newW;
    }

    // Update Balance
    await supabase
      .from("wallets")
      .update({ balance: (workerWallet.balance || 0) + gig.price })
      .eq("user_id", workerId);

    // 4. INSERT RATING
    await supabase.from("ratings").insert({
      rater_id: user.id,
      rated_id: workerId,
      gig_id: gigId,
      score: rating,
      review: review
    });

    // 5. UPDATE GIG STATUS
    await supabase
      .from("gigs")
      .update({ status: "COMPLETED" })
      .eq("id", gigId);

    // --- 6. NEW: RECALCULATE WORKER STATS ---
    
    // A. Get new average rating
    const { data: allRatings } = await supabase
      .from("ratings")
      .select("score")
      .eq("rated_id", workerId);

    const totalScore = allRatings?.reduce((acc, curr) => acc + curr.score, 0) || 0;
    const count = allRatings?.length || 0;
    const newAverage = count > 0 ? (totalScore / count) : 0;

    // B. Get total jobs completed
    const { count: jobsCount } = await supabase
      .from("gigs")
      .select("*", { count: 'exact', head: true })
      .eq("assigned_worker_id", workerId)
      .eq("status", "COMPLETED");

    // C. Update User Profile
    await supabase
      .from("users")
      .update({
        rating: newAverage,
        rating_count: count,
        jobs_completed: jobsCount || 0
      })
      .eq("id", workerId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Completion Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}