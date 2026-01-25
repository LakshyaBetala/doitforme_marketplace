import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const cookieStore = await cookies();

  // 1. Standard Client (To verify User Auth)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch (e) {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch (e) {} },
      },
    }
  );

  // 2. Admin Client (To bypass RLS for status updates)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { gigId, deliveryLink } = await req.json();

    // 3. Verify Authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!gigId || !deliveryLink) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 4. Validate Gig & Worker Identity
    const { data: gig, error: fetchError } = await supabaseAdmin
        .from("gigs")
        .select("assigned_worker_id, status")
        .eq("id", gigId)
        .single();

    if (fetchError || !gig) {
        return NextResponse.json({ error: "Gig not found" }, { status: 404 });
    }

    // Security Check: Is this user the assigned worker?
    if (gig.assigned_worker_id !== user.id) {
        return NextResponse.json({ error: "Unauthorized: You are not the assigned worker." }, { status: 403 });
    }

    // Logic Check: Is the gig active? (Allow 'assigned' or 'open' or 'delivered' for updates)
    const currentStatus = gig.status.toLowerCase();
    if (currentStatus !== 'assigned' && currentStatus !== 'delivered') {
         return NextResponse.json({ error: `Gig is not in progress (Status: ${gig.status})` }, { status: 400 });
    }

    // 5. Calculate 24 Hour Auto-Release Time
    const autoReleaseTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // 6. Perform Update
    const { error: updateError } = await supabaseAdmin
      .from("gigs")
      .update({ 
        status: "delivered",
        delivery_link: deliveryLink,
        delivered_at: new Date().toISOString(),
        auto_release_at: autoReleaseTime,
      })
      .eq("id", gigId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, message: "Work delivered successfully" });

  } catch (error: any) {
    console.error("Delivery Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}