import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// The worker's half of the reputation system.
//
// Two things were wrong before this route was reachable from anywhere:
//
//   1. The guard read
//        if (gig.assigned_worker_id !== user.id && gig.poster_id === user.id)
//      which for a stranger evaluates to `true && false` — false. It blocked
//      the poster from rating themselves and let *anyone else* rate any poster.
//
//   2. It wrote into users.rating / users.rating_count, the same columns the
//      worker rating uses. Almost everyone here is both a poster and a hustler,
//      so a single averaged number describes neither: a great hustler who is a
//      flaky client would show one middling score and hide both facts.
//
// Ratings are now classified by role at read time (see app/u/[username]), from
// whether the rated person owns the gig — so this route only records the row and
// deliberately leaves users.rating alone.
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { gigId, rating, review } = (await req.json().catch(() => ({}))) as {
      gigId?: string;
      rating?: number | string;
      review?: string;
    };

    if (!gigId) return NextResponse.json({ error: 'gigId is required' }, { status: 400 });

    const score = Number(rating);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return NextResponse.json({ error: 'Rating must be a whole number from 1 to 5.' }, { status: 400 });
    }

    const { data: gig } = await supabaseAdmin
      .from('gigs')
      .select('poster_id, assigned_worker_id, title, status')
      .eq('id', gigId)
      .single();

    if (!gig) return NextResponse.json({ error: 'Gig not found' }, { status: 404 });

    // Only the person who actually did the work may rate the client.
    if (!gig.assigned_worker_id || gig.assigned_worker_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the assigned worker can rate the poster.' },
        { status: 403 }
      );
    }
    if (gig.poster_id === user.id) {
      return NextResponse.json({ error: 'You cannot rate yourself.' }, { status: 400 });
    }

    // Rate the finished job, not one in progress — otherwise a rating becomes
    // leverage while the poster still has to approve the work.
    if (String(gig.status).toLowerCase() !== 'completed') {
      return NextResponse.json(
        { error: 'You can rate the poster once the gig is completed.' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('ratings')
      .select('id')
      .eq('gig_id', gigId)
      .eq('rater_id', user.id)
      .eq('rated_id', gig.poster_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'You have already rated this poster.' }, { status: 409 });
    }

    const { error: insertErr } = await supabaseAdmin.from('ratings').insert({
      gig_id: gigId,
      rater_id: user.id,
      rated_id: gig.poster_id,
      score,
      review: (review || '').trim(),
    });

    if (insertErr) {
      console.error(`[rate-poster] insert failed gig=${gigId}: ${insertErr.message}`);
      return NextResponse.json({ error: 'Could not save your rating.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Rate Poster Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
