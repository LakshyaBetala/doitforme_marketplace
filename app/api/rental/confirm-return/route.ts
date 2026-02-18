import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { gigId, deductionAmount, lateDays, reviewText } = await req.json();

        // 1. Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 2. Fetch Gig & Escrow
        const { data: gig, error: gigError } = await supabase
            .from("gigs")
            .select(`
        *,
        escrow:escrow!gig_id(*) // Use relationship alias if defined, or assume direct join
      `)
            .eq("id", gigId)
            .single();

        if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

        // Verify Owner
        if (gig.poster_id !== user.id) {
            return NextResponse.json({ error: "Only owner can confirm return" }, { status: 403 });
        }

        if (gig.market_type !== 'RENT') {
            return NextResponse.json({ error: "Not a rental gig" }, { status: 400 });
        }

        // 3. Calculate Deductions & Splits
        // Escrow amount held is the SECURITY DEPOSIT (Price was released on pickup)
        // NOTE: In our content we said "Price was released on pickup". 
        // We need to verify if the escrow record currently holds just the deposit or full amount.
        // Based on Phase 2 plan: "Release ONLY price to Poster. Keep security_deposit in Escrow".
        // So escrow.amount_held SHOULD be the Security Deposit.

        const escrowRecord = gig.escrow?.[0] || gig.escrow; // Depends on relation mapping
        if (!escrowRecord) return NextResponse.json({ error: "No escrow record found" }, { status: 404 });

        const depositHeld = Number(escrowRecord.amount_held);
        const dailyRate = Number(gig.price); // Price is per day for rentals usually

        // Calculate Late Fees
        // totalDeduction = deductionAmount + (lateDays * gig.price)
        const lateFee = Number(lateDays || 0) * dailyRate;
        const damageDeduction = Number(deductionAmount || 0);

        const totalDeduction = lateFee + damageDeduction;

        // Validate Deduction (Can't exceed deposit) - Wait, damage CAN exceed deposit in theory but we can only deduct up to deposit.
        // The user prompt says "renterRefund = escrow.amount_held - totalDeduction".
        // We should cap totalDeduction at depositHeld.

        const actualDeduction = Math.min(totalDeduction, depositHeld);
        const renterRefund = depositHeld - actualDeduction;

        // 4. Perform Updates (Transaction)
        // We update Payout Queue for both parties

        // A. Owner Payout (Deductions)
        if (actualDeduction > 0) {
            const { error: ownerError } = await supabase.from("payout_queue").insert({
                worker_id: gig.poster_id, // Owner gets the deduction
                gig_id: gigId,
                amount: actualDeduction,
                status: "PENDING",
                notes: `Rental Deduction: Late(${lateDays}d) + Damage(${damageDeduction})`
            });
            if (ownerError) throw ownerError;
        }

        // B. Renter Payout (Refund)
        if (renterRefund > 0) {
            const { error: renterError } = await supabase.from("payout_queue").insert({
                worker_id: gig.assigned_worker_id, // Renter gets the rest
                gig_id: gigId,
                amount: renterRefund,
                status: "PENDING",
                notes: "Security Deposit Refund"
            });
            if (renterError) throw renterError;
        }

        // C. Update Escrow Status -> RELEASED
        const { error: escrowUpdateError } = await supabase
            .from("escrow")
            .update({ status: "RELEASED", amount_held: 0 })
            .eq("id", escrowRecord.id);

        if (escrowUpdateError) throw escrowUpdateError;

        // D. Update Gig Status -> completed
        const { error: gigUpdateError } = await supabase
            .from("gigs")
            .update({ status: "completed", updated_at: new Date().toISOString() })
            .eq("id", gigId);

        if (gigUpdateError) throw gigUpdateError;

        // E. Add Review if provided (Optional but good UX)
        // We can skip or add a simplified review record here.

        return NextResponse.json({
            success: true,
            deduction: actualDeduction,
            refund: renterRefund
        });

    } catch (error: any) {
        console.error("Rental Return Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
