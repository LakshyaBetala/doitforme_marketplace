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
        const { applicationId } = await req.json();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // VERIFY OWNERSHIP
        const { data: application, error: appError } = await supabase
            .from("applications")
            .select("*, gig:gigs(poster_id)")
            .eq("id", applicationId)
            .single();

        if (appError || !application) throw appError;

        if (application.gig.poster_id !== user.id) {
            return NextResponse.json({ error: "Only the poster can reject offers." }, { status: 403 });
        }

        const { error: rejectError } = await supabase
            .from("applications")
            .update({ status: 'rejected' })
            .eq("id", applicationId);

        if (rejectError) throw rejectError;

        // Notify applicant via email
        try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabaseAdmin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            const { data: app } = await supabaseAdmin
                .from('applications')
                .select('worker_id, gig:gigs(title)')
                .eq('id', applicationId)
                .single();

            if (app?.worker_id) {
                const { data: applicant } = await supabaseAdmin
                    .from('users')
                    .select('email, name')
                    .eq('id', app.worker_id)
                    .single();

                if (applicant?.email) {
                    const { sendEmail } = await import('@/lib/email');
                    const gigTitle = (app as any).gig?.title || null;
                    await sendEmail('application_rejected', {
                        to: applicant.email,
                        recipientName: applicant.name,
                        gigTitle,
                    });
                }
            }
        } catch (e) {
            console.error("Notification (reject-offer) failed:", e);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Reject Offer Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
