
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { containsSensitiveInfo, analyzeIntentAI } from "@/lib/moderation";

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
    // 1. Remove receiverId from input (Secure Auto-Mapping)
    const { gigId, content, conversationId } = await req.json(); // Added conversationId for Poster repiest?
    // Actually, V3 requirements says "Remove receiverId from payload".
    // If Sender is Poster, we need to know WHICH applicant they are talking to.
    // Ideally, the frontend sends `conversation_id` or we infer it.
    // For now, let's look at `gig` and if Sender == Poster, we check `conversationId` or `receiver_id` passed?
    // "If sender is NOT poster, receiver is always gig.poster_id."
    // If sender IS poster, we need input. Let's allow receiverId OPTIONALLY for Poster only.

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 2. Hybrid Moderation Check (Regex + AI)
    // Regex first (Fast)
    const regexCheck = containsSensitiveInfo(content);
    if (regexCheck.detected) {
      await supabase.from('chat_blocked_logs').insert({
        sender_id: user.id,
        message: content,
        reason: regexCheck.reason,
        room_id: gigId
      });
      return NextResponse.json({ error: "Message Blocked", reason: regexCheck.reason }, { status: 400 });
    }

    // AI Check (Slow/Async) - We can run this in background or await. 
    // To ensure safety, await it.
    const aiCheck = await analyzeIntentAI(content);
    if (aiCheck.detected) {
      await supabase.from('chat_blocked_logs').insert({
        sender_id: user.id,
        message: content,
        reason: aiCheck.reason,
        room_id: gigId
      });
      return NextResponse.json({ error: "Message Blocked by AI", reason: aiCheck.reason }, { status: 400 });
    }


    // 3. Fetch Gig Details
    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('status, listing_type, poster_id, assigned_worker_id')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // 4. Auto-Map Receiver
    let finalReceiverId = null;

    if (user.id !== gig.poster_id) {
      // Applicant -> Poster
      finalReceiverId = gig.poster_id;
    } else {
      // Poster -> Applicant
      // We need to know who they are replying to.
      // We should check if `receiverId` (the applicant) was passed in body (allowed for poster)
      // OR infer from `conversationId`?
      // Let's grab `receiverId` from request ONLY if sender is poster.
      const { receiverId } = await req.json().catch(() => ({}));
      if (!receiverId) return NextResponse.json({ error: "Receiver ID required for Poster reply" }, { status: 400 });
      finalReceiverId = receiverId;
    }

    // 5. Check Limits (Strict Applicant Lock)
    // "Count messages only if (sender_id !== gig.poster_id AND gig.status === 'open')"
    const isApplicant = user.id !== gig.poster_id;
    const isPreAgreement = gig.status === 'open'; // or 'applicant_selected'? usually 'open' means not hired yet.

    if (isApplicant && isPreAgreement) {
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('gig_id', gigId)
        .eq('sender_id', user.id); // Valid count for THIS applicant

      if (countError) throw countError;

      const limit = 2;
      if ((count || 0) >= limit) {
        return NextResponse.json({
          error: "Limit Reached",
          message: "Applicant Limit: 2 Messages. Wait for hire."
        }, { status: 403 });
      }
    }


    // 6. Send Message
    const { data: msg, error: sendError } = await supabase
      .from('messages')
      .insert({
        gig_id: gigId,
        sender_id: user.id,
        receiver_id: finalReceiverId,
        content: content,
        is_pre_agreement: isPreAgreement
      })
      .select()
      .single();

    if (sendError) throw sendError;

    return NextResponse.json({ success: true, message: msg });

  } catch (err: any) {
    console.error("Chat API Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}