// GET /api/admin/inner-circle-round1/list
//
// Admin desk feed for the Round 1 queue. Returns every candidate row for the
// requested cohort along with a status breakdown. Supports a `status` filter
// (comma-separated) and a `needsDecision` flag (submitted but not decided).
//
// Query params:
//   cohort         default = CURRENT_COHORT
//   status         e.g. "submitted,started"  (comma-separated, optional)
//   needsDecision  "1" to show only submissions awaiting admin action
//   limit          default 1000, max 2000 (we have ~600 candidates total)

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminEmail } from "@/lib/admins";
import {
  CURRENT_COHORT,
  Round1Row,
  missingBindings,
  round1Env,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set([
  "invited",
  "started",
  "submitted",
  "expired",
  "advanced",
  "rejected",
  "switched_to_tech",
]);

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const cohort = url.searchParams.get("cohort") || CURRENT_COHORT;
  const statusFilter = (url.searchParams.get("status") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID_STATUS.has(s));
  const needsDecision = url.searchParams.get("needsDecision") === "1";
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get("limit")) || 1000));

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/list] missing bindings:", missing);
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;

  // Build the WHERE dynamically. We cap filter length and whitelist values
  // above, so building the IN clause from a known-safe array is fine.
  const whereParts: string[] = ["cohort = ?1"];
  const binds: unknown[] = [cohort];
  if (statusFilter.length) {
    const placeholders = statusFilter.map((_, i) => `?${binds.length + i + 1}`).join(",");
    whereParts.push(`status IN (${placeholders})`);
    binds.push(...statusFilter);
  }
  if (needsDecision) {
    whereParts.push("status = 'submitted'");
  }
  const whereSql = whereParts.join(" AND ");

  const rows = await db
    .prepare(
      `SELECT * FROM inner_circle_round1 WHERE ${whereSql} ORDER BY invited_at ASC LIMIT ?${binds.length + 1}`
    )
    .bind(...binds, limit)
    .all<Round1Row>();

  // Aggregate counts by status for the top-of-tab summary. Counting in SQL
  // because PostgREST would silently cap at 1000 rows if we counted in JS;
  // D1 has no such cap but the pattern is the same — count where the data is.
  const breakdown = await db
    .prepare(
      `SELECT status, COUNT(*) AS n
       FROM inner_circle_round1
       WHERE cohort = ?1
       GROUP BY status`
    )
    .bind(cohort)
    .all<{ status: string; n: number }>();

  return NextResponse.json({
    cohort,
    candidates: rows.results || [],
    breakdown: breakdown.results || [],
    total: (rows.results || []).length,
  });
}
