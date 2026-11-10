// Shared batch-send logic for the Inner Circle · Round 1 Sales invites.
//
// Two call sites:
//   - app/api/admin/inner-circle-round1/invite/route.ts   admin button
//   - app/api/cron/inner-circle-round1-send/route.ts      drain cron
//
// Pulling this into one place was the only sane way to add the cron: the
// drain logic needs to match the admin logic exactly (same ORDER BY, same
// UNIQUE handling, same per-row failure isolation), and duplicating it meant
// a bug in one path would silently diverge from the other.
//
// This module does NOT authenticate. Both call sites must check their own
// auth (admin session or x-cron-secret) BEFORE calling runInviteBatch.

import { sendEmail } from "@/lib/email";
import {
  CURRENT_COHORT,
  D1Database,
  computeCampaignClose,
  generateToken,
  nowSeconds,
} from "@/lib/innerCircleRound1";

export interface InviteBatchResult {
  cohort: string;
  createOnly: boolean;
  attempted: number;
  invited: number;
  emailFailed: number;
  errors: string[];
}

type WaitlistTarget = {
  email: string;
  name: string | null;
  phone: string | null;
  college: string | null;
};

/**
 * Pull the next N uninvited waitlist rows and process them.
 *
 * `createOnly` skips the email send (for CSV mail-merge flows). The rows are
 * still inserted into inner_circle_round1 with tokens, so the admin desk can
 * see them and the CSV export can include the invite URLs.
 */
export async function runInviteBatch(
  db: D1Database,
  opts: { limit: number; createOnly: boolean }
): Promise<InviteBatchResult> {
  // Candidates = waitlist rows with inner_circle=1 that are NOT yet in
  // inner_circle_round1 for the current cohort. Same SELECT the admin route
  // used — the only thing that moved is where it lives.
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
    .bind(CURRENT_COHORT, opts.limit)
    .all<WaitlistTarget>();

  const rows = targets.results || [];
  const now = nowSeconds();
  const campaignClose = computeCampaignClose(now);

  // Cohort size for the "There are N of you" line in the invite letter. Pulled
  // once per batch and reused across every send — the number only changes when
  // a new signup lands and the batch's locked view is more honest than racing
  // the count mid-blast. A failure reads as "hundreds of you" at the template.
  let totalCohort: number | null = null;
  try {
    const row = await db
      .prepare("SELECT COUNT(*) AS n FROM waitlist WHERE inner_circle = 1")
      .first<{ n: number }>();
    if (row && typeof row.n === "number" && row.n > 0) totalCohort = row.n;
  } catch (err) {
    console.error("[round1/batch] cohort-count query failed, falling back:", err);
  }

  let invited = 0;
  let emailFailed = 0;
  const errors: string[] = [];

  // Insert and email per-row rather than batch-inserting first then mail-
  // blasting. Failure isolation: one bad row or provider 429 is logged and
  // skipped, the rest of the batch continues, and the UNIQUE constraint stops
  // a retry from double-inserting the ones that already succeeded.
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

      if (!opts.createOnly) {
        // sendEmail is fire-and-forget by design (lib/email.ts); we await here
        // only so sequential ~200ms calls stay inside provider rate limits.
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
      console.error("[round1/batch] insert/send failed for", target.email, err);
    }
  }

  return {
    cohort: CURRENT_COHORT,
    createOnly: opts.createOnly,
    attempted: rows.length,
    invited,
    emailFailed,
    errors: errors.slice(0, 20),
  };
}
