// POST /api/admin/inner-circle-round1/decide
//
// Flip a submitted candidate to 'advanced' or 'rejected'. The admin writes a
// written note either way — it's what the candidate sees and the record for
// a disputed decision later. The outcome email fires fire-and-forget using
// the templates added in lib/email.ts.
//
// Body: { candidateId: number, action: 'advance'|'reject', note: string, score?: number }

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sendEmail } from "@/lib/email";
import { isAdminEmail } from "@/lib/admins";
import {
  Round1Row,
  missingBindings,
  nowSeconds,
  round1Env,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

type Body = {
  candidateId?: number;
  action?: "advance" | "reject";
  note?: string;
  score?: number;
};

export async function POST(req: Request) {
  // Admin gate.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const adminEmail = user.email || "";

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const candidateId = Number(body.candidateId);
  const action = body.action;
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const score =
    body.score != null && Number.isFinite(Number(body.score))
      ? Math.max(0, Math.min(100, Math.floor(Number(body.score))))
      : null;

  if (!candidateId || (action !== "advance" && action !== "reject")) {
    return NextResponse.json({ error: "candidateId and action required" }, { status: 400 });
  }
  if (!note) {
    // Mandatory on purpose — the note is the human record and the body of the
    // email the candidate reads. Silence here would mean candidates get the
    // generic fallback copy, which reads like we didn't look.
    return NextResponse.json(
      { error: "A decision note is mandatory — it's what the candidate reads." },
      { status: 400 }
    );
  }

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/decide] missing bindings:", missing);
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;

  const row = await db
    .prepare("SELECT * FROM inner_circle_round1 WHERE id = ?1")
    .bind(candidateId)
    .first<Round1Row>();
  if (!row) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  // Only submitted rows are decidable. Advancing an unstarted or expired row
  // would be a reviewer mistake worth flagging in the UI, not something to
  // let through silently.
  if (row.status !== "submitted") {
    return NextResponse.json(
      { error: `Candidate is in '${row.status}', not 'submitted'. Only submitted rows can be decided.` },
      { status: 409 }
    );
  }

  const newStatus = action === "advance" ? "advanced" : "rejected";
  const now = nowSeconds();

  await db
    .prepare(
      `UPDATE inner_circle_round1
       SET status = ?1,
           admin_note = ?2,
           score = ?3,
           decided_at = ?4,
           decided_by = ?5
       WHERE id = ?6 AND status = 'submitted'`
    )
    .bind(newStatus, note, score, now, adminEmail, candidateId)
    .run();

  sendEmail(
    action === "advance" ? "inner_circle_round1_advanced" : "inner_circle_round1_rejected",
    {
      to: row.email,
      recipientName: row.name,
      extra: { note },
    }
  ).catch((err) => console.error("[round1/decide] outcome email failed:", err));

  return NextResponse.json({ ok: true, status: newStatus });
}
