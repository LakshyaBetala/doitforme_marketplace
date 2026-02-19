import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value },
                set(name: string, value: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value, ...options }) } catch (error) { }
                },
                remove(name: string, options: CookieOptions) {
                    try { cookieStore.set({ name, value: '', ...options }) } catch (error) { }
                }
            },
        }
    )

    try {
        const { gigId, workerId } = await req.json();

        // 1. Authenticate User
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Fetch the gig to ensure it exists and is open
        const { data: gig, error: gigError } = await supabase
            .from("gigs")
            .select("status, poster_id")
            .eq("id", gigId)
            .single();

        if (gigError || !gig) {
            return NextResponse.json({ error: "Gig not found" }, { status: 404 });
        }

        if (gig.status !== 'open') {
            return NextResponse.json({ error: "Item is already sold or assigned." }, { status: 400 });
        }

        // 🚀 THE FIX: Prevent poster from buying their own item
        if (gig.poster_id === user.id) {
            return NextResponse.json({ error: "You cannot buy your own listing." }, { status: 400 });
        }

        // 3. Mark Gig as Assigned (P2P bypasses payment gateway)
        const { error: updateError } = await supabase.from("gigs").update({
            status: 'assigned',
            assigned_worker_id: workerId
        }).eq("id", gigId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Buy P2P Route Error:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
