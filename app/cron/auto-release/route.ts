import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Admin Client (Bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  // 1. Security: Protect cron endpoint with a secret header
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
    // 2. Get Current Time
    const now = new Date().toISOString();

    // 3. Fetch Eligible Gigs
    // Criteria: 
    // - Status is DELIVERED
    // - The 'auto_release_at' time has passed (it is less than 'now')
    // - Money is currently HELD
    // - There is NO dispute
    const { data: gigs, error: gigsErr } = await supabase
      .from("gigs")
      .select("*")
      .eq("status", "DELIVERED")
      .lt("auto_release_at", now) // Timer expired?
      .eq("payment_status", "HELD") // Money waiting?
      .is("dispute_reason", null)   // No dispute?
      .limit(50); // Process in batches to avoid timeouts

    if (gigsErr) {
      console.error("Auto-release fetch error:", gigsErr);
      return NextResponse.json({ success: false, error: gigsErr.message }, { status: 500 });
    }

    if (!gigs || gigs.length === 0) {
      return NextResponse.json({ success: true, releasedCount: 0, message: "No eligible gigs found" });
    }

    // 4. Process Payouts
    for (const gig of gigs) {
      const gigId = gig.id;
      try {
        // Use the Transactional RPC from your database schema
        // This RPC should handle moving money from 'HELD' to 'RELEASED' safely
        const { data: rpcData, error: rpcErr } = await supabase.rpc('release_escrow_transactional', { p_gig_id: gigId });
        
        if (rpcErr) {
          console.error(`Failed to release gig ${gigId}:`, rpcErr);
          details.push({ gigId, released: false, error: rpcErr.message });
          continue;
        }
        
        releasedCount += 1;
        details.push({ gigId, released: true, detail: rpcData });

      } catch (gigErr: any) {
        console.error('Auto-release unexpected error for gig', gig.id, gigErr);
        details.push({ gigId: gig.id, released: false, error: gigErr?.message });
      }
    }

    return NextResponse.json({ success: true, releasedCount, details });

  } catch (err: any) {
    console.error("Auto-release cron critical failure:", err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}