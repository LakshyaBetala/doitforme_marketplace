import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const cookieStore = await cookies()

    // 1. Standard client for Auth (User Context)
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                    }
                },
            },
        }
    )

    // 2. Admin client (Service Role) for bypassing RLS
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                persistSession: false,
            }
        }
    )

    try {
        const { gigId, workerId } = await req.json();

        // AUTH CHECK
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // FETCH GIG
        const { data: gig, error: gigError } = await supabaseAdmin
            .from("gigs")
            .select("status, poster_id")
            .eq("id", gigId)
            .single();

        if (gigError || !gig) {
            return NextResponse.json({ error: "Gig not found" }, { status: 404 });
        }

        if (gig.status !== 'open') {
            return NextResponse.json({ error: "Item is already sold or assigned." }, { status: 400 });
        }

        // PREVENT SELF-BUY
        if (gig.poster_id === user.id) {
            return NextResponse.json({ error: "You cannot buy your own listing." }, { status: 400 });
        }

        const handshakeCode = Math.floor(1000 + Math.random() * 9000).toString();

        // UPDATE GIG STATUS (ADMIN)
        const { error: updateError } = await supabaseAdmin.from("gigs").update({
            status: 'assigned',
            assigned_worker_id: workerId,
            escrow_status: 'HELD'
        }).eq("id", gigId);

        if (updateError) throw updateError;

        // CREATE ESCROW RECORD (ADMIN)
        const { error: escrowError } = await supabaseAdmin.from("escrow").insert({
            gig_id: gigId,
            worker_id: workerId,
            poster_id: gig.poster_id,
            original_amount: 0,
            amount_held: 0,
            platform_fee: 0,
            gateway_fee: 0,
            release_date: new Date().toISOString(),
            status: 'HELD',
            handshake_code: handshakeCode,
            escrow_category: 'PROJECT'
        });

        if (escrowError) {
            console.error("Escrow creation failed:", escrowError);
            throw new Error("Failed to initialize secure handover.");
        }

        // CREATE APPLICATION RECORD (ADMIN - using 'pitch')
        const { error: appError } = await supabaseAdmin.from("applications").upsert({
            gig_id: gigId,
            worker_id: workerId,
            status: 'approved',
            pitch: 'Instant Buy (P2P)'
        }, { onConflict: 'gig_id, worker_id' });

        if (appError) console.error("Auto-application error:", appError);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Buy P2P Route Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
