// GET /api/cron/inner-circle-round1-send
//
// Automated drain of the Round 1 Sales invite queue. Called by the Cloudflare
// cron Worker every 15 minutes with x-cron-secret.
//
// WHY A CRON FOR THE SEND.
// The admin tab has a "Send next batch (90)" button that does this per click.
// On a 1,500+ person cohort that's a lot of clicks spaced evenly through the
// day, and the only way to run during sleep was to leave an admin logged in
// clicking on a timer. The cron automates the clicks.
//
// SAFETY: autosend is OFF by default.
// The route only sends when env.ROUND1_AUTOSEND === "1". Default (var unset or
// anything else) is a no-op that returns { status: "paused" }. Turning on the
// drain is a one-value env change in the Cloudflare dashboard; turning it off
// is the same. No code deploy needed either way.
//
// RATE: 75 per tick is deliberate.
// Brevo Starter is 300/hour and the cron ticks every 15 min → 300/hour even
// with a bit of headroom. If you move to a higher plan or a different
// provider, raise ROUND1_AUTOSEND_LIMIT (env var) to whatever pace you want.
//
// IDEMPOTENT.
// runInviteBatch's SELECT excludes already-invited rows, and the UNIQUE
// (cohort, email) constraint stops double-inserts even if two ticks race.
// An empty pool returns { invited: 0 } and the cron is a no-op.

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { missingBindings, round1Env } from "@/lib/innerCircleRound1";
import { runInviteBatch } from "@/lib/round1InviteBatch";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 75;
const MAX_LIMIT = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Autosend flag — the operator-visible ON/OFF switch. Stays paused by
  // default so a deploy during a campaign can't accidentally resume a send
  // that the admin had stopped. Case-insensitive but only "1" is accepted;
  // "true"/"yes" are not, deliberately — one keyword, no ambiguity.
  const autosend = process.env.ROUND1_AUTOSEND === "1";
  if (!autosend) {
    return NextResponse.json({ status: "paused", reason: "ROUND1_AUTOSEND != '1'" });
  }

  const configuredLimit = Number(process.env.ROUND1_AUTOSEND_LIMIT) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, configuredLimit));

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/send-cron] missing bindings:", missing);
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;

  const result = await runInviteBatch(db, { limit, createOnly: false });
  console.log("[round1/send-cron] tick:", JSON.stringify(result));

  return NextResponse.json({
    status: "ran",
    ...result,
  });
}
