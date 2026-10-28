// POST /api/inner-circle/round1/submit
//
// Candidate submits their Google Sheet URL. We validate the host (must be
// docs.google.com), refuse if the deadline has passed, flip the row to
// 'submitted', cancel future reminders, and fire the confirmation email.
//
// The email send is fire-and-forget — if ZeptoMail is down we don't block
// the submission from being recorded. The candidate still sees the "we got
// it" screen and the admin still sees the submission; a missing confirmation
// email is a nuisance, a lost submission is unforgivable.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sendEmail } from "@/lib/email";
import {
  Round1Row,
  SESSION_COOKIE,
  isValidSubmissionUrl,
  sheetIdOf,
  missingBindings,
  nowSeconds,
  round1Env,
  toPublicCandidate,
  verifySession,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

type Body = { submissionUrl?: string };

export async function POST(req: Request) {
  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    console.error("[round1/submit] missing bindings:", missing);
    return NextResponse.json({ error: "Portal unavailable." }, { status: 503 });
  }

  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(cookie, e.ROUND1_SESSION_SECRET!);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const submissionUrl = typeof body.submissionUrl === "string" ? body.submissionUrl.trim() : "";
  if (!submissionUrl || !isValidSubmissionUrl(submissionUrl)) {
    return NextResponse.json(
      { error: "Please paste a Google Sheets link (docs.google.com/spreadsheets/...)." },
      { status: 400 }
    );
  }
  // The likeliest honest mistake: pasting the link we handed out instead of
  // the copy they filled in. Accepting it closes their Round 1 on a blank sheet.
  const templateId = sheetIdOf(e.ROUND1_SALES_SHEET_TEMPLATE_URL || "");
  if (templateId && sheetIdOf(submissionUrl) === templateId) {
    return NextResponse.json(
      {
        error:
          "That's our blank template. Make your own copy (File → Make a copy), fill it in, and paste the link to your copy.",
      },
      { status: 400 }
    );
  }

  const db = e.WAITLIST!;
  const row = await db
    .prepare("SELECT * FROM inner_circle_round1 WHERE id = ?1")
    .bind(session.id)
    .first<Round1Row>();
  if (!row) return NextResponse.json({ error: "Session invalid." }, { status: 401 });

  const now = nowSeconds();

  if (row.status === "expired") {
    return NextResponse.json(
      { error: "Your Round 1 window has already closed." },
      { status: 410 }
    );
  }
  if (row.status === "submitted") {
    // Idempotent re-submit: update the URL, don't double-email.
    await db
      .prepare(
        "UPDATE inner_circle_round1 SET submission_url = ?1 WHERE id = ?2"
      )
      .bind(submissionUrl, row.id)
      .run();
    return NextResponse.json({ candidate: toPublicCandidate({ ...row, submission_url: submissionUrl }) });
  }
  if (row.status !== "started" || !row.deadline_at) {
    return NextResponse.json({ error: "This task isn't open for submission." }, { status: 409 });
  }
  if (now > row.deadline_at) {
    return NextResponse.json(
      { error: "Your Round 1 window has already closed." },
      { status: 410 }
    );
  }

  await db
    .prepare(
      `UPDATE inner_circle_round1
       SET status = 'submitted',
           submission_url = ?1,
           submitted_at = ?2,
           next_reminder_at = NULL
       WHERE id = ?3 AND status = 'started'`
    )
    .bind(submissionUrl, now, row.id)
    .run();

  // Fire-and-forget confirmation email.
  sendEmail("inner_circle_round1_submitted", {
    to: row.email,
    recipientName: row.name,
  }).catch((err) => {
    console.error("[round1/submit] confirmation email failed:", err);
  });

  const updated: Round1Row = {
    ...row,
    status: "submitted",
    submission_url: submissionUrl,
    submitted_at: now,
    next_reminder_at: null,
  };
  return NextResponse.json({ candidate: toPublicCandidate(updated) });
}
