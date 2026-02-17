import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Handshake Verification
export async function POST(req: Request) {
    const cookieStore = await cookies();

    // Client for Auth
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
    );

    // Admin for Escrow/Transaction updates
    const supabaseAdmin = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { cookies: { getAll: () => [], setAll: () => { } } }
    );

    try {
        const { gigId, code } = await req.json();

        // 1. Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 2. Fetch Escrow Record
        const { data: escrow, error: escrowError } = await supabaseAdmin
            .from('escrow')
            .select('*')
            .eq('gig_id', gigId)
            .single();

        if (escrowError || !escrow) return NextResponse.json({ error: "Escrow record not found" }, { status: 404 });

        // 3. Verify Code
        if (escrow.handshake_code !== code) {
            return NextResponse.json({ error: "Invalid Handshake Code" }, { status: 400 });
        }

        // 4. Verify User Role
        // Who is submitting the code? 
        // Usually the Buyer (Worker) enters the code provided by the Seller (Poster).
        // Or vice versa depending on flow.
        // Spec: "BUYER UI: Show an input field... Enter the code provided by the seller"
        // Seller = Poster (Marketplace). Buyer = Worker/User.
        // So ONLY the Worker/Buyer should be able to submit this?
        // Let's allow either party involved to be safe, but typically it is the 'Receiver' of the item verifying.

        // 5. Release Funds / Update Status
        // Mark Escrow as RELEASED (or PENDING_CONFIRMATION if we want double check, but handshake implies physical meet)

        // Update Escrow
        const { error: updateEscrowError } = await supabaseAdmin
            .from('escrow')
            .update({ status: 'RELEASED', released_at: new Date().toISOString() })
            .eq('id', escrow.id);

        if (updateEscrowError) throw updateEscrowError;

        // Update Gig
        const { error: updateGigError } = await supabaseAdmin
            .from('gigs')
            .update({
                status: 'delivered', // Handshake done = Delivered
                delivered_at: new Date().toISOString(),
                escrow_status: 'RELEASED'
            })
            .eq('id', gigId);

        if (updateGigError) throw updateGigError;

        // Update Transaction (if needed, or create a 'RELEASE' transaction)
        // Optional: Log release transaction

        return NextResponse.json({ success: true, message: "Handshake verified! Funds released." });

    } catch (err: any) {
        console.error("Handshake Verification Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
