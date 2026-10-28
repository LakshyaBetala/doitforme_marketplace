// POST /api/inner-circle/round1/claim
//
// Called from the invite entry page when the candidate enters their DOB and
// clicks "Start my 24 hours". Three jobs:
//
//   1. Verify the invite token exists and the cohort hasn't closed.
//   2. On a FIRST claim: hash the DOB with the per-row token as salt and the
//      Worker pepper, flip the row to 'started', set deadline_at and the
//      first reminder tick.
//   3. On a RETURN claim (same token, candidate re-entered DOB): verify the
//      hash matches, don't restart the timer, just mint a fresh session.
//
// Idempotency matters here. A candidate may click the invite link, close the
// tab mid-way, and come back — the timer should not bump every time.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  Round1Row,
  SESSION_COOKIE,
  SESSION_SECONDS,
  computeDeadline,
  constantTimeEqual,
  hashDob,
  missingBindings,
  nextReminderAt,
  normaliseDob,
  nowSeconds,
  round1Env,
  signSession,
  toPublicCandidate,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

type Body = { token?: string; dob?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const dob = normaliseDob(body.dob);
  if (!token || !dob) {
    return NextResponse.json(
      { error: "Please enter a valid date of birth to begin." },
      { status: 400 }
    );
  }

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/claim] missing bindings:", missing);
    return NextResponse.json({ error: "The portal is unavailable right now." }, { status: 503 });
  }
  const db = e.WAITLIST!;

  const row = await db
    .prepare("SELECT * FROM inner_circle_round1 WHERE token = ?1")
    .bind(token)
    .first<Round1Row>();

  if (!row) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }

  const now = nowSeconds();

  // Hard close — day 7 of the campaign. No new starts after this moment.
  if (!row.started_at && now > row.campaign_closes_at) {
    return NextResponse.json(
      { error: "This cohort has closed. We'll be in touch about the next one." },
      { status: 410 }
    );
  }

  if (row.status === "switched_to_tech") {
    return NextResponse.json(
      { error: "You moved to the Tech cohort — this link no longer applies." },
      { status: 410 }
    );
  }

  const cookieStore = await cookies();
  const sessionCookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS };

  // Already decided — just hand back the session so the dashboard can render
  // the outcome. No DOB check: an admin decision isn't blocked on it.
  if (row.status === "advanced" || row.status === "rejected") {
    const cookie = await signSession(row.id, e.ROUND1_SESSION_SECRET!);
    cookieStore.set(SESSION_COOKIE, cookie, sessionCookie);
    return NextResponse.json({ candidate: toPublicCandidate(row) });
  }

  // Already started — verify DOB and mint a fresh session. We DO NOT restart
  // the timer on repeat visits; that's the whole point of this branch.
  if (row.started_at && row.dob_hash) {
    const expected = await hashDob(dob, token, e.ROUND1_DOB_PEPPER!);
    if (!constantTimeEqual(expected, row.dob_hash)) {
      return NextResponse.json(
        { error: "That date of birth doesn't match the one on this invite." },
        { status: 401 }
      );
    }
    const cookie = await signSession(row.id, e.ROUND1_SESSION_SECRET!);
    cookieStore.set(SESSION_COOKIE, cookie, sessionCookie);
    return NextResponse.json({ candidate: toPublicCandidate(row) });
  }

  // First claim. Flip to started and set the deadline + first reminder tick.
  const dobHash = await hashDob(dob, token, e.ROUND1_DOB_PEPPER!);
  const startedAt = now;
  const deadlineAt = computeDeadline(startedAt);
  const firstReminder = nextReminderAt(deadlineAt, [], startedAt);

  await db
    .prepare(
      `UPDATE inner_circle_round1
       SET dob_hash = ?1,
           status = 'started',
           started_at = ?2,
           deadline_at = ?3,
           next_reminder_at = ?4
       WHERE id = ?5 AND status = 'invited'`
    )
    .bind(dobHash, startedAt, deadlineAt, firstReminder, row.id)
    .run();

  const updated: Round1Row = {
    ...row,
    dob_hash: dobHash,
    status: "started",
    started_at: startedAt,
    deadline_at: deadlineAt,
    next_reminder_at: firstReminder,
    reminders_sent: row.reminders_sent || "[]",
  };

  const cookie = await signSession(row.id, e.ROUND1_SESSION_SECRET!);
  cookieStore.set(SESSION_COOKIE, cookie, sessionCookie);

  return NextResponse.json({ candidate: toPublicCandidate(updated) });
}
