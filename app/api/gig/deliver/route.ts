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
    { cookies: { getAll: () => cookieStore.getAll() } }
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

    // 5. Calculate 12-hour auto-release time (poster gets 12h to review)
    const autoReleaseTime = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

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

    // Notify the poster — they have 12h to review
    try {
      const { data: full } = await supabaseAdmin
        .from('gigs')
        .select('title, poster_id')
        .eq('id', gigId)
        .single();

      if (full?.poster_id) {
        const { data: poster } = await supabaseAdmin
          .from('users')
          .select('email, name, telegram_chat_id')
          .eq('id', full.poster_id)
          .single();

        if (poster?.telegram_chat_id) {
          const { sendTelegramAlert } = await import('@/lib/telegram');
          await sendTelegramAlert(
            poster.telegram_chat_id,
            `📦 <b>Work delivered</b>\n<i>${full.title}</i> is ready for review. Escrow auto-releases in 12h.\n<a href="https://doitforme.in/gig/${gigId}">Review now</a>`
          );
        }
        if (poster?.email) {
          const { sendEmail } = await import('@/lib/email');
          await sendEmail('work_delivered', {
            to: poster.email,
            recipientName: poster.name,
            gigTitle: full.title,
            gigId,
          });
        }
      }
    } catch (e) {
      console.error("Notification (deliver) failed:", e);
    }

    return NextResponse.json({ success: true, message: "Work delivered successfully" });

  } catch (error: any) {
    console.error("Delivery Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}