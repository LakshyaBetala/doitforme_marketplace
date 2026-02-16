
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';


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
    const { gigId, applicantId, content, receiverId: inputReceiverId } = await req.json();

    // 2. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 3. Fetch Gig to Derive Receiver
    const { data: gig, error: gigError } = await supabase
      .from('gigs')
      .select('status, poster_id, assigned_worker_id, listing_type')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

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

      // Dynamic Limits based on Listing Type
      const limit = gig.listing_type === 'MARKET' ? 5 : 2;

      if ((count || 0) >= limit) {
        return NextResponse.json({
          error: "Limit Reached",
          message: `Limit Reached: ${limit} Messages. Wait for acceptance.`
        }, { status: 403 });
      }
    }

    // 6. Insert Message (With receiver_id!)
    const { data: msg, error: insertError } = await supabase
      .from('messages')
      .insert({
        gig_id: gigId,
        sender_id: user.id,
        receiver_id: receiverId, // CRITICAL FIX
        content: content.trim(),
        is_pre_agreement: isPreAgreement
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