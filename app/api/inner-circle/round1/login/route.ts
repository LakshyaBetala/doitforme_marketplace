// POST /api/inner-circle/round1/login
//
// Return-visit auth for the Round 1 portal. The candidate has already claimed
// their invite in the past (so there's a dob_hash on the row) and now wants
// back into the dashboard — a lost tab, a bookmarked URL, a different device.
//
// They provide {email, dob}. We look up by lower(email), re-hash the DOB
// against the row's token + pepper, and compare in constant time. Rate-
// limited at 5 fails per 15 min per row, tracked on the row itself to avoid
// adding a KV namespace just for this.
//
// The response is deliberately indistinguishable between "no such email" and
// "wrong DOB" — the same 401 and the same text — so a brute-force prober
// can't enumerate who signed up.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  CURRENT_COHORT,
  LOGIN_MAX_FAILS,
  LOGIN_WINDOW_SECONDS,
  Round1Row,
  SESSION_COOKIE,
  SESSION_SECONDS,
  constantTimeEqual,
  hashDob,
  missingBindings,
  normaliseDob,
  nowSeconds,
  round1Env,
  signSession,
  toPublicCandidate,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

const GENERIC_ERROR = "Email or date of birth doesn't match. Try again, or use the link in your invite email.";

type Body = { email?: string; dob?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const dob = normaliseDob(body.dob);
  if (!email || !dob) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/login] missing bindings:", missing);
    return NextResponse.json({ error: "The portal is unavailable right now." }, { status: 503 });
  }
  const db = e.WAITLIST!;

  const row = await db
    .prepare(
      "SELECT * FROM inner_circle_round1 WHERE cohort = ?1 AND lower(email) = ?2"
    )
    .bind(CURRENT_COHORT, email)
    .first<Round1Row>();

  // Fake-work path: even when we have no row, we hash something so timing
  // between "unknown email" and "wrong DOB" is similar. This isn't a perfect
  // defence (DB round-trip time differs), but it closes the obvious gap.
  if (!row || !row.dob_hash) {
    await hashDob(dob, "unknown-salt", e.ROUND1_DOB_PEPPER!);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  const now = nowSeconds();

  // Rate limit check.
  const windowStart = row.login_fail_window_start || 0;
  const inWindow = now - windowStart < LOGIN_WINDOW_SECONDS;
  if (inWindow && row.login_fail_count >= LOGIN_MAX_FAILS) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const expected = await hashDob(dob, row.token, e.ROUND1_DOB_PEPPER!);
  if (!constantTimeEqual(expected, row.dob_hash)) {
    // Increment fail counter, reset the window if it had expired.
    const newCount = inWindow ? row.login_fail_count + 1 : 1;
    const newStart = inWindow ? windowStart : now;
    await db
      .prepare(
        "UPDATE inner_circle_round1 SET login_fail_count = ?1, login_fail_window_start = ?2 WHERE id = ?3"
      )
      .bind(newCount, newStart, row.id)
      .run();
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  // Success — clear the fail counter and set a session cookie.
  if (row.login_fail_count !== 0) {
    await db
      .prepare(
        "UPDATE inner_circle_round1 SET login_fail_count = 0, login_fail_window_start = NULL WHERE id = ?1"
      )
      .bind(row.id)
      .run();
  }

  const cookie = await signSession(row.id, e.ROUND1_SESSION_SECRET!);
  (await cookies()).set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });

  return NextResponse.json({ candidate: toPublicCandidate(row) });
}
