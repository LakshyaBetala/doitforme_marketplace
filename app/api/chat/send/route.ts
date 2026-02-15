
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
    // 1. Single Body Parse (Fixes "Double JSON" crash)
    const { gigId, applicantId, content } = await req.json();

    // 2. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 3. Fetch Gig to Derive Receiver
    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('status, poster_id, assigned_worker_id')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    const isPoster = user.id === gig.poster_id;
    let receiverId = null;

    if (isPoster) {
      // Poster -> Applicant
      if (!applicantId) return NextResponse.json({ error: "Applicant ID required for reply" }, { status: 400 });
      receiverId = applicantId;
    } else {
      // Applicant -> Poster
      receiverId = gig.poster_id;
    }

    // 5. Check Limits (Strict Applicant Lock)
    const isApplicant = !isPoster;
    const isPreAgreement = gig.status === 'open';

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
        receiver_id: receiverId,
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