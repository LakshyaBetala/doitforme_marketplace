import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // protect cron endpoint with secret header
  try {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const provided = req.headers.get("x-cron-secret");
      if (!provided || provided !== secret) {
        return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
      }
    }
  } catch (_) {}
  const details: Array<any> = [];
  let releasedCount = 0;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch eligible gigs
    const { data: gigs, error: gigsErr } = await supabase
      .from("gigs")
      .select("*")
      .eq("status", "DELIVERED")
      .lt("delivered_at", sevenDaysAgo)
      .eq("payment_status", "ESCROW_HELD")
      .limit(200);

    if (gigsErr) {
      console.error("Failed to fetch gigs for auto-release:", gigsErr);
      return NextResponse.json({ success: false, error: gigsErr.message || gigsErr }, { status: 500 });
    }

    if (!gigs || gigs.length === 0) {
      return NextResponse.json({ success: true, releasedCount: 0, details: [] });
    }

    for (const gig of gigs) {
      const gigId = gig.id;
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('release_escrow_transactional', { p_gig_id: gigId });
        if (rpcErr) {
          details.push({ gigId, released: false, error: rpcErr.message || rpcErr });
          continue;
        }
        releasedCount += 1;
        details.push({ gigId, released: true, detail: rpcData });
      } catch (gigErr: any) {
        console.error('Auto-release failed for gig', gig.id, gigErr);
        details.push({ gigId: gig.id, released: false, error: gigErr?.message || gigErr });
      }
    }

    return NextResponse.json({ success: true, releasedCount, details });
  } catch (err: any) {
    console.error("Auto-release cron failed:", err);
    return NextResponse.json({ success: false, error: err?.message || err });
  }
}
