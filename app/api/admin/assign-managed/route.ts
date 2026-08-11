import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Managed Mode admin desk.
// GET  -> the queue of managed gigs awaiting assignment (+ the Elite pool to pick from).
// POST -> assign a chosen student to a managed gig, notify them, and create the
//         escrow tracking row. Mirrors the public accept-offer flow but the
//         *admin* is the one choosing the worker (no public application needed).

const ADMINS = ["betala911@gmail.com", "doitforme.in@gmail.com"];

async function requireAdmin(): Promise<{ service: any } | { error: NextResponse }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!ADMINS.includes(user.email || "")) {
    return { error: NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 }) };
  }
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return { service };
}

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const service = admin.service;

  const { data: queue, error: queueErr } = await service
    .from("gigs")
    .select("id, title, description, price, category, created_at, managed_status, poster_id, assigned_worker_id")
    .eq("is_managed", true)
    .in("managed_status", ["UNASSIGNED", "ASSIGNED", "DELIVERED"])
    .order("created_at", { ascending: true });

  if (queueErr) return NextResponse.json({ error: queueErr.message }, { status: 500 });

  // Candidate pool for assignment — Elite first, then everyone reasonably active.
  const { data: pool } = await service
    .from("users")
    .select("id, name, username, email, is_elite, jobs_completed, rating, skills")
    .order("is_elite", { ascending: false })
    .order("jobs_completed", { ascending: false })
    .limit(100);

  return NextResponse.json({ queue: queue || [], pool: pool || [] });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const service = admin.service;

  try {
    const { gigId, workerId } = await req.json();
    if (!gigId || !workerId) {
      return NextResponse.json({ error: "gigId and workerId are required" }, { status: 400 });
    }

    const { data: gig, error: gigErr } = await service
      .from("gigs")
      .select("id, title, price, poster_id, is_managed")
      .eq("id", gigId)
      .single();
    if (gigErr || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });
    if (!gig.is_managed) return NextResponse.json({ error: "Not a managed gig" }, { status: 400 });

    // Assign + move gig into the active state.
    const { error: updErr } = await service
      .from("gigs")
      .update({ assigned_worker_id: workerId, status: "assigned", managed_status: "ASSIGNED" })
      .eq("id", gigId);
    if (updErr) throw updErr;

    // Create / upsert an approved application so the rest of the lifecycle
    // (delivery, escrow, payout) keys off it exactly like the self-serve path.
    await service.from("applications").upsert(
      {
        gig_id: gigId,
        worker_id: workerId,
        status: "approved",
        pitch: "Assigned by DoItForMe (Managed).",
        payment_preference: "ESCROW",
      },
      { onConflict: "gig_id, worker_id" }
    );

    // Escrow tracking row (no money held yet — funded when the poster pays).
    await service.from("escrow").insert({
      gig_id: gigId,
      worker_id: workerId,
      poster_id: gig.poster_id,
      original_amount: gig.price,
      amount_held: 0,
      status: "HELD",
      escrow_category: "GIG",
    });

    // Notify the assigned student (Telegram + email + in-app).
    try {
      const { data: worker } = await service
        .from("users")
        .select("telegram_chat_id, email, name")
        .eq("id", workerId)
        .single();

      if (worker?.telegram_chat_id) {
        const { sendTelegramAlert } = await import("@/lib/telegram");
        await sendTelegramAlert(
          worker.telegram_chat_id,
          `🎯 <b>You've been assigned a Managed task!</b>\n<i>${gig.title}</i>\n<a href="https://doitforme.in/gig/${gigId}">View Details</a>`
        );
      }
      if (worker?.email) {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail("application_accepted", {
          to: worker.email,
          recipientName: worker.name,
          gigTitle: gig.title,
          gigId,
          amount: gig.price,
        });
      }
      await service.from("notifications").insert({
        user_id: workerId,
        type: "managed_assignment",
        content: `You've been assigned to "${gig.title}" by DoItForMe.`,
        link: `/gig/${gigId}`,
      });
    } catch (e) {
      console.error("Managed assignment notification failed:", e);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Assign Managed Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
