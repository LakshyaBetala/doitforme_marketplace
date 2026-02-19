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
                set(name: string, value: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value, ...options }) } catch (error) { }
                },
                remove(name: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value: '', ...options }) } catch (error) { }
                }
            },
        }
    )

    try {
        const { gigId, workerId } = await req.json();

        // 1. Authenticate User
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Authenticate: Ensure only the POSTER can assign
        const { data: gig, error: gigError } = await supabase
            .from("gigs")
            .select("poster_id, listing_type, market_type, status")
            .eq("id", gigId)
            .single();

        if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

        if (gig.poster_id !== user.id) {
            return NextResponse.json({ error: "Only the poster can assign this gig." }, { status: 403 });
        }

        // 3. Validation: Must be MARKET and NOT RENT (Rent requires Escrow/Payment)
        // REQUEST types are P2P. SELL types are P2P.
        // HUSTLE types usually require payment, but if it's a direct assign for 0? 
        // Spec says: "P2P 'Instant Buy' Fails... used for zero-fee P2P meetups"
        // Usually only MARKET (Sell/Request) is P2P zero-fee on platform.

        if (gig.listing_type !== 'MARKET' || gig.market_type === 'RENT') {
            return NextResponse.json({ error: "This gig type requires secure payment processing." }, { status: 400 });
        }

        if (gig.status !== 'open') {
            return NextResponse.json({ error: "Gig is not open for assignment." }, { status: 400 });
        }

        // 4. Update Gig Status
        const { error: updateError } = await supabase
            .from("gigs")
            .update({
                status: 'assigned',
                assigned_worker_id: workerId
            })
            .eq("id", gigId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("P2P Buy Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
