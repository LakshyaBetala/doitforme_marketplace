import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
    try {
        const { gigId, price } = await req.json();

        if (!gigId || !price) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const supabase = await supabaseServer();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 1. Verify Ownership (Only Poster can accept an offer)
        const { data: gig, error: gigError } = await supabase
            .from('gigs')
            .select('poster_id')
            .eq('id', gigId)
            .single();

        if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

        if (gig.poster_id !== user.id) {
            return NextResponse.json({ error: "Only the poster can accept offers." }, { status: 403 });
        }

        // 2. Update Gig with Negotiated Price
        const { error: updateError } = await supabase
            .from('gigs')
            .update({
                negotiated_price: price,
                // Optional: Could update 'price' too if we want it to be the new source of truth for everyone
                // But negotiated_price is safer to preserve original listing price
                price: price // Actually, for the payment flow to work easily, updating price is best, but let's keep track
            })
            .eq('id', gigId);

        if (updateError) throw updateError;

        // 3. System Message (Optional) - "Offer Accepted"
        // We could insert a system message into the chat here

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Update Price Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
