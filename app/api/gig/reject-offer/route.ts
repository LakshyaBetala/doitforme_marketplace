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

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Reject Offer Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
