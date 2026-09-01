import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Reports the payout queue. It does NOT move money.
//
// Automated UPI payouts need a payouts product, and every Indian provider
// withholds those from unregistered/proprietorship businesses — Cashfree
// explicitly, RazorpayX in practice. Until DoItForMe is a registered entity
// there is no gateway that will send these transfers, so the previous
// Cashfree Payouts integration was code that could never run and has been
// removed rather than left to rot.
//
// Payouts are therefore manual: an admin pays each PENDING row from the
// Payouts desk and marks it COMPLETED. This cron exists to make the backlog
// visible (and to alert when it grows) rather than to pretend it is automated.
//
// When the entity exists, the replacement is a lib/razorpayXPayouts.ts with a
// sendUpiPayout() that claims each row PROCESSING before calling out, keyed on
// the payout_queue row id so a double-fired cron cannot pay twice.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || !provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized cron invocation" }, { status: 401 });
  }

  const { data: rows, error } = await supabase
    .from("payout_queue")
    .select("id, amount, created_at")
    .eq("status", "PENDING")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pending = rows?.length || 0;
  const total = (rows || []).reduce((a, r) => a + Number(r.amount || 0), 0);
  const oldest = rows?.[0]?.created_at || null;
  const oldestAgeHours = oldest
    ? Math.round((Date.now() - new Date(oldest).getTime()) / 3_600_000)
    : 0;

  // A worker waiting more than a day on money already released from escrow is
  // the thing worth shouting about, since nothing here can pay them.
  if (oldestAgeHours > 24) {
    console.error(
      `[process-payouts] ${pending} payout(s) pending, oldest ${oldestAgeHours}h — pay these manually`
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "manual",
    pending,
    total_amount: total,
    oldest_age_hours: oldestAgeHours,
    note: "Automated payouts require a registered entity. Pay from the admin Payouts desk.",
  });
}
