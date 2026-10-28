// GET /api/admin/inner-circle-round1/funnel
//
// Rolls the inner_circle_round1_events stream up into counts the admin tab
// can draw as a funnel. Two shapes are returned:
//
//   byEvent   — raw count per event name across the cohort
//   funnel    — the staged conversion funnel the panel actually draws:
//                 invited → opened → brief_read → started
//                 → dashboard_viewed → submitted → advanced
//
// Status counts (invited/started/submitted/advanced/rejected/expired/
// switched_to_tech) come from the main inner_circle_round1 table and are
// combined with event counts to produce the funnel steps.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminEmail } from "@/lib/admins";
import {
  CURRENT_COHORT,
  EVENT_NAMES,
  missingBindings,
  round1Env,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const cohort = url.searchParams.get("cohort") || CURRENT_COHORT;

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;

  // Status counts off the main row (same source the list endpoint uses).
  const statusRows = await db
    .prepare(
      `SELECT status, COUNT(*) AS n
       FROM inner_circle_round1
       WHERE cohort = ?1
       GROUP BY status`
    )
    .bind(cohort)
    .all<{ status: string; n: number }>();
  const byStatus: Record<string, number> = {};
  for (const r of statusRows.results || []) byStatus[r.status] = r.n;

  // Event counts, with DISTINCT candidate_id for the funnel so the same
  // person refreshing the page doesn't double-count conversions. The event
  // table may be missing (migration not yet applied) — fail soft to zeros.
  let byEventUnique: Record<string, number> = {};
  let byEventRaw: Record<string, number> = {};
  try {
    const uniqueRows = await db
      .prepare(
        `SELECT event, COUNT(DISTINCT candidate_id) AS n
         FROM inner_circle_round1_events
         WHERE cohort = ?1 AND candidate_id IS NOT NULL
         GROUP BY event`
      )
      .bind(cohort)
      .all<{ event: string; n: number }>();
    for (const r of uniqueRows.results || []) byEventUnique[r.event] = r.n;

    const rawRows = await db
      .prepare(
        `SELECT event, COUNT(*) AS n
         FROM inner_circle_round1_events
         WHERE cohort = ?1
         GROUP BY event`
      )
      .bind(cohort)
      .all<{ event: string; n: number }>();
    for (const r of rawRows.results || []) byEventRaw[r.event] = r.n;
  } catch (err) {
    console.error("[round1/funnel] events table missing or unreadable:", err);
  }

  // Totals the panel uses in headlines.
  const totalInvited = Object.values(byStatus).reduce((a, b) => a + b, 0);
  // "Started" below means "ever started", so anyone past 'invited' qualifies.
  const everStarted =
    (byStatus.started || 0) +
    (byStatus.submitted || 0) +
    (byStatus.expired || 0) +
    (byStatus.advanced || 0) +
    (byStatus.rejected || 0);
  const everSubmitted =
    (byStatus.submitted || 0) +
    (byStatus.advanced || 0) +
    (byStatus.rejected || 0);

  const funnel = [
    { step: "Invited",           count: totalInvited,                          hint: "waitlist rows with inner_circle=1 we've sent an invite to" },
    { step: "Opened invite",     count: byEventUnique.invite_opened || 0,       hint: "unique candidates who loaded the entry page" },
    { step: "Read the brief",    count: byEventUnique.brief_expanded || 0,      hint: "clicked 'I've read this' before clicking Start" },
    { step: "Started 24h task",  count: everStarted,                           hint: "DOB entered, timer running (or already ran)" },
    { step: "Viewed dashboard",  count: byEventUnique.dashboard_viewed || 0,    hint: "landed on the live task page after Start" },
    { step: "Submitted",         count: everSubmitted,                         hint: "sent in a Google Sheet URL before deadline" },
    { step: "Advanced to R2",    count: byStatus.advanced || 0,                 hint: "admin accepted their Round 1 submission" },
  ];

  return NextResponse.json({
    cohort,
    byStatus,
    byEventUnique,
    byEventRaw,
    funnel,
    knownEvents: EVENT_NAMES,
    now: Math.floor(Date.now() / 1000),
  });
}
