import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// Delete a listing you posted — but only while nobody is committed to it.
//
// The rule: free to remove until you accept someone, impossible afterwards.
// Once a worker is assigned they may already be doing the work, and once money
// is in escrow there is a liability attached to the row. Deleting either would
// strand a person mid-job or orphan funds, so those cases are refused with a
// reason rather than silently ignored.
//
// Anyone who applied is told the listing closed, because vanishing without a
// word is precisely the experience that left 143 of 168 applicants in silence.

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const { gigId } = await req.json();
  if (!gigId) return NextResponse.json({ error: "gigId is required" }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: gig } = await admin
    .from("gigs")
    .select("id, title, poster_id, status, assigned_worker_id, payment_status, escrow_status")
    .eq("id", gigId)
    .single();

  if (!gig) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  if (gig.poster_id !== user.id) {
    return NextResponse.json({ error: "That isn't your listing." }, { status: 403 });
  }

  if (gig.assigned_worker_id) {
    return NextResponse.json({
      error: "You've already hired someone for this. Message them to sort it out, or raise a dispute if something's gone wrong.",
    }, { status: 409 });
  }

  const fundsInPlay = ["HELD", "ESCROW_FUNDED", "PAYOUT_PENDING"].includes(gig.payment_status || "")
    || gig.escrow_status === "HELD";
  if (fundsInPlay) {
    return NextResponse.json({
      error: "There's money held against this listing, so it can't be deleted. Contact support and we'll sort it out.",
    }, { status: 409 });
  }

  // Tell the applicants before the row disappears.
  const { data: applicants } = await admin
    .from("applications")
    .select("worker_id")
    .eq("gig_id", gigId)
    .in("status", ["pending", "applied"]);

  const { error: delErr } = await admin
    .from("gigs")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", gigId)
    .is("assigned_worker_id", null); // guard against a race with an accept

  if (delErr) {
    console.error("gig delete failed:", delErr);
    return NextResponse.json({ error: "Couldn't remove that right now." }, { status: 500 });
  }

  await admin
    .from("applications")
    .update({ status: "closed" })
    .eq("gig_id", gigId)
    .in("status", ["pending", "applied"]);

  for (const a of applicants || []) {
    try {
      await admin.from("notifications").insert({
        user_id: a.worker_id,
        type: "gig_cancelled",
        content: `"${gig.title}" was taken down by the poster. You're not waiting on it any more.`,
        link: "/feed",
      });
    } catch (e) {
      console.error("cancel notify failed", e);
    }
  }

  return NextResponse.json({ success: true, notified: applicants?.length || 0 });
}
