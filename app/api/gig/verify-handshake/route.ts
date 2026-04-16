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
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  try {
    const { gigId, code } = await req.json();

    // 1. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Fetch Gig
    const { data: gig } = await supabaseAdmin
      .from('gigs')
      .select('assigned_worker_id, poster_id, listing_type, market_type, title, handshake_code')
      .eq('id', gigId)
      .single();

    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // 3. Auth Logic:
    //    - HUSTLE: Worker (assigned_worker_id) enters code from Poster.
    //    - MARKETPLACE: Seller (poster_id) enters code from Buyer.
    const isMarket = gig.listing_type === 'MARKET';
    const canVerify = isMarket 
      ? gig.poster_id === user.id 
      : gig.assigned_worker_id === user.id;

    if (!canVerify) {
      return NextResponse.json({ 
        error: isMarket 
          ? "Only the seller/owner can verify this code" 
          : "Only the assigned worker/hustler can verify this code" 
      }, { status: 403 });
    }

    // 4. Fetch Escrow (Optional for SELL)
    const { data: escrow } = await supabaseAdmin
      .from('escrow')
      .select('*')
      .eq('gig_id', gigId)
      .maybeSingle();

    if (!escrow && !(gig.listing_type === 'MARKET' && gig.market_type === 'SELL')) {
        return NextResponse.json({ error: "Escrow record not found" }, { status: 404 });
    }

    // 5. Verify Code
    const correctCode = gig.handshake_code || escrow?.handshake_code;
    
    // Convert both to strings and trim just to be absolutely safe against type mismatches
    const safeCorrectCode = correctCode ? String(correctCode).trim() : null;
    const safeInputCode = code ? String(code).trim() : null;

    if (!safeCorrectCode) return NextResponse.json({ error: "No handshake code established" }, { status: 500 });
    if (safeCorrectCode !== safeInputCode) {
      return NextResponse.json({ error: "Invalid Handshake Code" }, { status: 400 });
    }

    // 6. Determine payout
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

    // 7. Update Escrow → RELEASED (Only if it exists)
    if (escrow) {
        await supabaseAdmin
          .from('escrow')
          .update({ status: 'RELEASED', released_at: new Date().toISOString() })
          .eq('id', escrow.id);
    }

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

    // 11. Update worker stats (jobs_completed++) ONLY FOR HUSTLE
    if (!isMarket) {
      const { data: worker } = await supabaseAdmin
        .from('users')
        .select('jobs_completed, total_earned')
        .eq('id', gig.assigned_worker_id)
        .single();
  
      if (worker) {
        await supabaseAdmin
          .from('users')
          .update({ 
            jobs_completed: (worker.jobs_completed || 0) + 1,
            total_earned: (Number(worker.total_earned) || 0) + payoutAmount
          })
          .eq('id', gig.assigned_worker_id);
      }
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
