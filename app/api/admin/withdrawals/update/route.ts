import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { id, userId, amount, status } = await req.json();

    if (!id || !userId || !amount || !status)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // require admin
    const authSupabase = await supabaseServer();
    const { data: userData } = await authSupabase.auth.getUser();
    const user = userData?.user ?? null;
    const isAdmin = !!(
      (user && (user.user_metadata as any)?.role === "admin") ||
      (process.env.ADMIN_SECRET && req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET) ||
      (process.env.ADMIN_EMAIL && user?.email === process.env.ADMIN_EMAIL)
    );
    if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // update status
    await supabase
      .from("withdrawal_requests")
      .update({
        status,
        processed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (status === "APPROVED") {
      // only unfreeze, admin will payout manually
      await supabase.rpc("unfreeze_wallet_amount", {
        user_id_input: userId,
        amount_input: amount,
      });

      await supabase.from("transactions").insert({
        user_id: userId,
        type: "WITHDRAWAL_APPROVED",
        amount: -amount,
      });
    }

    if (status === "REJECTED") {
      await supabase.rpc("refund_wallet_freeze", {
        user_id_input: userId,
        amount_input: amount,
      });

      await supabase.from("transactions").insert({
        user_id: userId,
        type: "WITHDRAWAL_REJECTED",
        amount: +amount,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update" },
      { status: 500 }
    );
  }
}
