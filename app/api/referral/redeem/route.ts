import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Redeem points — highlight a gig or use as platform credit
export async function POST(req: Request) {
    try {
        const { userId, type, amount, gigId } = await req.json();

        if (!userId || !type || !amount) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Check user's available (non-expired, non-redeemed) points
        const now = new Date().toISOString();

        const { data: earnedPoints } = await supabase
            .from("points_transactions")
            .select("id, amount, expires_at")
            .eq("user_id", userId)
            .eq("type", "EARN")
            .eq("redeemed", false)
            .gt("expires_at", now)
            .order("expires_at", { ascending: true }); // Use oldest points first

        const availableBalance = earnedPoints?.reduce((sum, pt) => sum + pt.amount, 0) || 0;

        if (availableBalance < amount) {
            return NextResponse.json({
                error: `Insufficient points. You have ${availableBalance} RP available.`,
                available: availableBalance
            }, { status: 400 });
        }

        // 2. Handle redemption type
        if (type === "HIGHLIGHT_GIG") {
            if (!gigId) {
                return NextResponse.json({ error: "gigId required for highlighting" }, { status: 400 });
            }

            if (amount < 20) {
                return NextResponse.json({ error: "Highlighting costs 20 RP" }, { status: 400 });
            }

            // Highlight the gig for 24 hours
            const highlightExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const { error: gigErr } = await supabase
                .from("gigs")
                .update({
                    is_highlighted: true,
                    highlight_expires_at: highlightExpires
                })
                .eq("id", gigId)
                .eq("poster_id", userId); // Make sure they own the gig

            if (gigErr) {
                return NextResponse.json({ error: "Failed to highlight gig" }, { status: 500 });
            }
        }

        // 3. Mark earned points as redeemed (FIFO - oldest first)
        let remaining = amount;
        for (const pt of (earnedPoints || [])) {
            if (remaining <= 0) break;

            if (pt.amount <= remaining) {
                // Fully consume this transaction
                await supabase
                    .from("points_transactions")
                    .update({ redeemed: true })
                    .eq("id", pt.id);
                remaining -= pt.amount;
            } else {
                // Partially consume — update amount and create a new smaller record
                await supabase
                    .from("points_transactions")
                    .update({ amount: pt.amount - remaining })
                    .eq("id", pt.id);
                remaining = 0;
            }
        }

        // 4. Record the spend transaction
        await supabase.from("points_transactions").insert({
            user_id: userId,
            amount: -amount,
            type: "SPEND",
            reason: type === "HIGHLIGHT_GIG" ? `Highlighted gig for 24h` : "Platform credit applied",
            reference_id: gigId || null,
        });

        // 5. Update user's total balance
        await supabase.rpc("increment_points", { uid: userId, pts: -amount });

        return NextResponse.json({
            success: true,
            message: type === "HIGHLIGHT_GIG"
                ? "Gig highlighted for 24 hours!"
                : `${amount} RP applied as credit.`,
            newBalance: availableBalance - amount
        });

    } catch (err: any) {
        console.error("Redeem error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
