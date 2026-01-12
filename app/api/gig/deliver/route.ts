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
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch (e) {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch (e) {} },
      },
    }
  )

  try {
    const { gigId, deliveryLink } = await req.json();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Calculate 24 Hour Auto-Release Time
    const autoReleaseTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Update Gig
    const { error } = await supabase
      .from("gigs")
      .update({ 
        status: "DELIVERED",
        delivery_link: deliveryLink,
        delivered_at: new Date().toISOString(),
        auto_release_at: autoReleaseTime, // <--- START 24H TIMER
        payment_status: 'HELD' // <--- MARK FUNDS AS HELD
      })
      .eq("id", gigId)
      .eq("assigned_worker_id", user.id); 

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}