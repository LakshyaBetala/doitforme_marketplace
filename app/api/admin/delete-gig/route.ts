import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMINS = ["betala911@gmail.com", "doitforme.in@gmail.com"];

// Admin-only hard delete for stale / irrelevant posts. Guarded so a gig with any
// money or ratings attached can never be deleted (the DB would block it anyway —
// escrow/transactions/payout_queue/ratings are ON DELETE NO ACTION — but we check
// first to return a clear reason instead of a raw FK error). Safe deletes cascade
// applications/disputes/messages/alert-logs automatically.
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!ADMINS.includes(user.email || "")) {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    const { gigId } = await req.json();
    if (!gigId) return NextResponse.json({ error: "gigId required" }, { status: 400 });

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: gig } = await service
      .from("gigs")
      .select("id, title, status, payment_status, escrow_status, assigned_worker_id")
      .eq("id", gigId)
      .maybeSingle();
    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    // Guard 1: no money in flight.
    if (gig.payment_status && gig.payment_status !== "PENDING") {
      return NextResponse.json({ error: `Can't delete — payment status is ${gig.payment_status}. Resolve the payment/escrow first.` }, { status: 409 });
    }
    if (gig.escrow_status && gig.escrow_status !== "NONE") {
      return NextResponse.json({ error: `Can't delete — escrow status is ${gig.escrow_status}. Resolve the escrow first.` }, { status: 409 });
    }

    // Guard 2: no protected financial / ratings history pointing at it.
    const protectedTables: Array<[string, string]> = [
      ["escrow", "an escrow record"],
      ["transactions", "payment transactions"],
      ["payout_queue", "a queued payout"],
      ["ratings", "ratings"],
    ];
    for (const [table, label] of protectedTables) {
      const { count } = await service.from(table).select("*", { count: "exact", head: true }).eq("gig_id", gigId);
      if (count && count > 0) {
        return NextResponse.json({ error: `Can't delete — this post has ${label} linked to it (history is protected).` }, { status: 409 });
      }
    }

    // Clean up notifications that point at this gig (no FK), then delete the gig
    // (applications/disputes/messages/gig_alerts_sent cascade automatically).
    await service.from("notifications").delete().eq("link", `/gig/${gigId}`);
    const { error } = await service.from("gigs").delete().eq("id", gigId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, deleted: gig.title });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
