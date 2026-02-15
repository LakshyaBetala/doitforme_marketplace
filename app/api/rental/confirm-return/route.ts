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
        // Inputs: Gig ID, deductions? condition?
        const { gigId, deductionAmount = 0, conditionRating, review, rating } = await request.json();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data: gig, error: gigError } = await supabaseAdmin
            .from("gigs")
            .select("poster_id, assigned_worker_id, market_type, security_deposit, title")
            .eq("id", gigId)
            .single();

        if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

        if (gig.poster_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        if (gig.market_type !== 'RENT') return NextResponse.json({ error: "Not a rental" }, { status: 400 });

        const deposit = gig.security_deposit || 0;

        // Validate Deduction
        if (deductionAmount < 0) return NextResponse.json({ error: "Invalid deduction" }, { status: 400 });
        if (deductionAmount > deposit) return NextResponse.json({ error: "Deduction cannot exceed deposit" }, { status: 400 });

        // Fetch Escrow
        const { data: escrowRecord } = await supabaseAdmin
            .from("escrow")
            .select("amount_held")
            .eq("gig_id", gigId)
            .single();

        if (!escrowRecord) return NextResponse.json({ error: "Escrow record not found" }, { status: 500 });

        const totalHeld = Number(escrowRecord.amount_held);
        const refundAmount = deposit - deductionAmount;
        const payoutAmount = totalHeld - refundAmount; // Rental Fee + Deduction

        // Update Gig
        const { error: updateError } = await supabaseAdmin
            .from("gigs")
            .update({
                status: "completed",
                escrow_status: 'RELEASED',
                payment_status: 'PAYOUT_PENDING',
                auto_release_at: null,
                item_condition: conditionRating // Store condition update if applicable? using item_condition column?
            })
            .eq("id", gigId);

        if (updateError) return NextResponse.json({ error: "Failed to update gig" }, { status: 500 });

        // Update Escrow
        await supabaseAdmin
            .from("escrow")
            .update({
                status: 'RELEASED',
                released_at: new Date().toISOString()
            })
            .eq("gig_id", gigId);

        // Transaction: Payout to Owner (Rental Fee + Deduction)
        if (payoutAmount > 0) {
            await supabaseAdmin.from("transactions").insert({
                gig_id: gigId,
                user_id: user.id, // Owner
                amount: payoutAmount,
                type: "PAYOUT_CREDIT",
                status: "COMPLETED",
                description: `Rental Payout (Fee + Deduction) for ${gig.title}`
            });
        }

        // Transaction: Refund to Renter (Deposit - Deduction)
        if (refundAmount > 0) {
            await supabaseAdmin.from("transactions").insert({
                gig_id: gigId,
                user_id: gig.assigned_worker_id, // Renter
                amount: refundAmount,
                type: "REFUND_CREDIT",
                status: "COMPLETED",
                description: `Security Deposit Refund for ${gig.title}`
            });
        }

        // Rating (Renter reviews Owner? Or Owner reviews Renter?)
        // Usually Owner rates the Renter/Usage.
        if (rating && gig.assigned_worker_id) {
            await supabaseAdmin.from("ratings").insert({
                gig_id: gigId,
                rater_id: user.id,
                rated_id: gig.assigned_worker_id,
                score: rating,
                review: review || `Returned with deduction: ₹${deductionAmount}`
            });

            // Update Worker Stats (Logic reused for brevity, ideally shared)
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

                await supabaseAdmin.from("users").update({
                    rating: newRating,
                    rating_count: newCount,
                    jobs_completed: oldJobs + 1
                }).eq("id", gig.assigned_worker_id);
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
