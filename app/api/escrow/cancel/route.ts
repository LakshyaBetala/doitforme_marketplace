import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { gigId } = await req.json();

    if (!gigId) {
      return NextResponse.json(
        { error: "Missing gigId" },
        { status: 400 }
      );
    }

    // SECURITY: Authenticate caller via cookie
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const posterId = user.id; // Server-verified

    const { data: gig } = await supabaseAdmin
      .from("gigs")
      .select("*")
      .eq("id", gigId)
      .single();

    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    if (gig.poster_id !== posterId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    if (gig.payment_status !== "ESCROW_HELD" && gig.status !== "open")
      return NextResponse.json({ error: "Cannot cancel at this stage" }, { status: 400 });

    let refundAmount = 0;
    let fee = 0;

    // SCENARIO 1: Funds are held -> Request Cancellation (No immediate refund)
    if (gig.payment_status === "ESCROW_HELD") {
      await supabaseAdmin
        .from("gigs")
        .update({
          status: "cancellation_requested", // New status
          updated_at: new Date().toISOString(),
          // We DO NOT change payment_status yet, as funds are still held
        })
        .eq("id", gigId);

      return NextResponse.json({
        success: true,
        message: "Cancellation requested. Admin/User approval required.",
        requestOnly: true
      });
    }

    // SCENARIO 2: No funds held (Open) -> Immediate Cancel
    const { error: updateError } = await supabaseAdmin
      .from("gigs")
      .update({
        status: "cancelled",
        payment_status: "CANCELLED",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", gigId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      refundAmount: 0,
      platformFee: 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
