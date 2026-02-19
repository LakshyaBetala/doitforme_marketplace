import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const cookieStore = await cookies()

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

    try {
        const { gigId, offerPitch, offerPrice } = await req.json();

        // 1. Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Fetch Gig to validate
        const { data: gig, error: gigError } = await supabase
            .from("gigs")
            .select("poster_id, status, title, price")
            .eq("id", gigId)
            .single();

        if (gigError || !gig) {
            return NextResponse.json({ error: "Gig not found" }, { status: 404 });
        }

        if (gig.poster_id === user.id) {
            return NextResponse.json({ error: "You cannot make an offer on your own gig." }, { status: 400 });
        }

        if (gig.status !== 'open') {
            // In V6, maybe we allow queuing offers? For now, stick to open.
            return NextResponse.json({ error: "This item is no longer available." }, { status: 400 });
        }

        // 3. Create Application (Offer)
        const { error: appError } = await supabase.from("applications").upsert({
            gig_id: gigId,
            worker_id: user.id,
            status: 'pending',
            pitch: offerPitch || "I'm interested in this item!",
            negotiated_price: offerPrice || null // Use offered price
        }, { onConflict: 'gig_id, worker_id' });

        if (appError) throw appError;

        // 4. Send Initial Message to Poster
        // If offerPrice matches gig price (or not provided) -> Regular Interest Message
        // If offerPrice is different -> Offer Message
        const isOffer = offerPrice && Number(offerPrice) > 0;
        const contentType = isOffer ? 'offer' : 'text';
        const contentText = isOffer ? '' : (offerPitch || "I'm interested in this item!");

        const { error: msgError } = await supabase.from("messages").insert({
            gig_id: gigId,
            sender_id: user.id,
            receiver_id: gig.poster_id,
            content: contentText,
            message_type: contentType,
            offer_amount: isOffer ? Number(offerPrice) : null,
            is_pre_agreement: true
        });

        if (msgError) {
            console.error("Failed to send initial message:", msgError);
            // Don't fail the request, as the application was created
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Apply Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
