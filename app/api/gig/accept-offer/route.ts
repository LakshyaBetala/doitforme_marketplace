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
        const { gigId, workerId, price } = await req.json();

        // 1. Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 2. Validate Gig Ownership
        const { data: gig, error: gigError } = await supabase
            .from('gigs')
            .select('poster_id, status')
            .eq('id', gigId)
            .single();

        if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });
        if (gig.poster_id !== user.id) return NextResponse.json({ error: "Only the poster can accept offers" }, { status: 403 });

        // 3. Update Application Price
        const { error: updateError } = await supabase
            .from('applications')
            .update({ negotiated_price: price })
            .eq('gig_id', gigId)
            .eq('worker_id', workerId);

        if (updateError) throw updateError;

        // 4. Send System Message
        // Determine receiver (the worker)
        const { error: msgError } = await supabase.from('messages').insert({
            gig_id: gigId,
            sender_id: user.id, // Comes from poster
            receiver_id: workerId,
            content: `Accepted offer of ₹${price}. Please proceed to checkout when ready.`,
            type: 'text', // System message is just text for now
            is_pre_agreement: true
        });

        if (msgError) console.error("Failed to send system message:", msgError);

        return NextResponse.json({ success: true, message: "Offer accepted successfully" });

    } catch (err: any) {
        console.error("Accept Offer Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
