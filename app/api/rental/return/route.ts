import { createClient } from '@supabase/supabase-js';
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

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        const { gigId } = await req.json();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (!gigId) return NextResponse.json({ error: "Missing gigId" }, { status: 400 });

        const { data: gig, error: fetchError } = await supabaseAdmin
            .from("gigs")
            .select("assigned_worker_id, status, market_type")
            .eq("id", gigId)
            .single();

        if (fetchError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

        if (gig.assigned_worker_id !== user.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        if (gig.market_type !== 'RENT') {
            return NextResponse.json({ error: "Not a rental gig" }, { status: 400 });
        }

        const { error: updateError } = await supabaseAdmin
            .from("gigs")
            .update({
                status: "delivered", // Reusing 'delivered' status to mean "Returned"
                delivered_at: new Date().toISOString(),
            })
            .eq("id", gigId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
