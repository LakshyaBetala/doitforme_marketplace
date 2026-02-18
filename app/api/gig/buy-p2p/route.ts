import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const { gigId, workerId } = await req.json();

        // 1. Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (workerId !== user.id) {
            return NextResponse.json({ error: "User mismatch" }, { status: 403 });
        }

        // 2. Fetch Gig to Verify Type
        const { data: gig, error: gigError } = await supabase
            .from("gigs")
            .select("*")
            .eq("id", gigId)
            .single();

        if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

        // 3. Verify P2P Eligibility
        if (gig.listing_type !== 'MARKET' || gig.market_type === 'RENT') {
            return NextResponse.json({ error: "This gig requires escrow payment." }, { status: 400 });
        }

        if (gig.status !== 'open') {
            return NextResponse.json({ error: "Gig is no longer available." }, { status: 400 });
        }

        // 4. Assign Worker & Update Status
        // We are trusting the user's intent here for P2P.
        // In a stricter system, we might create an application and auto-accept it.
        // For now, direct update.
        const { error: updateError } = await supabase
            .from("gigs")
            .update({
                status: "assigned",
                assigned_worker_id: workerId,
                updated_at: new Date().toISOString()
            })
            .eq("id", gigId);

        if (updateError) throw updateError;

        // 5. Check if application exists, if so update it, else create one?
        // Not strictly necessary for functionality but good for record keeping.
        // We'll skip for "Frictionless" speed, as the gig status is the source of truth.

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("P2P Buy Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
