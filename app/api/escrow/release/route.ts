import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isAdminEmail } from "@/lib/admins";

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

    // Authorize HERE, not in the RPC.
    //
    // manual_release_escrow guards with
    //   `if auth.uid() is distinct from poster_id and not is_admin()`
    // but we call it with the SERVICE ROLE client below, where auth.uid() is
    // NULL and is_admin() returns NULL. `TRUE and NULL` is NULL, so the IF never
    // fires and the poster check is silently skipped — which meant any logged-in
    // user could release any gig's escrow just by posting its id.
    const { data: gigRow, error: gigErr } = await supabase
      .from("gigs")
      .select("poster_id")
      .eq("id", gigId)
      .single();

    if (gigErr || !gigRow) {
      return NextResponse.json({ error: "Gig not found" }, { status: 404 });
    }
    if (gigRow.poster_id !== user.id && !isAdminEmail(user.email)) {
      return NextResponse.json(
        { error: "Only the poster can release this payment." },
        { status: 403 }
      );
    }

    // Call transactional RPC to perform manual release (Queued)
    const { data: rpcData, error: rpcErr } = await supabase.rpc("manual_release_escrow", {
      p_gig_id: gigId,
    });

    if (rpcErr) {
      console.error("RPC release failed:", rpcErr);
      return NextResponse.json({ error: rpcErr.message || 'Release RPC failed' }, { status: 500 });
    }

    // The RPC reports failure IN ITS RETURN VALUE, not as a Postgres error, so
    // only checking rpcErr reported success for every failed release — including
    // the one where a wrong column name silently rolled the whole thing back.
    // Authorization, missing-UPI and already-released all arrive here.
    if (!rpcData?.success) {
      const reason = rpcData?.error || "Release failed";
      const status = rpcData?.code === "WORKER_UPI_MISSING" ? 409
        : /only the poster/i.test(reason) ? 403
        : 400;
      console.error(`[escrow-release] gig=${gigId} refused: ${reason}`);
      return NextResponse.json({ error: reason, code: rpcData?.code }, { status });
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
