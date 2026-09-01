import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { checkUpi } from "@/lib/upi";
import { isAdminEmail } from "@/lib/admins";

// Admin payout console API.
//
// Cashfree does not offer the Payouts product to unregistered/proprietorship
// businesses, so automated transfers are blocked on company registration. This
// is the bridge: the queue still does all the thinking (who, how much, to which
// validated UPI) and the admin only confirms. Nothing is typed by hand, which is
// where payout mistakes actually come from.
//
// When Payouts is approved, /api/cron/process-payouts takes over this exact
// queue and this console becomes a read-only view. No data migration needed.


async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return {
    service: createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ),
    adminEmail: user.email!,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const { data: rows, error } = await admin.service
    .from("payout_queue")
    .select("id, worker_id, gig_id, amount, upi_id, status, created_at, processed_at")
    .in("status", ["PENDING", "PROCESSING", "FAILED"])
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Hydrate worker + gig for display. Small volumes; two lookups beat a join
  // that would need an FK PostgREST can rely on.
  const workerIds = [...new Set((rows || []).map((r) => r.worker_id))];
  const gigIds = [...new Set((rows || []).map((r) => r.gig_id))];

  const [{ data: workers }, { data: gigs }] = await Promise.all([
    admin.service.from("users").select("id, name, username, email").in("id", workerIds.length ? workerIds : ["-"]),
    admin.service.from("gigs").select("id, title").in("id", gigIds.length ? gigIds : ["-"]),
  ]);

  const wMap = Object.fromEntries((workers || []).map((w) => [w.id, w]));
  const gMap = Object.fromEntries((gigs || []).map((g) => [g.id, g]));

  const items = (rows || []).map((r) => {
    const w = wMap[r.worker_id];
    const check = checkUpi(r.upi_id || "");
    return {
      ...r,
      worker_name: w?.name || w?.username || w?.email || "Unknown",
      gig_title: gMap[r.gig_id]?.title || "—",
      upi_valid: check.valid,
      upi_warning: check.valid && check.unknownHandle ? "Unrecognised bank handle" : check.error || null,
    };
  });

  const totalPending = items
    .filter((i) => i.status === "PENDING")
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return NextResponse.json({ items, totalPending, automated: false });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const { id, action } = await req.json();
  if (!id || !["PAID", "FAILED", "RETRY"].includes(action)) {
    return NextResponse.json({ error: "id and a valid action are required" }, { status: 400 });
  }

  const next = action === "PAID" ? "COMPLETED" : action === "FAILED" ? "FAILED" : "PENDING";

  // Guard: only move rows that are still open. Prevents an admin double-tap (or
  // two admins) from re-completing a row and re-notifying the worker.
  const { data: updated, error } = await admin.service
    .from("payout_queue")
    .update({
      status: next,
      processed_at: next === "COMPLETED" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .in("status", ["PENDING", "PROCESSING", "FAILED"])
    .select("id, worker_id, amount, upi_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated?.length) {
    return NextResponse.json({ error: "Already processed" }, { status: 409 });
  }

  if (next === "COMPLETED") {
    const row = updated[0];
    console.log(`[admin-payouts] ${admin.adminEmail} marked payout ${id} paid (₹${row.amount} -> ${row.upi_id})`);
    try {
      const { data: worker } = await admin.service
        .from("users")
        .select("telegram_chat_id, name")
        .eq("id", row.worker_id)
        .single();
      if (worker?.telegram_chat_id) {
        const { sendTelegramAlert } = await import("@/lib/telegram");
        await sendTelegramAlert(
          worker.telegram_chat_id,
          `<b>Paid — ₹${row.amount}</b>\nSent to ${row.upi_id}. Check your UPI app.`
        );
      }
      await admin.service.from("notifications").insert({
        user_id: row.worker_id,
        type: "payout_sent",
        content: `₹${row.amount} has been sent to ${row.upi_id}.`,
        link: "/payouts",
      });
    } catch (e) {
      console.error("payout notify failed", e);
    }
  }

  return NextResponse.json({ success: true });
}
