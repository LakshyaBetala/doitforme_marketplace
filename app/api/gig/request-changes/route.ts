import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// "Request changes" — the lightweight revision loop that sits BETWEEN approving
// and disputing. The poster disapproves the submitted work with written feedback;
// the gig goes back to 'assigned', the 24h auto-release timer is cancelled, and
// the worker can revise and resubmit (which restarts the timer). No admin needed.
// (Dispute is the heavier path that freezes escrow for admin review.)

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { gigId, feedback } = await req.json();

    if (!gigId || !feedback || !String(feedback).trim()) {
      return NextResponse.json({ error: 'gigId and feedback are required' }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: gig } = await supabaseAdmin
      .from('gigs')
      .select('poster_id, assigned_worker_id, title, status')
      .eq('id', gigId)
      .single();

    if (!gig) return NextResponse.json({ error: 'Gig not found' }, { status: 404 });

    // Only the poster can request changes.
    if (gig.poster_id !== user.id) {
      return NextResponse.json({ error: 'Only the poster can request changes' }, { status: 403 });
    }

    // Work must currently be submitted (delivered/SUBMITTED).
    if (!['delivered', 'SUBMITTED', 'DELIVERED'].includes(gig.status)) {
      return NextResponse.json({
        error: `Changes can only be requested on submitted work. Current status: ${gig.status}`,
      }, { status: 400 });
    }

    // Send the gig back to the worker and STOP the auto-release timer so funds
    // are not released while the work is being revised.
    const { error: updErr } = await supabaseAdmin
      .from('gigs')
      .update({ status: 'assigned', auto_release_at: null, delivered_at: null })
      .eq('id', gigId);

    if (updErr) throw updErr;

    // Drop the feedback into the chat as a system message the worker will see.
    await supabaseAdmin.from('messages').insert({
      gig_id: gigId,
      sender_id: user.id,
      receiver_id: gig.assigned_worker_id,
      content: `Changes requested by the poster:\n\n"${String(feedback).trim()}"\n\nPlease revise and resubmit your work.`,
      message_type: 'system',
      is_pre_agreement: false,
    });

    // Notify the worker (Telegram + email + in-app bell).
    try {
      const { data: worker } = await supabaseAdmin
        .from('users')
        .select('telegram_chat_id, email, name')
        .eq('id', gig.assigned_worker_id)
        .single();

      if (worker?.telegram_chat_id) {
        const { sendTelegramAlert } = await import('@/lib/telegram');
        await sendTelegramAlert(
          worker.telegram_chat_id,
          `<b>Changes requested</b>\nThe poster asked for revisions on <i>${gig.title}</i>.\nReason: ${String(feedback).trim()}\n<a href="https://doitforme.in/gig/${gigId}">View and resubmit</a>`
        );
      }
      if (worker?.email) {
        const { sendEmail } = await import('@/lib/email');
        await sendEmail('changes_requested', {
          to: worker.email,
          recipientName: worker.name,
          gigTitle: gig.title,
          gigId,
        });
      }
      await supabaseAdmin.from('notifications').insert({
        user_id: gig.assigned_worker_id,
        type: 'changes_requested',
        content: `Changes requested on "${gig.title}". Revise and resubmit.`,
        link: `/activity`,
      });
    } catch (e) {
      console.error('Notification (request-changes) failed:', e);
    }

    return NextResponse.json({ success: true, message: 'Changes requested. The worker can now revise and resubmit.' });
  } catch (err: any) {
    console.error('Request-changes error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
