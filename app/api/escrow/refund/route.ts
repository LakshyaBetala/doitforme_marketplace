import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { gigId, posterId } = await req.json();

    if (!gigId || !posterId) {
      return NextResponse.json({ error: "Missing gigId or posterId" }, { status: 400 });
    }

    // get session user
    const authSupabase = await supabaseServer();
    const { data: userData } = await authSupabase.auth.getUser();
    const user = userData?.user ?? null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Call transactional refund RPC
    const posterIdToUse = user.id; // session user already validated earlier
    const { data: rpcData, error: rpcErr } = await supabase.rpc("refund_escrow_transactional", {
      p_gig_id: gigId,
      p_poster_id: posterIdToUse,
    });

    if (rpcErr) {
      console.error("RPC refund failed:", rpcErr);
      return NextResponse.json({ error: rpcErr.message || 'Refund RPC failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, detail: rpcData });
  } catch (err: any) {
    console.error("Refund failed:", err);
    return NextResponse.json({ error: err?.message || "Refund failed" }, { status: 500 });
  }
}
