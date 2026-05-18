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

    // Notify worker via email
    try {
      const { data: gig } = await supabase
        .from('gigs')
        .select('title, assigned_worker_id, net_worker_pay')
        .eq('id', gigId)
        .single();

      if (gig?.assigned_worker_id) {
        const { data: worker } = await supabase
          .from('users')
          .select('email, name, telegram_chat_id')
          .eq('id', gig.assigned_worker_id)
          .single();

        if (worker?.email) {
          const { sendEmail } = await import('@/lib/email');
          await sendEmail('payment_released', {
            to: worker.email,
            recipientName: worker.name,
            gigTitle: gig.title,
            gigId,
            amount: gig.net_worker_pay,
          });
        }
        if (worker?.telegram_chat_id) {
          const { sendTelegramAlert } = await import('@/lib/telegram');
          await sendTelegramAlert(
            worker.telegram_chat_id,
            `💸 <b>Escrow released</b>\nYour payout for <i>${gig.title}</i> is queued. Funds settle within 24-48h.`
          );
        }
      }
    } catch (e) {
      console.error("Notification (release) failed:", e);
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
