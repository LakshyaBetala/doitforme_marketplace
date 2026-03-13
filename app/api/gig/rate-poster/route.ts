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
    const { gigId, rating, review } = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch the gig to verify the rater is the worker/assigned user
    const { data: gig } = await supabaseAdmin
      .from('gigs')
      .select('poster_id, assigned_worker_id, title, status')
      .eq('id', gigId)
      .single();

    if (!gig) return NextResponse.json({ error: 'Gig not found' }, { status: 404 });

    // Only the assigned worker (or seller who entered OTP) can rate the poster
    if (gig.assigned_worker_id !== user.id && gig.poster_id === user.id) {
      return NextResponse.json({ error: 'Only the worker/buyer can rate the poster via this endpoint' }, { status: 403 });
    }

    // Insert rating for the poster
    await supabaseAdmin.from('ratings').insert({
      gig_id: gigId,
      rater_id: user.id,
      rated_id: gig.poster_id,
      score: rating,
      review: review || '',
    });

    // Update poster's rating stats
    const { data: poster } = await supabaseAdmin
      .from('users')
      .select('rating, rating_count')
      .eq('id', gig.poster_id)
      .single();

    if (poster) {
      const oldRating = Number(poster.rating) || 5.0;
      const oldCount = Number(poster.rating_count) || 0;
      const newCount = oldCount + 1;
      const newRating = ((oldRating * oldCount) + Number(rating)) / newCount;

      await supabaseAdmin.from('users').update({
        rating: newRating,
        rating_count: newCount,
      }).eq('id', gig.poster_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Rate Poster Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
