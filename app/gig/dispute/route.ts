import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { get(n){return cookieStore.get(n)?.value}, set(n,v,o){}, remove(n,o){} }
  })

  try {
    const { gigId, reason } = await req.json();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (reason.length < 50) return NextResponse.json({ error: "Reason too short (min 50 chars)" }, { status: 400 });

    // 1. Verify Ownership & Status
    const { data: gig } = await supabase.from("gigs").select("*").eq("id", gigId).single();
    
    if (gig.poster_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    
    // Can only dispute if delivered (funds are held)
    if (gig.status !== 'DELIVERED') return NextResponse.json({ error: "Work must be delivered to dispute" }, { status: 400 });

    // 2. Create Dispute Record
    const { error: disputeError } = await supabase.from("disputes").insert({
        gig_id: gigId,
        raised_by: user.id,
        reason: reason,
        status: 'OPEN'
    });

    if (disputeError) throw disputeError;

    // 3. Update Gig Status -> FREEZE FUNDS
    await supabase.from("gigs").update({
        status: 'DISPUTED',
        dispute_reason: reason,
        payment_status: 'DISPUTE_HELD' // Distinct status for Admin
    }).eq("id", gigId);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}