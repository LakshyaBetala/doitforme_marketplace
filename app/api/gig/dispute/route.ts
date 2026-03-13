import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }); } catch (e) { } },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }); } catch (e) { } },
      },
    }
  );

  try {
    const { gigId, reason } = await req.json();

    if (!gigId || !reason) {
      return NextResponse.json({ error: 'gigId and reason are required' }, { status: 400 });
    }

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Fetch gig
    const { data: gig } = await supabaseAdmin
      .from('gigs')
      .select('poster_id, assigned_worker_id, title, status')
      .eq('id', gigId)
      .single();

    if (!gig) return NextResponse.json({ error: 'Gig not found' }, { status: 404 });

    // 3. Only the poster can raise a dispute
    if (gig.poster_id !== user.id) {
      return NextResponse.json({ error: 'Only the poster can raise a dispute' }, { status: 403 });
    }

    // 4. Gig must be in 'delivered' state (work has been submitted)
    if (gig.status !== 'delivered') {
      return NextResponse.json({
        error: `Dispute can only be raised when work has been delivered. Current status: ${gig.status}`
      }, { status: 400 });
    }

    // 5. Insert into disputes table
    const { error: disputeError } = await supabaseAdmin.from('disputes').insert({
      gig_id: gigId,
      raised_by: user.id,
      reason: reason,
      status: 'OPEN',
    });

    if (disputeError) throw disputeError;

    // 6. Update gig status -> disputed
    await supabaseAdmin.from('gigs').update({
      status: 'disputed',
      dispute_reason: reason,
      escrow_status: 'DISPUTED',
    }).eq('id', gigId);

    // 7. Update escrow status
    await supabaseAdmin.from('escrow').update({
      status: 'DISPUTED',
    }).eq('gig_id', gigId);

    // 8. Telegram alerts
    try {
      const { sendTelegramAlert } = await import('@/lib/telegram');

      // Notify worker
      const { data: worker } = await supabaseAdmin
        .from('users')
        .select('telegram_chat_id, name')
        .eq('id', gig.assigned_worker_id)
        .single();

      if (worker?.telegram_chat_id) {
        await sendTelegramAlert(
          worker.telegram_chat_id,
          `⚠️ <b>Dispute Raised</b>\nThe poster has raised a dispute for <i>${gig.title}</i>.\nReason: ${reason}\nOur team will review within 24 hours. The escrow is currently frozen.\n<a href="https://doitforme.in/gig/${gigId}">View Gig</a>`
        );
      }
    } catch (e) {
      console.error('Telegram notification failed:', e);
    }

    return NextResponse.json({ success: true, message: 'Dispute raised. Escrow is frozen pending review.' });

  } catch (err: any) {
    console.error('Dispute Route Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
