import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const cookieStore = await cookies()

    // 1. Auth Client (Poster Context)
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

    // 2. Admin Client (System Actions: Gig Update, Escrow, Chat)
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
    )

    try {
        let { applicationId, gigId, workerId, price } = await req.json();

        // AUTH CHECK
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // If coming from CHAT, we might only have gigId + workerId (and price)
        if (!applicationId && gigId && workerId) {
            const { data: appByGig } = await supabase
                .from("applications")
                .select("id")
                .eq("gig_id", gigId)
                .eq("worker_id", workerId)
                .single();

            if (appByGig) {
                applicationId = appByGig.id;
                // If a price was negotiated in chat, update it now
                if (price) {
                    await supabaseAdmin
                        .from("applications")
                        .update({ negotiated_price: price })
                        .eq("id", applicationId);
                }
            } else {
                // Should we create one? For P2P, maybe? Or error.
                // Let's assume application exists if we are accepting.
                return NextResponse.json({ error: "No application found for this user." }, { status: 404 });
            }
        }

        // FETCH APPLICATION & GIG
        const { data: application, error: appError } = await supabase
            .from("applications")
            .select("*, gig:gigs(*)")
            .eq("id", applicationId)
            .single();

        if (appError || !application) {
            return NextResponse.json({ error: "Application not found" }, { status: 404 });
        }

        const gig = application.gig;

        // VERIFY OWNERSHIP
        if (gig.poster_id !== user.id) {
            return NextResponse.json({ error: "Only the poster can accept offers." }, { status: 403 });
        }

        if (gig.status !== 'open') {
            return NextResponse.json({ error: "This gig is already assigned or completed." }, { status: 400 });
        }

        const handshakeCode = Math.floor(1000 + Math.random() * 9000).toString();

        // 1. UPDATE APPLICATION -> APPROVED
        const { error: updateAppError } = await supabaseAdmin
            .from("applications")
            .update({ status: 'approved' })
            .eq("id", applicationId);

        if (updateAppError) throw updateAppError;

        // 2. UPDATE GIG -> ASSIGNED
        const gigUpdateData: any = {
            status: 'assigned',
            assigned_worker_id: application.worker_id,
            escrow_status: 'NONE'
        };

        // For SELL type: store handshake_code directly on gig (no escrow payment)
        if (gig.market_type === 'SELL' || gig.market_type === 'REQUEST') {
            gigUpdateData.handshake_code = handshakeCode;
        }

        const { error: updateGigError } = await supabaseAdmin
            .from("gigs")
            .update(gigUpdateData)
            .eq("id", gig.id);

        if (updateGigError) throw updateGigError;

        // 3. CREATE ESCROW RECORD (For Handshake / tracking)
        const escrowInsert: any = {
            gig_id: gig.id,
            worker_id: application.worker_id,
            poster_id: user.id,
            original_amount: application.negotiated_price || gig.price,
            amount_held: 0, // No real money held yet for P2P/Cash
            status: 'HELD',
            escrow_category: 'GIG'
        };

        // For non-SELL types, store handshake in escrow too
        if (gig.market_type !== 'SELL' && gig.market_type !== 'REQUEST') {
            escrowInsert.handshake_code = handshakeCode;
        }

        const { error: escrowError } = await supabaseAdmin.from("escrow").insert(escrowInsert);

        if (escrowError) console.error("Escrow setup warning:", escrowError);

        // --- TELEGRAM NOTIFICATION TO WORKER ---
        try {
            const { data: worker } = await supabaseAdmin
                .from('users')
                .select('telegram_chat_id')
                .eq('id', application.worker_id)
                .single();

            if (worker?.telegram_chat_id) {
                const { sendTelegramAlert } = await import('@/lib/telegram');
                await sendTelegramAlert(
                    worker.telegram_chat_id,
                    `🎉 <b>Offer Accepted!</b>\nYou have been chosen for <i>${gig.title}</i>.\n<a href="https://doitforme.in/gig/${gig.id}">View Details</a>`
                );
            }
        } catch (e) {
            console.error("Telegram notification failed:", e);
        }
        // ---------------------------------------

        // --- PHONE/WHATSAPP AUTO-EXCHANGE (System Message) ---
        try {
            const [posterData, workerData] = await Promise.all([
                supabaseAdmin.from('users').select('name, phone').eq('id', user.id).single(),
                supabaseAdmin.from('users').select('name, phone').eq('id', application.worker_id).single(),
            ]);

            const posterPhone = posterData.data?.phone || 'Not provided';
            const workerPhone = workerData.data?.phone || 'Not provided';
            const posterName = posterData.data?.name || 'Poster';
            const workerName = workerData.data?.name || 'Hustler';

            await supabaseAdmin.from('messages').insert({
                gig_id: gig.id,
                sender_id: user.id,
                receiver_id: application.worker_id,
                content: `🔓 Connection Established!\n\n${posterName}: ${posterPhone}\n${workerName}: ${workerPhone}\n\nYou can now contact each other directly via WhatsApp or Phone.`,
                message_type: 'system',
                is_pre_agreement: false
            });
        } catch (e) {
            console.error("Phone exchange system message failed:", e);
        }
        // -----------------------------------------------

        return NextResponse.json({ success: true, gigId: gig.id, workerId: application.worker_id });

    } catch (error: any) {
        console.error("Accept Offer Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
