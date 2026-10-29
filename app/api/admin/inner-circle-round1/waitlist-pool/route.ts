// GET /api/admin/inner-circle-round1/waitlist-pool
//
// Returns the full eligible waitlist for Round 1 Sales — every student who
// ticked Inner Circle and is not in the TECH cohort — annotated with whether
// a candidate row already exists for them.
//
// This is the view the operator reaches for BEFORE sending: it answers
// "who's on deck?" without first having to generate candidate rows. The
// existing /list route is "who's in the campaign?"; this one is "who
// would the campaign be, if we ran it today?".
//
// Returns:
//   {
//     cohort: string,
//     total: number,          // every eligible waitlist row
//     invited: number,        // of those, how many already have a candidate row
//     pending: number,        // total - invited
//     byRole: {
//       OUTREACH: {total, invited, pending},
//       NULL:     {total, invited, pending},   // "not sure yet"
//     },
//     rows: Array<{
//       email, name, phone, college,
//       inner_circle_role: 'OUTREACH' | null,
//       created_at: number,
//       isInvited: boolean,
//       candidateStatus: Round1Status | null,  // if invited
//     }>
//   }
//
// Query params:
//   cohort   default = CURRENT_COHORT
//   limit    default 2000, max 2000 (D1 REST truncates at 1000 but the
//            prepared statement path handles 2000+ fine)
//   status   "pending" | "invited" | "all" (default)

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminEmail } from "@/lib/admins";
import {
  CURRENT_COHORT,
  Round1Status,
  missingBindings,
  round1Env,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

type PoolRow = {
  email: string;
  name: string | null;
  phone: string | null;
  college: string | null;
  inner_circle_role: string | null;
  created_at: number;
  candidate_status: Round1Status | null;
};

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
  const limit = Math.min(2000, Math.max(1, Number(url.searchParams.get("limit")) || 2000));
  const statusFilter = url.searchParams.get("status") || "all";

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;

  // LEFT JOIN on inner_circle_round1 so uninvited rows come back with
  // candidate_status = NULL. ORDER by role priority (OUTREACH first, then
  // NULL "not sure yet") then signup time — matches what the invite batch
  // actually sends.
  const result = await db
    .prepare(
      `SELECT w.email AS email,
              w.name AS name,
              w.phone AS phone,
              w.college AS college,
              w.inner_circle_role AS inner_circle_role,
              w.created_at AS created_at,
              r.status AS candidate_status
       FROM waitlist w
       LEFT JOIN inner_circle_round1 r
         ON r.cohort = ?1 AND lower(r.email) = lower(w.email)
       WHERE w.inner_circle = 1
         AND w.intent = 'student'
         AND coalesce(w.inner_circle_role, '') <> 'TECH'
       ORDER BY CASE WHEN w.inner_circle_role = 'OUTREACH' THEN 0 ELSE 1 END,
                w.created_at ASC
       LIMIT ?2`
    )
    .bind(cohort, limit)
    .all<PoolRow>();

  const rows = (result.results || []).map((r) => ({
    email: r.email,
    name: r.name,
    phone: r.phone,
    college: r.college,
    inner_circle_role: r.inner_circle_role,
    created_at: r.created_at,
    isInvited: r.candidate_status != null,
    candidateStatus: r.candidate_status,
  }));

  // Server-side filter the result set rather than doing it in SQL. The pool
  // isn't large (~1,300) and keeping the counts aligned with the filter means
  // the operator never sees "showing 90 of 1,322" where the 1,322 was computed
  // against a different predicate.
  const filtered =
    statusFilter === "pending" ? rows.filter((r) => !r.isInvited)
    : statusFilter === "invited" ? rows.filter((r) => r.isInvited)
    : rows;

  const counts = {
    total: rows.length,
    invited: rows.filter((r) => r.isInvited).length,
    pending: rows.filter((r) => !r.isInvited).length,
  };

  const byRole = {
    OUTREACH: {
      total: rows.filter((r) => r.inner_circle_role === "OUTREACH").length,
      invited: rows.filter((r) => r.inner_circle_role === "OUTREACH" && r.isInvited).length,
      pending: rows.filter((r) => r.inner_circle_role === "OUTREACH" && !r.isInvited).length,
    },
    UNDECIDED: {
      total: rows.filter((r) => !r.inner_circle_role).length,
      invited: rows.filter((r) => !r.inner_circle_role && r.isInvited).length,
      pending: rows.filter((r) => !r.inner_circle_role && !r.isInvited).length,
    },
  };

  return NextResponse.json({
    cohort,
    counts,
    byRole,
    rows: filtered,
  });
}
