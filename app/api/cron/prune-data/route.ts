import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Keep the notification tables from eating the database.
 *
 * They had, measured: `notifications` 377 MB and `gig_alerts_sent` 214 MB
 * against 12 MB for every other table combined — users, gigs, messages,
 * applications, escrow, transactions, the entire actual product. 750 MB total
 * on a 500 MB free tier, 79% of it notification bookkeeping, of which 97.6% had
 * never been opened by anyone.
 *
 * 20261003_stop_the_notification_fanout.sql fixed the inflow (adverts no longer
 * fan out at all; a real task alerts at most 200 people, nearest campus first).
 * This is the outflow. Without both, the table simply refills — at the old rate
 * it was back to a million rows in under three weeks.
 *
 * The retention windows live in the SQL function, not here, so the database and
 * this route cannot drift apart on what "old" means.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("prune_notification_tables");

  if (error) {
    console.error("[cron/prune-data] failed:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  console.log(`[cron/prune-data] ${JSON.stringify(data)}`);
  return NextResponse.json({ success: true, removed: data });
}
