import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  try {
    const { gigId, workerId, applicationId } = await req.json();

    // 1. Authenticate User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please log in to hire a worker." }, { status: 401 });
    }

    // 2. SECURITY: Fetch Gig and Check Ownership
    const { data: gig, error: gigError } = await supabase
      .from("gigs")
      .select("poster_id, title")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) {
      return NextResponse.json({ error: "Gig not found or invalid" }, { status: 404 });
    }

    if (gig.poster_id !== user.id) {
      return NextResponse.json({ error: "You do not have permission to hire for this task." }, { status: 403 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Update Gig and Application
    const { error: updateGigError } = await supabaseAdmin.from('gigs').update({
      assigned_worker_id: workerId,
      status: 'assigned',
      payment_gateway: 'DIRECT' // Marking as DIRECT connect
    }).eq('id', gigId);

    if (updateGigError) throw updateGigError;

    const { error: updateAppError } = await supabaseAdmin.from('applications').update({
      status: 'accepted'
    }).eq('id', applicationId);

    if (updateAppError) throw updateAppError;

    // 4. Send Telegram Notification
    try {
      const { sendTelegramAlert } = await import('@/lib/telegram');
      const { data: worker } = await supabaseAdmin
        .from('users')
        .select('telegram_chat_id')
        .eq('id', workerId)
        .single();

      if (worker?.telegram_chat_id) {
        await sendTelegramAlert(
          worker.telegram_chat_id,
          `🎉 <b>You're Hired!</b>\nYou have been directly hired for <i>${gig.title}</i>.\nThe client will contact you to coordinate the task and payment.\n<a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://doitforme.in'}/gig/${gigId}">View Task details</a>`
        );
      }
    } catch (e) {
      console.error('Telegram notification failed:', e);
    }

    return NextResponse.json({ success: true, message: "Worker successfully hired directly" });

  } catch (error: any) {
    console.error("Direct Hire Error:", error);
    const safeErrorMsg = error?.message?.includes('relation') || error?.message?.includes('syntax') 
        ? "A system error occurred. Our team has been notified." 
        : (error?.message || "Failed to finalize direct hire.");
    return NextResponse.json({ error: safeErrorMsg }, { status: 500 });
  }
}
