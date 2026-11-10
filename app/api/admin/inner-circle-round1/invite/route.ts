// POST /api/admin/inner-circle-round1/invite
//
// Operator action from the admin desk: send out the next batch of invites.
// Each click pulls N uninvited waitlist rows (people who ticked Inner Circle,
// chose Sales or "not sure yet" -- never TECH -- and have no row in
// inner_circle_round1 for this cohort yet, Sales side first), creates
// candidate rows with fresh tokens, and fires the invite email.
//
// The actual batch logic lives in lib/round1InviteBatch.ts so the drain cron
// at /api/cron/inner-circle-round1-send can share it exactly. This file is
// now just the admin-authentication wrapper around that helper.
//
// Idempotent by the UNIQUE (cohort, email) constraint on inner_circle_round1
// -- a double click can't produce two rows for the same person.
//
// Body: { limit?: number (default 90), dryRun?: boolean (default false),
//         createOnly?: boolean (default false) }

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminEmail } from "@/lib/admins";
import {
  CURRENT_COHORT,
  missingBindings,
  round1Env,
} from "@/lib/innerCircleRound1";
import { runInviteBatch } from "@/lib/round1InviteBatch";

export const dynamic = "force-dynamic";

type Body = { limit?: number; dryRun?: boolean; createOnly?: boolean };

const DEFAULT_BATCH = 90;
// Create-only mode skips per-row email send, so there's no provider rate limit
// to respect. Cap higher so operators mail-merging from Gmail can generate the
// whole 1,500-row set in one or two clicks.
const MAX_BATCH = 1500;

type WaitlistTarget = {
  email: string;
  name: string | null;
  phone: string | null;
  college: string | null;
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }
  const limit = Math.min(MAX_BATCH, Math.max(1, Number(body.limit) || DEFAULT_BATCH));
  const dryRun = body.dryRun === true;
  const createOnly = body.createOnly === true;

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/invite] missing bindings:", missing);
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;

  if (dryRun) {
    // Dry run stays inline: a separate code path that doesn't insert or send
    // is cheap to read and can't accidentally fire emails. The SELECT is the
    // same one runInviteBatch uses — if they drift, the batch route is wrong,
    // not the dry run.
    const targets = await db
      .prepare(
        `SELECT w.email AS email, w.name AS name, w.phone AS phone, w.college AS college
         FROM waitlist w
         LEFT JOIN inner_circle_round1 r
           ON r.cohort = ?1 AND lower(r.email) = lower(w.email)
         WHERE w.inner_circle = 1 AND r.id IS NULL AND w.intent = 'student'
           AND coalesce(w.inner_circle_role, '') <> 'TECH'
         ORDER BY CASE WHEN w.inner_circle_role = 'OUTREACH' THEN 0 ELSE 1 END,
                  w.created_at ASC
         LIMIT ?2`
      )
      .bind(CURRENT_COHORT, limit)
      .all<WaitlistTarget>();
    const rows = targets.results || [];
    return NextResponse.json({
      dryRun: true,
      wouldInvite: rows.length,
      sample: rows.slice(0, 5).map((r) => r.email),
    });
  }

  const result = await runInviteBatch(db, { limit, createOnly });
  return NextResponse.json(result);
}
