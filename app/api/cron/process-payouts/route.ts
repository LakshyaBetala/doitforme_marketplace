import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payoutsConfigured, sendUpiPayout } from "@/lib/cashfreePayouts";

// Drains payout_queue automatically so nobody has to send UPI transfers by hand.
//
// The whole payout path is now: escrow released -> manual_release_escrow queues a
// PENDING row with a validated UPI -> this cron pays it -> row goes COMPLETED.
// No human step anywhere in the middle.
//
// Safe before Cashfree Payouts is approved: if the credentials are absent the
// run reports `skipped` and leaves every row PENDING for manual processing. It
// never marks anything paid that was not actually paid.
//
// Idempotency: transferId is the payout_queue row id, and Cashfree rejects a
// repeated transferId. Even a double-fired cron cannot pay twice.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH = 25;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
  }

  if (!payoutsConfigured()) {
    return NextResponse.json({
      ok: true,
      skipped: "Cashfree Payouts not configured — rows left PENDING for manual processing",
    });
  }

  const { data: rows, error } = await supabase
    .from("payout_queue")
    .select("id, worker_id, gig_id, amount, upi_id, status")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ ok: true, processed: 0 });

  const result = { processed: 0, paid: 0, failed: 0, retry: 0 };

  for (const row of rows) {
    // Claim the row before calling Cashfree. If the request times out after the
    // transfer is created, the row is already out of PENDING so the next run
    // cannot re-send it; reconciliation happens via the stable transferId.
    const { data: claimed } = await supabase
      .from("payout_queue")
      .update({ status: "PROCESSING" })
      .eq("id", row.id)
      .eq("status", "PENDING")
      .select("id");

    if (!claimed?.length) continue;
    result.processed++;

    const { data: worker } = await supabase
      .from("users")
      .select("name, email, telegram_chat_id")
      .eq("id", row.worker_id)
      .single();

    const res = await sendUpiPayout({
      transferId: String(row.id),
      amount: Number(row.amount),
      upiId: row.upi_id,
      name: worker?.name || "doitforme user",
      remarks: `Payout for gig ${row.gig_id}`,
    });

    if (res.ok) {
      result.paid++;
      await supabase
        .from("payout_queue")
        .update({ status: "COMPLETED", processed_at: new Date().toISOString() })
        .eq("id", row.id);

      try {
        if (worker?.telegram_chat_id) {
          const { sendTelegramAlert } = await import("@/lib/telegram");
          await sendTelegramAlert(
            worker.telegram_chat_id,
            `<b>Paid — ₹${row.amount}</b>\nSent to ${row.upi_id}. It usually lands within a few minutes.`
          );
        }
      } catch (e) {
        console.error("payout notify failed", e);
      }
    } else if (res.permanent) {
      // Terminal (bad VPA, rejected). Park it as FAILED so an admin can fix the
      // UPI rather than the cron retrying an impossible transfer forever.
      result.failed++;
      await supabase.from("payout_queue").update({ status: "FAILED" }).eq("id", row.id);
      console.error(`[process-payouts] permanent failure row=${row.id}: ${res.message}`);
    } else {
      // Transient (auth blip, network, insufficient float). Back to PENDING.
      result.retry++;
      await supabase.from("payout_queue").update({ status: "PENDING" }).eq("id", row.id);
      console.error(`[process-payouts] transient failure row=${row.id}: ${res.message}`);
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
