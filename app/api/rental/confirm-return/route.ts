
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const cookieStore = await cookies();

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

    try {
        const { gigId, deductionAmount } = await req.json(); // deductionAmount is how much to keep from deposit

        // 1. Auth Check (Must be the Owner/Poster)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 2. Fetch Gig & Escrow Details
        const { data: gig, error: gigError } = await supabase
            .from('gigs')
            .select('*')
            .eq('id', gigId)
            .single();

        if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });
        if (gig.poster_id !== user.id) return NextResponse.json({ error: "Only the owner can confirm return" }, { status: 403 });
        if (gig.listing_type !== 'MARKET' || gig.market_type !== 'RENT') return NextResponse.json({ error: "Not a rental gig" }, { status: 400 });

        const { data: escrow, error: escrowError } = await supabase
            .from('escrow')
            .select('*')
            .eq('gig_id', gigId)
            .single();

        if (escrowError || !escrow) return NextResponse.json({ error: "Escrow record not found" }, { status: 404 });

        // 3. Calculate Releases
        // Escrow usually holds: Price + Deposit + Fees (Fees already taken by Platform, so Escrow holds Price + Deposit)
        // Actually, `amount_held` should be the liquid amount (Price + Deposit).
        // Let's assume `amount_held` is what is available to split.
        // If not, we rely on `original_amount` (Price) and `amount_held` (Deposit)? 
        // In `create-order`: 
        // `original_amount` = price
        // `amount_held` = deposit
        // `amount` = total (including fees)
        // Payout Logic: 
        // Owner gets: Price (Rental Fee) + Deduction.
        // Borrower gets: Deposit - Deduction.

        // Let's verify numbers.
        const price = gig.price;
        const deposit = gig.security_deposit || 0;
        const deduction = Number(deductionAmount) || 0;

        if (deduction > deposit) return NextResponse.json({ error: "Deduction cannot exceed deposit" }, { status: 400 });

        const releaseToOwner = price + deduction;
        const releaseToBorrower = deposit - deduction;

        // 4. Update Database
        // Release Funds (Simulated by updating Escrow status and logging transaction)
        // Update Gig to 'completed'

        const { error: updateError } = await supabase
            .from('gigs')
            .update({ status: 'completed' })
            .eq('id', gigId);

        if (updateError) throw updateError;

        const { error: escrowUpdateError } = await supabase
            .from('escrow')
            .update({
                status: 'RELEASED',
                release_date: new Date().toISOString(),
                payout_breakdown: {
                    owner_id: gig.poster_id,
                    owner_amount: releaseToOwner,
                    borrower_id: gig.assigned_worker_id,
                    borrower_amount: releaseToBorrower,
                    deduction: deduction
                }
            })
            .eq('gig_id', gigId);

        if (escrowUpdateError) throw escrowUpdateError;

        // Log Payout Transactions
        const { error: transError } = await supabase.from('transactions').insert([
            {
                gig_id: gigId,
                user_id: gig.poster_id, // Owner
                amount: releaseToOwner,
                type: 'CREDIT',
                status: 'COMPLETED',
                description: `Rental Payout for ${gig.title}`
            },
            {
                gig_id: gigId,
                user_id: gig.assigned_worker_id, // Borrower
                amount: releaseToBorrower,
                type: 'CREDIT',
                status: 'COMPLETED',
                description: `Security Deposit Refund for ${gig.title}`
            }
        ]);

        if (transError) console.error("Transaction Log Error:", transError); // Non-blocking

        return NextResponse.json({ success: true, releaseToOwner, releaseToBorrower });

    } catch (err: any) {
        console.error("Rental Return Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
