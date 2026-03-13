import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Admin client that bypasses RLS
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
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }) } catch (e) { } },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }) } catch (e) { } },
      },
    }
  );

  try {
    const { gigId, code } = await req.json();

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Fetch Gig
    const { data: gig } = await supabaseAdmin
      .from('gigs')
      .select('assigned_worker_id, poster_id, listing_type, market_type, title')
      .eq('id', gigId)
      .single();

    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // 3. Auth: for HUSTLE - worker enters poster's code
    //         for MARKET - worker (buyer) enters poster (seller)'s code
    if (gig.assigned_worker_id !== user.id) {
      return NextResponse.json({ error: "Only the assigned worker/buyer can verify this code" }, { status: 403 });
    }

    // 4. Fetch Escrow
    const { data: escrow } = await supabaseAdmin
      .from('escrow')
      .select('*')
      .eq('gig_id', gigId)
      .single();

    if (!escrow) return NextResponse.json({ error: "Escrow record not found" }, { status: 404 });

    // 5. Verify Code
    if (escrow.handshake_code !== code) {
      return NextResponse.json({ error: "Invalid Handshake Code" }, { status: 400 });
    }

    // 6. Determine payout
    const isMarket = gig.listing_type === 'MARKET';
    let payoutDestination = gig.assigned_worker_id; // Hustle: pay worker
    const { data: escrowRecord } = await supabaseAdmin
      .from('escrow')
      .select('amount_held')
      .eq('gig_id', gigId)
      .single();

    const totalHeld = Number(escrowRecord?.amount_held || 0);
    let payoutAmount = totalHeld;
    let refundDestination = null;
    let refundAmount = 0;

    if (isMarket) {
      if (gig.market_type === 'SELL') {
        // Buyer entered code → seller (poster) gets paid
        payoutDestination = gig.poster_id;
        payoutAmount = totalHeld;
      } else if (gig.market_type === 'RENT') {
        // Renter returned item → poster (owner) gets rental fee, renter gets deposit back
        refundDestination = gig.assigned_worker_id;
        const { data: gigFull } = await supabaseAdmin.from('gigs').select('security_deposit').eq('id', gigId).single();
        refundAmount = Number(gigFull?.security_deposit || 0);
        payoutDestination = gig.poster_id;
        payoutAmount = totalHeld - refundAmount;
      }
    } else {
      // Hustle: After handshake, pay worker
      const { data: workerStats } = await supabaseAdmin
        .from('users')
        .select('jobs_completed')
        .eq('id', gig.assigned_worker_id)
        .single();
      const jobsDone = workerStats?.jobs_completed || 0;
      const feeRate = jobsDone > 10 ? 0.075 : 0.10;
      const platformFee = Math.ceil(totalHeld * feeRate);
      payoutAmount = totalHeld - platformFee;

      // Log platform fee
      await supabaseAdmin.from('transactions').insert({
        gig_id: gigId,
        amount: platformFee,
        type: 'PLATFORM_FEE',
        status: 'COMPLETED',
        description: `Platform Fee (${(feeRate * 100).toFixed(1)}%) for ${gig.title}`
      });
    }

    // 7. Update Escrow → RELEASED
    await supabaseAdmin
      .from('escrow')
      .update({ status: 'RELEASED', released_at: new Date().toISOString() })
      .eq('id', escrow.id);

    // 8. Update Gig → completed
    await supabaseAdmin
      .from('gigs')
      .update({
        status: 'completed',
        delivered_at: new Date().toISOString(),
        escrow_status: 'RELEASED',
        payment_status: 'PAYOUT_PENDING',
        auto_release_at: null,
      })
      .eq('id', gigId);

    // 9. Log payout transaction
    if (payoutAmount > 0 && payoutDestination) {
      await supabaseAdmin.from('transactions').insert({
        gig_id: gigId,
        user_id: payoutDestination,
        amount: payoutAmount,
        type: 'PAYOUT_CREDIT',
        status: 'COMPLETED',
        description: `Payout for ${gig.title}`
      });
    }

    // 10. Log refund (if any)
    if (refundAmount > 0 && refundDestination) {
      await supabaseAdmin.from('transactions').insert({
        gig_id: gigId,
        user_id: refundDestination,
        amount: refundAmount,
        type: 'REFUND_CREDIT',
        status: 'COMPLETED',
        description: `Security Deposit Refund for ${gig.title}`
      });
    }

    // 11. Update worker stats (jobs_completed++)
    const { data: worker } = await supabaseAdmin
      .from('users')
      .select('jobs_completed')
      .eq('id', gig.assigned_worker_id)
      .single();

    if (worker) {
      await supabaseAdmin
        .from('users')
        .update({ jobs_completed: (worker.jobs_completed || 0) + 1 })
        .eq('id', gig.assigned_worker_id);
    }

    // 12. Telegram notifications
    try {
      const { sendTelegramAlert } = await import('@/lib/telegram');
      const [workerUser, posterUser] = await Promise.all([
        supabaseAdmin.from('users').select('telegram_chat_id').eq('id', gig.assigned_worker_id).single(),
        supabaseAdmin.from('users').select('telegram_chat_id').eq('id', gig.poster_id).single(),
      ]);

      if (workerUser.data?.telegram_chat_id) {
        await sendTelegramAlert(
          workerUser.data.telegram_chat_id,
          `🎉 <b>Payment Released!</b>\nHandshake verified for <i>${gig.title}</i>. Your earnings will arrive in your UPI within 24 hours.\n<a href="https://doitforme.in/gig/${gigId}">View Gig</a>`
        );
      }
      if (posterUser.data?.telegram_chat_id) {
        await sendTelegramAlert(
          posterUser.data.telegram_chat_id,
          `✅ <b>Deal Completed!</b>\nHandshake confirmed for <i>${gig.title}</i>. The deal is now closed.\n<a href="https://doitforme.in/gig/${gigId}">View Gig</a>`
        );
      }
    } catch (e) {
      console.error('Telegram notification failed:', e);
    }

    return NextResponse.json({ success: true, message: "Handshake verified! Funds released." });

  } catch (err: any) {
    console.error("Handshake Verification Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
