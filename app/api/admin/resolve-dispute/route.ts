import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { platformFeeFor, audienceForGig } from "@/lib/fees";

// Admin dispute desk.
//
// /api/gig/dispute lets a poster freeze escrow and mails both parties that we
// will review "within 48 hours" — but until this route existed there was no way
// to actually resolve one. A disputed gig sat with status='disputed' and the
// money held indefinitely, and the only exit was hand-written SQL.
//
// That is the shape of problem that ends as a chargeback: the customer cannot
// get an answer from us, so they ask their bank instead. Chargebacks are what
// get a merchant account restricted, so this desk is payment infrastructure,
// not an admin nicety.
//
// Two outcomes, mirroring the two ways money can legitimately move:
//   RELEASE — the work stands. Pays the recipient exactly the way
//             /api/cron/auto-release does, so a disputed gig and a normal one
//             settle through identical arithmetic.
//   REFUND  — the poster was right. Delegates to refund_escrow_transactional,
//             the same RPC the self-serve refund path uses.
//
// ADMINS duplicates the is_admin() SQL whitelist by design (see CLAUDE.md) —
// edit both together.
const ADMINS = ["betala911@gmail.com", "doitforme.in@gmail.com"];

async function requireAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!ADMINS.includes(user.email || "")) {
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

interface Party {
  id: string;
  name: string | null;
  email: string | null;
  upi_id: string | null;
}

interface Gig {
  id: string;
  title: string | null;
  price: number | null;
  status: string | null;
  escrow_status: string | null;
  payment_status: string | null;
  platform_fee: number | null;
  listing_type: string | null;
  market_type: string | null;
  security_deposit: number | null;
  company_id: string | null;
  poster_id: string;
  assigned_worker_id: string | null;
  delivery_link: string | null;
  delivery_files: string[] | null;
  poster: Party | null;
  worker: Party | null;
}

interface Dispute {
  id: string;
  gig_id: string;
  raised_by: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  // PostgREST returns an embedded to-one relation as either an object or a
  // single-element array depending on how it infers the relationship.
  gig: Gig | Gig[] | null;
}

const GIG_SELECT =
  "id, title, price, status, escrow_status, payment_status, platform_fee, listing_type, market_type," +
  " security_deposit, company_id, poster_id, assigned_worker_id, delivery_link, delivery_files," +
  " poster:users!poster_id(id, name, email, upi_id)," +
  " worker:users!assigned_worker_id(id, name, email, upi_id)";

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.service
    .from("disputes")
    .select(`id, gig_id, raised_by, reason, status, admin_notes, created_at, resolved_at, gig:gigs(${GIG_SELECT})`)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Open disputes first, then most recently resolved — the desk is a worklist.
  const rows = ((data || []) as unknown as Dispute[]).sort((a, b) => {
    const aOpen = a.status === "OPEN" ? 0 : 1;
    const bOpen = b.status === "OPEN" ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const open = rows.filter((r) => r.status === "OPEN");
  const oldestOpenHours = open.length
    ? Math.round((Date.now() - new Date(open[0].created_at).getTime()) / 3_600_000)
    : 0;

  return NextResponse.json({
    disputes: rows,
    open_count: open.length,
    // We promise a 48-hour turnaround in the Terms and in the dispute email.
    breaching_sla: open.filter(
      (r) => Date.now() - new Date(r.created_at).getTime() > 48 * 3_600_000
    ).length,
    oldest_open_hours: oldestOpenHours,
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;
  const supabase = admin.service;

  const { disputeId, outcome, notes } = (await req
    .json()
    .catch(() => ({}))) as { disputeId?: string; outcome?: string; notes?: string };

  if (!disputeId || (outcome !== "RELEASE" && outcome !== "REFUND")) {
    return NextResponse.json(
      { error: "disputeId and outcome ('RELEASE' | 'REFUND') are required" },
      { status: 400 }
    );
  }
  // Notes are mandatory: this is the written record of why money moved, and it
  // is what we would show a bank contesting a chargeback.
  if (!notes || String(notes).trim().length < 10) {
    return NextResponse.json(
      { error: "Please write at least a sentence explaining the decision." },
      { status: 400 }
    );
  }

  const { data: dispute, error: disputeErr } = await supabase
    .from("disputes")
    .select(`id, gig_id, raised_by, reason, status, gig:gigs(${GIG_SELECT})`)
    .eq("id", disputeId)
    .single();

  if (disputeErr || !dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (dispute.status !== "OPEN") {
    return NextResponse.json(
      { error: `Dispute is already ${dispute.status}.` },
      { status: 409 }
    );
  }

  const embedded = (dispute as unknown as Dispute).gig;
  const gig: Gig | null = (Array.isArray(embedded) ? embedded[0] : embedded) ?? null;
  if (!gig) return NextResponse.json({ error: "Gig not found for dispute" }, { status: 404 });

  const isMarket = gig.listing_type === "MARKET";
  const recipientId = isMarket ? gig.poster_id : gig.assigned_worker_id;

  if (outcome === "RELEASE") {
    if (!recipientId) {
      return NextResponse.json({ error: "Gig has no payout recipient." }, { status: 400 });
    }

    // Same arithmetic as /api/cron/auto-release: prefer the fee actually charged
    // at funding time, and only fall back to the current rate.
    const price = Number(gig.price) || 0;
    const storedFee = Number(gig.platform_fee) || 0;
    const platformFee = storedFee > 0 ? storedFee : platformFeeFor(price, audienceForGig(gig));
    const payoutAmount = Math.max(0, price - platformFee);

    if (isMarket && gig.market_type === "RENT" && Number(gig.security_deposit) > 0) {
      const { error } = await supabase.from("transactions").insert({
        gig_id: gig.id,
        user_id: gig.assigned_worker_id, // the renter
        amount: gig.security_deposit,
        type: "REFUND_CREDIT",
        status: "COMPLETED",
        description: `Dispute resolved: security deposit refund for ${gig.title}`,
      });
      if (error) {
        console.error(`[resolve-dispute] deposit refund insert failed gig=${gig.id}: ${error.message}`);
        return NextResponse.json({ error: `Deposit refund failed: ${error.message}` }, { status: 500 });
      }
    }

    const { error: feeErr } = await supabase.from("transactions").insert({
      gig_id: gig.id,
      amount: platformFee,
      type: "PLATFORM_FEE",
      status: "COMPLETED",
      description: "Dispute resolved: platform fee",
    });
    if (feeErr) {
      console.error(`[resolve-dispute] fee insert failed gig=${gig.id}: ${feeErr.message}`);
      return NextResponse.json({ error: `Fee write failed: ${feeErr.message}` }, { status: 500 });
    }

    const { error: payoutErr } = await supabase.from("transactions").insert({
      gig_id: gig.id,
      user_id: recipientId,
      amount: payoutAmount,
      type: "PAYOUT_CREDIT",
      status: "COMPLETED",
      description: `Dispute resolved in worker's favour: payout for ${gig.title}`,
    });
    if (payoutErr) {
      console.error(`[resolve-dispute] payout insert failed gig=${gig.id}: ${payoutErr.message}`);
      return NextResponse.json({ error: `Payout write failed: ${payoutErr.message}` }, { status: 500 });
    }

    const { error: gigErr } = await supabase
      .from("gigs")
      .update({
        status: "completed",
        escrow_status: "RELEASED",
        payment_status: "PAYOUT_PENDING",
        auto_release_at: null,
        dispute_reason: null,
      })
      .eq("id", gig.id);
    if (gigErr) {
      console.error(`[resolve-dispute] gig update failed gig=${gig.id}: ${gigErr.message}`);
      return NextResponse.json({ error: `Gig update failed: ${gigErr.message}` }, { status: 500 });
    }

    const { error: escrowErr } = await supabase
      .from("escrow")
      .update({ status: "RELEASED" })
      .eq("gig_id", gig.id);
    if (escrowErr) {
      console.error(`[resolve-dispute] escrow update failed gig=${gig.id}: ${escrowErr.message}`);
    }

    await supabase.rpc("increment_worker_stats", { worker_id: recipientId, amount: payoutAmount });
  } else {
    // REFUND — delegate to the same transactional RPC the self-serve path uses,
    // so a disputed refund and an ordinary one leave identical state behind.
    const { data: rpcData, error: rpcErr } = await supabase.rpc("refund_escrow_transactional", {
      p_gig_id: gig.id,
      p_poster_id: gig.poster_id,
    });
    if (rpcErr) {
      console.error(`[resolve-dispute] refund RPC failed gig=${gig.id}: ${rpcErr.message}`);
      return NextResponse.json({ error: rpcErr.message || "Refund failed" }, { status: 500 });
    }
    // The RPC reports failure in its return value, not as a Postgres error —
    // the same trap that made escrow releases silently no-op.
    if (rpcData && rpcData.success === false) {
      const reason = rpcData.error || "Refund refused";
      console.error(`[resolve-dispute] refund refused gig=${gig.id}: ${reason}`);
      return NextResponse.json({ error: reason }, { status: 400 });
    }

    const { error: gigErr } = await supabase
      .from("gigs")
      .update({ dispute_reason: null, auto_release_at: null })
      .eq("id", gig.id);
    if (gigErr) {
      console.error(`[resolve-dispute] gig clear failed gig=${gig.id}: ${gigErr.message}`);
    }
  }

  // RELEASE = the dispute was not upheld; REFUND = it was. The disputes table
  // constrains status to OPEN | RESOLVED | REJECTED.
  const { error: closeErr } = await supabase
    .from("disputes")
    .update({
      status: outcome === "REFUND" ? "RESOLVED" : "REJECTED",
      admin_notes: `[${admin.adminEmail}] ${String(notes).trim()}`,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", disputeId)
    .eq("status", "OPEN");

  if (closeErr) {
    console.error(`[resolve-dispute] dispute close failed id=${disputeId}: ${closeErr.message}`);
    return NextResponse.json({ error: `Money moved but dispute not closed: ${closeErr.message}` }, { status: 500 });
  }

  // Tell both sides what happened and why. Silence here is what turns a
  // resolved dispute into a chargeback.
  try {
    const { sendEmail } = await import("@/lib/email");
    const recipients = [gig.poster, gig.worker].filter(
      (u): u is Party & { email: string } => Boolean(u && u.email)
    );
    await Promise.all(
      recipients.map((u) =>
        sendEmail("dispute_resolved", {
          to: u.email,
          recipientName: u.name,
          gigTitle: gig.title,
          gigId: gig.id,
          extra: { outcome: outcome === "RELEASE" ? "released" : "refunded", notes: String(notes).trim() },
        })
      )
    );
  } catch (e) {
    console.error("[resolve-dispute] notification failed:", e);
  }

  return NextResponse.json({
    success: true,
    outcome,
    gigId: gig.id,
    message:
      outcome === "RELEASE"
        ? "Payment released to the recipient and queued for manual payout."
        : "Payment refunded to the poster.",
  });
}
