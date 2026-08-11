
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { analyzeIntentAI } from "@/lib/moderation";


export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  try {
    // 1. Single Body Parse (Fixes "Double JSON" crash)
    const { gigId, applicantId, content, receiverId: inputReceiverId, type = 'text', offerAmount } = await req.json();

    // 2. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 3. Fetch Gig to Derive Receiver
    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('title, status, poster_id, assigned_worker_id, listing_type, market_type')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // 3.5 Check if Chat is Locked (Completed/Cancelled)
    if (['completed', 'cancelled'].includes(gig.status)) {
      return NextResponse.json({
        error: "This conversation is closed as the gig is completed or cancelled."
      }, { status: 403 });
    }

    const isPoster = user.id === gig.poster_id;

    // 4. Determine Receiver
    let receiverId = inputReceiverId;

    if (!receiverId) {
      if (isPoster) {
        // If I am poster, I am replying to an applicant/worker
        // The client MUST provide applicantId or receiverId in this case
        receiverId = applicantId || gig.assigned_worker_id;

        // Security: If poster is replying to an applicantId, verify the applicant has applied
        if (applicantId && applicantId !== gig.assigned_worker_id) {
          const { data: validApp } = await supabase
            .from('applications')
            .select('id')
            .eq('gig_id', gigId)
            .eq('worker_id', applicantId)
            .single();

          if (!validApp) {
            return NextResponse.json({ error: "Security Alert: This user has not applied to this gig." }, { status: 403 });
          }
        }
      } else {
        // If I am applicant, I am sending to poster
        receiverId = gig.poster_id;
      }
    }

    if (!receiverId) {
      return NextResponse.json({
        success: false,
        error: "Unable to determine message recipient."
      }, { status: 400 });
    }

    // 5. Check Limits (Strict Applicant Lock) - BYPASS FOR OFFERS & MAGIC CHIPS
    const isApplicant = !isPoster;
    const isPreAgreement = gig.status === 'open';

    const MAGIC_CHIPS = [
      "Available?", "Best Price?", "Where to meet?", "Can I see more pics?",
      "I'm interested!", "My Portfolio", "Can do in 1 day", "Let's discuss!"
    ];

    // Pre-agreement conversation cap.
    //
    // The cap exists to stop a deal being negotiated and completed entirely in
    // chat, off-platform — the primary abuse vector here. Once someone is
    // actually hired the conversation is unlimited, because by then the work
    // and the money are on-platform and long threads are exactly what we want.
    //
    // Deliberate choices:
    //  - Counted ACROSS BOTH participants, not per-sender. A per-sender cap let
    //    a pair exchange double the messages, which defeated the point.
    //  - Applies to the poster too. It was applicant-only, so a poster could
    //    carry the whole off-platform negotiation themselves.
    //  - Offers and quick-reply chips never count; they move a deal forward.
    //  - The number is NEVER shown. Telling people "5 of 10 used" turns a guard
    //    rail into a countdown they optimise against, usually by immediately
    //    swapping contact details.
    const PRE_AGREEMENT_MESSAGE_CAP = 10;

    // "Agreed" = this pair is actually working together. gig.status alone was
    // wrong: a multi-worker gig stays 'open' while filling, so an already-hired
    // worker kept getting capped.
    const otherParty = isPoster ? receiverId : user.id;
    const { data: acceptedApp } = await supabase
      .from('applications')
      .select('id')
      .eq('gig_id', gigId)
      .eq('worker_id', otherParty)
      .eq('status', 'accepted')
      .maybeSingle();

    const isAgreed = Boolean(acceptedApp) || gig.assigned_worker_id === otherParty || !isPreAgreement;

    if (!isAgreed && type !== 'offer' && !MAGIC_CHIPS.includes(content)) {
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('gig_id', gigId)
        .in('sender_id', [user.id, receiverId])
        .neq('message_type', 'offer')
        .neq('message_type', 'system')
        .not('content', 'in', `(${MAGIC_CHIPS.map(c => `"${c}"`).join(',')})`);

      if (countError) throw countError;

      if ((count || 0) >= PRE_AGREEMENT_MESSAGE_CAP) {
        return NextResponse.json({
          error: "Limit Reached",
          message: isPoster
            ? "Hire them to keep chatting — messages are unlimited once you do."
            : "Send an offer to keep chatting — messages are unlimited once you're hired.",
        }, { status: 403 });
      }
    }

    // 5. Hard Limit Check (Already done above)
    // 5.5 Hybrid AI Moderation
    // Skip moderation for images and offers
    let flagged = false;
    if (type === 'text' && content?.trim()) {
      const modResult = await analyzeIntentAI(content);
      if (!modResult.success) {
        return NextResponse.json({
          success: false,
          error: "Message blocked",
          reason: modResult.reason
        }, { status: 400 });
      }
      flagged = modResult.flagged || false;
    }

    // 6. Insert Message (With receiver_id!)
    const { data: msg, error: insertError } = await supabase
      .from('messages')
      .insert({
        gig_id: gigId,
        sender_id: user.id,
        receiver_id: receiverId, // CRITICAL FIX
        content: type === 'image' ? content : (content?.trim() || (type === 'offer' ? `Offer: ₹${offerAmount}` : '')),
        message_type: type, // Matches 'text', 'image', 'offer'
        offer_amount: type === 'offer' ? offerAmount : null,
        is_pre_agreement: isPreAgreement,
        flagged_for_review: flagged
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // --- TELEGRAM NOTIFICATION ---
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: receiver } = await supabaseAdmin
        .from('users')
        .select('telegram_chat_id')
        .eq('id', receiverId)
        .single();
        
      if (receiver?.telegram_chat_id) {
        const { sendTelegramAlert } = await import('@/lib/telegram');
        // Chat room ID is gigId_workerId
        const workerId = isPoster ? receiverId : user.id;
        const chatLink = `https://doitforme.in/messages?chat=${gigId}_${workerId}`;
        
        let telegramMessage = `💬 <b>New Message!</b>\nYou received a new message regarding a gig: <i>${gig.title}</i>.\n<a href="${chatLink}">Click to reply</a>`;
        
        if (type === 'system' && content === 'LOCATION_ALERT') {
          telegramMessage = `🚨 <b>They are here!</b>\nThe other user has arrived at the location for: <i>${gig.title}</i>.\n<a href="${chatLink}">Open Chat</a>`;
        }

        await sendTelegramAlert(
          receiver.telegram_chat_id,
          telegramMessage
        );
      }
    } catch (e) {
      console.error("Telegram notification failed:", e);
    }
    // ----------------------------

    return NextResponse.json({ success: true, message: msg });

  } catch (err: any) {
    console.error("Chat API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}