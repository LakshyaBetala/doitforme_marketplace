// GET /api/inner-circle/round1/me
//
// Returns the candidate state for the authenticated session. The dashboard
// polls this on load (and after a submit) rather than SSRing the page, so a
// tab left open across the deadline moment refreshes to the right state
// without needing a WebSocket. No PII beyond what the candidate themselves
// typed; see toPublicCandidate() for the exact shape.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  Round1Row,
  SESSION_COOKIE,
  missingBindings,
  round1Env,
  toPublicCandidate,
  verifySession,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

export async function GET() {
  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/me] missing bindings:", missing);
    return NextResponse.json({ error: "Portal unavailable." }, { status: 503 });
  }

  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(cookie, e.ROUND1_SESSION_SECRET!);
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const row = await e.WAITLIST!
    .prepare("SELECT * FROM inner_circle_round1 WHERE id = ?1")
    .bind(session.id)
    .first<Round1Row>();

  if (!row) {
    return NextResponse.json({ error: "Session invalid." }, { status: 401 });
  }

  return NextResponse.json({
    candidate: toPublicCandidate(row),
    templateUrl: e.ROUND1_SALES_SHEET_TEMPLATE_URL || null,
  });
}
