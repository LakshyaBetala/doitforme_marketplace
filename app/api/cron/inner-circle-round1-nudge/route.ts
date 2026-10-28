// GET /api/cron/inner-circle-round1-nudge
//
// Called by the Cloudflare cron Worker every 15 minutes with x-cron-secret.
// Two passes against the inner_circle_round1 table:
//
//   1. REMINDERS. For every started candidate whose next_reminder_at has
//      been crossed, fire the right reminder (12h / 6h / 3h / 30m before
//      deadline), append the bucket to reminders_sent, advance
//      next_reminder_at to the next tick (or NULL if we're past 30m).
//
//   2. EXPIRY. For every started candidate whose deadline has passed with
//      no submission, flip to 'expired' and fire the _expired email.
//
// Both passes are idempotent — rerunning the cron does nothing new because
// reminders_sent gates re-sends and status != 'started' excludes expired
// rows. The route is intentionally the ONLY place that fires these emails.

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sendEmail } from "@/lib/email";
import {
  REMINDER_BUCKETS,
  ReminderKey,
  Round1Row,
  dueReminderBucket,
  missingBindings,
  nextReminderAt,
  nowSeconds,
  parseRemindersSent,
  round1Env,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

// Hard cap so a bug in the SELECT can't fire thousands of emails in one tick.
const MAX_PER_TICK = 200;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/nudge] missing bindings:", missing);
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;
  const now = nowSeconds();

  // ─── Pass 1: reminders ────────────────────────────────────────────────
  // "next_reminder_at IS NOT NULL AND <= now" is the index condition. We
  // still re-check the bucket inside the loop in case reminders_sent moved
  // ahead between the SELECT and the UPDATE (which it can't on D1 right
  // now, but the check is cheap and future-proof).
  const dueRows = await db
    .prepare(
      `SELECT * FROM inner_circle_round1
       WHERE status = 'started'
         AND next_reminder_at IS NOT NULL
         AND next_reminder_at <= ?1
       ORDER BY next_reminder_at ASC
       LIMIT ?2`
    )
    .bind(now, MAX_PER_TICK)
    .all<Round1Row>();

  const remindersSent: Array<{ email: string; bucket: ReminderKey }> = [];
  const remindersFailed: Array<{ email: string; reason: string }> = [];

  for (const row of dueRows.results || []) {
    if (!row.deadline_at) continue;
    const sent = parseRemindersSent(row.reminders_sent);
    const bucket = dueReminderBucket(row.deadline_at, now, sent);
    if (!bucket) {
      // Clear next_reminder_at — nothing to send on this row anymore.
      await db
        .prepare(
          "UPDATE inner_circle_round1 SET next_reminder_at = NULL WHERE id = ?1 AND status = 'started'"
        )
        .bind(row.id)
        .run();
      continue;
    }

    // Mark as sent FIRST, then send. If the DB update succeeds but the
    // email send fails, we won't spam the candidate when the cron reruns —
    // better a missed reminder than four duplicates in a row.
    const nextSent: ReminderKey[] = [...sent, bucket];
    const nextTick = nextReminderAt(row.deadline_at, nextSent, now);
    await db
      .prepare(
        `UPDATE inner_circle_round1
         SET reminders_sent = ?1, next_reminder_at = ?2
         WHERE id = ?3 AND status = 'started'`
      )
      .bind(JSON.stringify(nextSent), nextTick, row.id)
      .run();

    const hoursLeft = Math.max(0, (row.deadline_at - now) / 3600);
    const result = await sendEmail("inner_circle_round1_reminder", {
      to: row.email,
      recipientName: row.name,
      extra: { token: row.token, hoursLeft },
    });
    if (result.ok) {
      remindersSent.push({ email: row.email, bucket });
    } else {
      remindersFailed.push({ email: row.email, reason: result.skipped || "unknown" });
    }
  }

  // ─── Pass 2: expiry ───────────────────────────────────────────────────
  const expiredRows = await db
    .prepare(
      `SELECT * FROM inner_circle_round1
       WHERE status = 'started'
         AND deadline_at IS NOT NULL
         AND deadline_at < ?1
       LIMIT ?2`
    )
    .bind(now, MAX_PER_TICK)
    .all<Round1Row>();

  const expired: string[] = [];
  for (const row of expiredRows.results || []) {
    await db
      .prepare(
        `UPDATE inner_circle_round1
         SET status = 'expired', next_reminder_at = NULL
         WHERE id = ?1 AND status = 'started'`
      )
      .bind(row.id)
      .run();

    const result = await sendEmail("inner_circle_round1_expired", {
      to: row.email,
      recipientName: row.name,
    });
    expired.push(row.email);
    if (!result.ok) {
      console.error("[round1/nudge] expiry email failed for", row.email, result.skipped);
    }
  }

  return NextResponse.json({
    now,
    remindersSent: remindersSent.length,
    remindersFailed: remindersFailed.length,
    expired: expired.length,
    buckets: REMINDER_BUCKETS.map((b) => b.key),
    // Short samples for visibility in the cron log line.
    sampleReminders: remindersSent.slice(0, 3),
    sampleFailures: remindersFailed.slice(0, 3),
    sampleExpired: expired.slice(0, 3),
  });
}
