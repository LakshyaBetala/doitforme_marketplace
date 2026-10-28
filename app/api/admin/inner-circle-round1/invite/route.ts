// POST /api/admin/inner-circle-round1/invite
//
// Operator action from the admin desk: send out the next batch of invites.
// Each click pulls N uninvited waitlist rows (people who ticked Inner Circle,
// chose Sales or "not sure yet" -- never TECH -- and have no row in
// inner_circle_round1 for this cohort yet, Sales side first), creates
// candidate rows with fresh tokens, and fires the invite email.
//
// Idempotent by the UNIQUE (cohort, email) constraint on inner_circle_round1
// — a double click can't produce two rows for the same person. The email
// cap is the real reason this is batched: on Brevo's free tier (300/day), 90
// per run leaves headroom for reminders and admin decisions.
//
// Body: { limit?: number (default 90), dryRun?: boolean (default false) }

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sendEmail } from "@/lib/email";
import { isAdminEmail } from "@/lib/admins";
import {
  CURRENT_COHORT,
  computeCampaignClose,
  generateToken,
  missingBindings,
  nowSeconds,
  round1Env,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

type Body = { limit?: number; dryRun?: boolean; createOnly?: boolean };

const DEFAULT_BATCH = 90;
// Create-only mode skips the per-row email send, so there's no provider rate
// limit to respect. Cap higher so operators who are mail-merging from Gmail
// can generate the whole 1,300-row set in one or two clicks.
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
  // Create-only generates D1 rows (and tokens) without sending any email.
  // Use when mail-merging from Gmail / Zoho — then download the CSV from
  // /api/admin/inner-circle-round1/export-invites and send from there.
  const createOnly = body.createOnly === true;

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/invite] missing bindings:", missing);
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;

  // Candidates = waitlist rows with inner_circle=1 that are NOT yet in
  // inner_circle_round1 for the current cohort. LEFT JOIN beats NOT EXISTS
  // on D1 because it ships a single statement; the index on
  // waitlist(lower(email)) and the (cohort, email) uniqueness make the join
  // cheap on the ~600-row scale we're at.
  const targets = await db
    .prepare(
      `SELECT w.email AS email, w.name AS name, w.phone AS phone, w.college AS college
       FROM waitlist w
       LEFT JOIN inner_circle_round1 r
         ON r.cohort = ?1 AND lower(r.email) = lower(w.email)
       WHERE w.inner_circle = 1 AND r.id IS NULL AND w.intent = 'student'
         -- This is the SALES round. People who chose "Build the work" get
         -- their own round; inviting them here handed 242 builders a lead-list
         -- task and a "switch to Tech" escape hatch, in that order.
         AND coalesce(w.inner_circle_role, '') <> 'TECH'
       -- "Bring the work in" first, then "Not sure yet" (NULL role), each
       -- oldest-signup first. Live D1 2026-10-29: 188 OUTREACH, 893 undecided.
       ORDER BY CASE WHEN w.inner_circle_role = 'OUTREACH' THEN 0 ELSE 1 END,
                w.created_at ASC
       LIMIT ?2`
    )
    .bind(CURRENT_COHORT, limit)
    .all<WaitlistTarget>();

  const rows = targets.results || [];

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldInvite: rows.length,
      sample: rows.slice(0, 5).map((r) => r.email),
    });
  }

  const now = nowSeconds();
  const campaignClose = computeCampaignClose(now);

  // Cohort size for the "There are N of you" line in the invite letter.
  // Pulled once per batch and reused across every send — the number only
  // changes when a new signup lands and the batch's locked view is more
  // honest than racing the count mid-blast. A failure to read it falls
  // through to the invite template's hedged "hundreds of you" phrasing.
  let totalCohort: number | null = null;
  try {
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM waitlist WHERE inner_circle = 1")
      .first<{ n: number }>();
    if (row && typeof row.n === "number" && row.n > 0) totalCohort = row.n;
  } catch (err) {
    console.error("[round1/invite] cohort-count query failed, invite will use fallback phrasing:", err);
  }

  let invited = 0;
  let emailFailed = 0;
  const errors: string[] = [];

  // We insert and email per-row rather than batch-inserting first and then
  // mail-blasting. The reason is failure isolation: a single malformed row
  // or a Brevo 429 can be logged against its email without aborting the
  // whole batch, and the UNIQUE constraint stops a retry from double-
  // inserting the ones that already succeeded.
  for (const target of rows) {
    const token = generateToken();
    try {
      await db
        .prepare(
          `INSERT INTO inner_circle_round1
             (cohort, email, name, phone, college, token, invited_at, campaign_closes_at, status)
           VALUES
             (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'invited')
           ON CONFLICT (cohort, email) DO NOTHING`
        )
        .bind(
          CURRENT_COHORT,
          target.email,
          target.name,
          target.phone,
          target.college,
          token,
          now,
          campaignClose
        )
        .run();

      if (!createOnly) {
        // sendEmail is fire-and-forget by design (lib/email.ts); we await here
        // only so the batch pace matches the provider's rate limit (sequential
        // ~200ms calls = ~5/s, well under any transactional service's limit).
        const result = await sendEmail("inner_circle_round1_invite", {
          to: target.email,
          recipientName: target.name,
          extra: { token, totalCohort },
        });
        if (!result.ok) {
          emailFailed += 1;
          if (result.skipped) errors.push(`${target.email}: ${result.skipped}`);
        }
      }
      invited += 1;
    } catch (err) {
      errors.push(`${target.email}: ${err instanceof Error ? err.message : String(err)}`);
      console.error("[round1/invite] insert/send failed for", target.email, err);
    }
  }

  return NextResponse.json({
    cohort: CURRENT_COHORT,
    createOnly,
    attempted: rows.length,
    invited,
    emailFailed,
    errors: errors.slice(0, 20),
  });
}
