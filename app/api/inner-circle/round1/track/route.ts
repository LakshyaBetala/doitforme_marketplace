// POST /api/inner-circle/round1/track
//
// Append-only portal event logger. Called from the client on page views and
// button clicks that we want visible in the admin funnel but that don't
// cause a status transition. The only writes are to inner_circle_round1_events;
// this route never touches the main inner_circle_round1 row.
//
// Three auth modes, in order of preference:
//   1. Session cookie   — attached by /claim or /login; identifies the row.
//   2. Token in body    — the raw invite token; identifies the row.
//   3. Anonymous        — the event is logged with no candidate_id, which is
//                         still useful for coarse funnel counts.
//
// Fails open deliberately: a 500 here must never prevent the real action
// (claim, submit) from completing. The track() helper on the client should
// also treat failures as fire-and-forget.
//
// Body: { event: EventName, token?: string, metadata?: Record<string, unknown> }

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  CURRENT_COHORT,
  Round1Row,
  SESSION_COOKIE,
  isValidEventName,
  missingBindings,
  round1Env,
  verifySession,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

type Body = { event?: string; token?: string; metadata?: Record<string, unknown> };

// Analytics must never be able to starve the campaign. This endpoint takes no
// login, and every row it writes comes out of D1's 100k-rows-per-day free
// allowance -- the same allowance the hold page's signups and the portal's
// claims and submissions draw on. Unbounded, a loop hitting it about once a
// second spends the day's writes and then signups and Round 1 submissions fail
// until midnight UTC. So: no candidate, no row (the admin funnel already
// ignores candidate_id IS NULL, so nothing reported is lost), and each
// candidate is capped per hour, far above anything a real browser sends.
const EVENTS_PER_CANDIDATE_PER_HOUR = 120;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!isValidEventName(body.event)) {
    return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  // If the D1 binding is missing we silently 204 — track() is best-effort.
  if (missingBindings(e).includes("WAITLIST")) return new Response(null, { status: 204 });
  const db = e.WAITLIST!;

  // Resolve candidate_id, best-effort. Session cookie is the authoritative
  // path; the token in body is a fallback for events fired BEFORE claim
  // (e.g. invite_opened); anonymous is fine too.
  let candidateId: number | null = null;
  try {
    const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
    if (cookie && e.ROUND1_SESSION_SECRET) {
      const session = await verifySession(cookie, e.ROUND1_SESSION_SECRET);
      if (session) candidateId = session.id;
    }
    if (!candidateId && body.token) {
      const row = await db
        .prepare("SELECT id FROM inner_circle_round1 WHERE token = ?1")
        .bind(body.token)
        .first<Pick<Round1Row, "id">>();
      if (row) candidateId = row.id;
    }
  } catch (err) {
    console.error("[round1/track] candidate lookup failed:", err);
  }

  const tokenPrefix = body.token ? String(body.token).slice(0, 8) : null;
  const userAgent = (req.headers.get("user-agent") || "").slice(0, 200);
  const metadata = body.metadata ? JSON.stringify(body.metadata).slice(0, 2000) : null;

  if (!candidateId) return new Response(null, { status: 204 });

  try {
    const recent = await db
      .prepare(
        "SELECT count(*) AS n FROM inner_circle_round1_events WHERE candidate_id = ?1 AND occurred_at > unixepoch() - 3600"
      )
      .bind(candidateId)
      .first<{ n: number }>();
    if ((recent?.n ?? 0) >= EVENTS_PER_CANDIDATE_PER_HOUR) return new Response(null, { status: 204 });

    await db
      .prepare(
        `INSERT INTO inner_circle_round1_events
           (candidate_id, cohort, event, metadata, token_prefix, user_agent)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      )
      .bind(candidateId, CURRENT_COHORT, body.event, metadata, tokenPrefix, userAgent)
      .run();
  } catch (err) {
    // Best-effort: if the events table doesn't exist yet (migration not
    // applied), swallow the error so the portal still works. The admin tab
    // will show zero events, which is a visible-and-fixable state.
    console.error("[round1/track] insert failed:", err);
  }

  return new Response(null, { status: 204 });
}
