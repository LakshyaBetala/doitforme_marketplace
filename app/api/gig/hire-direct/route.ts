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
      .select("poster_id, title, max_workers")
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

    // 3. Update Application FIRST
    const { error: updateAppError } = await supabaseAdmin.from('applications').update({
      status: 'accepted'
    }).eq('id', applicationId);

    if (updateAppError) throw updateAppError;

    // 4. Count accepted applications to see if gig is full
    const { count: acceptedCountResponse, error: countError } = await supabaseAdmin
      .from('applications')
      .select('*', { count: 'exact', head: true })
      .eq('gig_id', gigId)
      .eq('status', 'accepted');

    const acceptedCount = acceptedCountResponse || 1;
    const maxWorkers = gig.max_workers || 1;
    const isFull = acceptedCount >= maxWorkers;

    // 5. Update Gig
    const gigUpdatePayload: any = {
      assigned_worker_id: workerId,
      payment_gateway: 'DIRECT' // Marking as DIRECT connect
    };

    if (isFull) {
      gigUpdatePayload.status = 'assigned';
      
      // Reject remaining pending applications
      await supabaseAdmin
        .from('applications')
        .update({ status: 'rejected' })
        .eq('gig_id', gigId)
        .eq('status', 'applied');
    }

    const { error: updateGigError } = await supabaseAdmin.from('gigs').update(gigUpdatePayload).eq('id', gigId);

    if (updateGigError) throw updateGigError;

    // 6. Telegram + email notification to worker
    try {
      const { data: worker } = await supabaseAdmin
        .from('users')
        .select('telegram_chat_id, email, name')
        .eq('id', workerId)
        .single();

      if (worker?.telegram_chat_id) {
        const { sendTelegramAlert } = await import('@/lib/telegram');
        await sendTelegramAlert(
          worker.telegram_chat_id,
          `🎉 <b>You're Hired!</b>\nYou have been directly hired for <i>${gig.title}</i>.\nThe client will contact you to coordinate the task and payment.\n<a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://doitforme.in'}/gig/${gigId}">View Task details</a>`
        );
      }
      if (worker?.email) {
        const { sendEmail } = await import('@/lib/email');
        await sendEmail('hired_direct', {
          to: worker.email,
          recipientName: worker.name,
          gigTitle: gig.title,
          gigId,
        });
      }
    } catch (e) {
      console.error('Notification (hire-direct) failed:', e);
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
