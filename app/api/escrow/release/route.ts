import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { gigId } = await req.json();

    if (!gigId) {
      return NextResponse.json({ error: "Missing gigId" }, { status: 400 });
    }

    // get session user
    const authSupabase = await supabaseServer();
    const { data: userData } = await authSupabase.auth.getUser();
    const user = userData?.user ?? null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Call transactional RPC to perform manual release (Queued)
    const { data: rpcData, error: rpcErr } = await supabase.rpc("manual_release_escrow", {
      p_gig_id: gigId,
    });

    if (rpcErr) {
      console.error("RPC release failed:", rpcErr);
      return NextResponse.json({ error: rpcErr.message || 'Release RPC failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, detail: rpcData });
  } catch (err: any) {
    console.error("Escrow release failed:", err);
    return NextResponse.json(
      { error: err?.message || "Escrow release failed" },
      { status: 500 }
    );
  }
}
