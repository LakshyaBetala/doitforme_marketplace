import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const gigId = searchParams.get('gigId');

    if (!gigId) {
      return NextResponse.json({ error: 'Gig ID is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
          remove(name: string, options: CookieOptions) { cookieStore.delete({ name, ...options }); },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Must be either poster or assigned worker
    const { data: gig, error: gigError } = await supabaseAdmin
      .from('gigs')
      .select('poster_id, assigned_worker_id, handshake_code')
      .eq('id', gigId)
      .single();

    if (gigError || !gig) {
      return NextResponse.json({ error: 'Gig not found' }, { status: 404 });
    }

    if (gig.poster_id !== user.id && gig.assigned_worker_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Try fetching from gig table first (P2P Sell uses this directly)
    if (gig.handshake_code) {
      return NextResponse.json({ code: gig.handshake_code });
    }

    // Fallback to Escrow table (Hustles use this)
    // using raw service role fetch if necessary since RLS might block worker reading escrow table
    // However, since we've already done an auth check above, we can safely just fetch the code.
    const { data: escrow } = await supabaseAdmin
      .from('escrow')
      .select('handshake_code')
      .eq('gig_id', gigId)
      .maybeSingle();

    if (escrow?.handshake_code) {
       return NextResponse.json({ code: escrow.handshake_code });
    }

    return NextResponse.json({ code: null });

  } catch (err: any) {
    console.error('Handshake API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
