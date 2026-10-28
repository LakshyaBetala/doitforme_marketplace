// POST /api/inner-circle/round1/switch-tech
//
// The invite went to everyone who ticked Inner Circle on the hold page,
// including people who said they want to BUILD (TECH) rather than sell
// (OUTREACH). This endpoint lets them opt into the Tech cohort instead of
// silently churning out of Sales. It:
//
//   1. Flips the waitlist row's inner_circle_role to 'TECH' (updates intent
//      we already captured, overrides a blank or OUTREACH value).
//   2. Marks the Round 1 candidate row as 'switched_to_tech' so admin can
//      see where they went and reminders stop firing.
//
// One-way by design. No "switch back" link — if someone truly meant Sales
// after all, they can reply to the invite email and we'll flip them back by
// hand. Switching should be a decision, not a toggle people flip twice.

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  Round1Row,
  missingBindings,
  nowSeconds,
  round1Env,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

type Body = { token?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/switch-tech] missing bindings:", missing);
    return NextResponse.json({ error: "Portal unavailable." }, { status: 503 });
  }
  const db = e.WAITLIST!;

  const row = await db
    .prepare("SELECT * FROM inner_circle_round1 WHERE token = ?1")
    .bind(token)
    .first<Round1Row>();

  if (!row) {
    return NextResponse.json({ error: "This invite link isn't valid." }, { status: 404 });
  }

  // Submitted candidates have already done the Sales work — don't let a
  // stray click undo their submission. If they want to switch after
  // submitting, that's a conversation, not a one-click.
  if (row.status === "submitted" || row.status === "advanced" || row.status === "rejected") {
    return NextResponse.json(
      { error: "You've already submitted Round 1 — reply to the invite email if you'd like to switch sides." },
      { status: 409 }
    );
  }

  if (row.status === "switched_to_tech") {
    return NextResponse.json({ ok: true, alreadySwitched: true });
  }

  const now = nowSeconds();

  // Both writes in the same D1 batch so we don't end up with a round1 row
  // flagged as switched while the waitlist still reads OUTREACH.
  await db.batch([
    db
      .prepare(
        `UPDATE inner_circle_round1
         SET status = 'switched_to_tech',
             next_reminder_at = NULL,
             decided_at = ?1
         WHERE id = ?2`
      )
      .bind(now, row.id),
    db
      .prepare(
        `UPDATE waitlist
         SET inner_circle = 1,
             inner_circle_role = 'TECH'
         WHERE lower(email) = ?1`
      )
      .bind(row.email.toLowerCase()),
  ]);

  return NextResponse.json({ ok: true, alreadySwitched: false });
}
