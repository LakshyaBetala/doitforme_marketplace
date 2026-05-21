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
        const { gigId, offerPitch, offerPrice, paymentPreference } = await req.json();

        // 1. Auth Check
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Please log in to apply for this task." }, { status: 401 });
        }

        // 2. Fetch Gig to validate
        const { data: gig, error: gigError } = await supabase
            .from("gigs")
            .select("poster_id, status, title, price, listing_type")
            .eq("id", gigId)
            .single();

        if (gigError || !gig) {
            return NextResponse.json({ error: "Gig not found" }, { status: 404 });
        }

        if (gig.poster_id === user.id) {
            return NextResponse.json({ error: "You cannot make an offer on your own gig." }, { status: 400 });
        }

        if (gig.status !== 'open') {
            return NextResponse.json({ error: "This item is no longer available." }, { status: 400 });
        }

        // 2.5 Check Applicant Limit for Free Accounts
        const { count: appCount } = await supabase
            .from("applications")
            .select("*", { count: 'exact', head: true })
            .eq("gig_id", gigId);

        if (appCount !== null && appCount >= 10) {
            // Pro companies have unlimited applicants; free tier caps at 10.
            const { data: posterCompany } = await supabase
                .from("companies")
                .select("pro_until")
                .eq("user_id", gig.poster_id)
                .single();

            const isPro = posterCompany?.pro_until && new Date(posterCompany.pro_until) > new Date();
            if (!isPro) {
                return NextResponse.json({ error: "This task has reached its maximum limit of 10 applicants. Poster is on the free tier." }, { status: 403 });
            }
        }

        const isJob = gig.listing_type === 'HUSTLE' || gig.listing_type === 'COMPANY_TASK';
        const defaultPitch = isJob ? "I am interested in this task and would like to apply." : "I'm interested in this item!";

        // 3. Create Application (Offer)
        const { error: appError } = await supabase.from("applications").upsert({
            gig_id: gigId,
            worker_id: user.id,
            status: 'pending',
            pitch: offerPitch || defaultPitch,
            negotiated_price: offerPrice || null,
            payment_preference: paymentPreference || "DIRECT"
        }, { onConflict: 'gig_id, worker_id' });

        if (appError) throw appError;

        // 4. Send Initial Message to Poster
        // If offerPrice matches gig price (or not provided) -> Regular Interest Message
        // If offerPrice is different -> Offer Message
        const isOffer = offerPrice && Number(offerPrice) > 0;
        const contentType = isOffer ? 'offer' : 'text';
        const contentText = isOffer ? '' : (offerPitch || defaultPitch);

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

        // --- TELEGRAM + EMAIL NOTIFICATIONS ---
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            const [{ data: poster }, { data: applicant }] = await Promise.all([
                supabaseAdmin.from('users').select('telegram_chat_id, email, name').eq('id', gig.poster_id).single(),
                supabaseAdmin.from('users').select('email, name').eq('id', user.id).single(),
            ]);

            const { sendTelegramAlert } = await import('@/lib/telegram');
            const { sendEmail } = await import('@/lib/email');

            if (poster?.telegram_chat_id) {
                await sendTelegramAlert(
                    poster.telegram_chat_id,
                    `📄 <b>New Offer / Application!</b>\nSomeone just made an offer on your listing: <i>${gig.title}</i>.\n<a href="https://doitforme.in/company/task/${gigId}">Review Offer</a>`
                );
            }

            if (poster?.email) {
                await sendEmail('new_applicant', {
                    to: poster.email,
                    recipientName: poster.name,
                    gigTitle: gig.title,
                    gigId,
                });
            }
            if (applicant?.email) {
                await sendEmail('applied', {
                    to: applicant.email,
                    recipientName: applicant.name,
                    gigTitle: gig.title,
                    gigId,
                });
            }
        } catch (e) {
            console.error("Notification (apply) failed:", e);
        }
        // --------------------------------------

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Apply Error:", error.message);
        
        let safeErrorMsg = "An unexpected error occurred while processing your application.";
        if (error?.code === '23505') {
            safeErrorMsg = "You have already applied for this task.";
        } else if (error?.message) {
            // Keep specific custom errors if they aren't raw database errors
            safeErrorMsg = error.message.includes('relation') || error.message.includes('syntax') 
                ? "A system error occurred. Our team has been notified." 
                : error.message;
        }

        return NextResponse.json({ error: safeErrorMsg }, { status: 500 });
    }
}
