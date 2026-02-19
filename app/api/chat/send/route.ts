
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { analyzeIntentAI } from "@/lib/moderation";


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
    // 1. Single Body Parse (Fixes "Double JSON" crash)
    const { gigId, applicantId, content, receiverId: inputReceiverId, type = 'text', offerAmount } = await req.json();

    // 2. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 3. Fetch Gig to Derive Receiver
    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('status, poster_id, assigned_worker_id, listing_type, market_type')
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

    // Only enforce limit if:
    // 1. User is Applicant
    // 2. Gig is Open (Pre-agreement)
    // 3. Message Type is NOT 'offer'
    // 4. Content is NOT a Magic Chip
    if (isApplicant && isPreAgreement && type !== 'offer' && !MAGIC_CHIPS.includes(content)) {
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('gig_id', gigId)
        .eq('sender_id', user.id)
        .neq('message_type', 'offer') // Don't count offers
        .not('content', 'in', `(${MAGIC_CHIPS.map(c => `"${c}"`).join(',')})`); // Don't count chips

      if (countError) throw countError;

      // Dynamic Limits based on Listing Type and Market Type
      let limit = 2; // Default for HUSTLE

      if (gig.listing_type === 'MARKET') {
        if (gig.market_type === 'RENT') {
          limit = 10; // RENT Limit
        } else {
          // SELL, FREE, BUY_REQUEST, REQUEST
          limit = 10; // Market Standard Limit (V6 Pivot)
        }
      }

      if ((count || 0) >= limit) {
        return NextResponse.json({
          error: "Limit Reached",
          message: `Limit Reached: ${limit} Messages. Wait for acceptance or make an offer.`
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

    return NextResponse.json({ success: true, message: msg });

  } catch (err: any) {
    console.error("Chat API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}