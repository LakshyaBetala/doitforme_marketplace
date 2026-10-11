import { NextResponse } from "next/server";
import { requireAdmin, isGuardError } from "@/lib/adminGuard";
import {
  PROBATION,
  PROBATION_PASS_MARK,
  SCORECARD,
  SCORECARD_TOTAL,
  scoreFrom,
  type ScorecardKey,
} from "@/lib/agency";

/**
 * The paid trial: sending a round, and scoring it.
 *
 * WHY TWO ROUNDS, AND WHY THE SECOND ONE DECIDES. You cannot screen for
 * consistency. A test measures ability; consistency is a time series, so it can
 * only be observed. Round one shows whether someone CAN do the work. Round two,
 * with timing deliberately not announced, shows whether they do it again — and
 * that is the whole filter. Losing half the cohort between the rounds is the
 * mechanism working, not a problem with it.
 *
 * WHY THE SCORE IS MOSTLY NOT ABOUT CODE. SCORECARD puts 60 of 100 points on
 * shipping to the deadline and answering messages. On a three-week client deal
 * the brilliant developer who goes dark for four days is worse than the
 * adequate one who replies to everything, and scoring craft first is how you
 * assemble a team that is individually impressive and collectively late.
 *
 * WHY MARKS ARE STORED AND NOT ONLY THE TOTAL. The weights are a dial that will
 * be retuned, and a decision has to stay explicable under the weights it was
 * actually made with. Keeping only the number makes last quarter's rejections
 * unauditable.
 */

const ROLES = new Set(["TECH", "OUTREACH"]);
const MARK_KEYS = new Set<string>(SCORECARD.map((s) => s.key));

/** Tasks awaiting a score, oldest first — the queue, not the archive. */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (isGuardError(guard)) return guard.error;

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "pending";

  let q = guard.service
    .from("program_probation_tasks")
    .select(
      "id, application_id, user_id, role, round, gig_id, due_at, sent_at, marks, score, reviewed_at, notes, " +
        "users:user_id(name, email, college, kyc_verified)",
    )
    // Ordered, because an unordered limit is a permanent filter rather than a
    // page: the same arbitrary subset comes back every call and the rest of the
    // queue is unreachable for ever. That exact bug starved 316 gigs.
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(300);

  if (scope === "pending") q = q.is("reviewed_at", null);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    tasks: data ?? [],
    scorecard: SCORECARD,
    passMark: PROBATION_PASS_MARK,
    config: PROBATION,
  });
}

export async function POST(req: Request) {
  try {
    // Identity before body: see lib/adminGuard.ts.
    const guard = await requireAdmin();
    if (isGuardError(guard)) return guard.error;
    const { service, userId } = guard;

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
    }

    const action = String(body.action ?? "");

    /* ---------------------------------------------------------------- */
    /* Send a round                                                     */
    /* ---------------------------------------------------------------- */
    if (action === "send") {
      const targetUserId = String(body.userId ?? "");
      const role = String(body.role ?? "").toUpperCase();
      const round = Number(body.round ?? 1);

      if (!targetUserId || !ROLES.has(role) || ![1, 2].includes(round)) {
        return NextResponse.json(
          { error: "userId, role ('TECH'|'OUTREACH') and round (1|2) are required." },
          { status: 400 },
        );
      }

      // KYC is the floor for everything in the program, and it is already
      // enforced on the application insert policy. Checked again here because a
      // probation task can be sent to someone who never applied through the
      // form, which would otherwise route around the gate.
      const { data: target, error: userErr } = await service
        .from("users")
        .select("id, kyc_verified, name")
        .eq("id", targetUserId)
        .maybeSingle();
      if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
      if (!target) return NextResponse.json({ error: "No such user." }, { status: 404 });
      if (!target.kyc_verified) {
        return NextResponse.json(
          { error: "That student is not KYC verified. Verification comes before any paid work." },
          { status: 409 },
        );
      }

      // Round 2 only after round 1 has actually been scored. Sending both at
      // once would measure one burst of effort twice and tell you nothing about
      // whether they repeat.
      if (round === 2) {
        const { data: first } = await service
          .from("program_probation_tasks")
          .select("id, score, reviewed_at")
          .eq("user_id", targetUserId)
          .eq("role", role)
          .eq("round", 1)
          .maybeSingle();
        if (!first) {
          return NextResponse.json(
            { error: "Round 1 has not been sent yet." },
            { status: 409 },
          );
        }
        if (!first.reviewed_at) {
          return NextResponse.json(
            { error: "Score round 1 before sending round 2 — the gap is part of the test." },
            { status: 409 },
          );
        }
      }

      const cfg = role === "TECH" ? PROBATION.TECH : PROBATION.OUTREACH;
      const hours =
        "deadlineHours" in cfg ? cfg.deadlineHours : 72;
      const dueAt =
        typeof body.dueAt === "string" && body.dueAt
          ? new Date(body.dueAt).toISOString()
          : new Date(Date.now() + hours * 3600_000).toISOString();

      const { data: inserted, error: insErr } = await service
        .from("program_probation_tasks")
        .upsert(
          {
            application_id: (body.applicationId as string) || null,
            user_id: targetUserId,
            role,
            round,
            gig_id: (body.gigId as string) || null,
            due_at: dueAt,
            notes: String(body.notes ?? "") || null,
          },
          { onConflict: "user_id,role,round", ignoreDuplicates: false },
        )
        .select("id, round, due_at")
        .maybeSingle();

      if (insErr) {
        console.error("[admin/probation] send failed:", insErr.message);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }

      // Keep the application's own trail in step, so the applicant's status page
      // stops saying "Received" the moment a practical is out. Fire and forget:
      // the task is already recorded and a bookkeeping miss must not undo it.
      if (body.applicationId) {
        const { error: appErr } = await service
          .from("inner_circle_applications")
          .update({ task_sent_at: new Date().toISOString() })
          .eq("id", body.applicationId);
        if (appErr) console.error("[admin/probation] application stamp failed:", appErr.message);
      }

      return NextResponse.json({ success: true, task: inserted });
    }

    /* ---------------------------------------------------------------- */
    /* Score a round                                                    */
    /* ---------------------------------------------------------------- */
    if (action === "score") {
      const taskId = String(body.taskId ?? "");
      const rawMarks = (body.marks ?? {}) as Record<string, unknown>;

      if (!taskId) {
        return NextResponse.json({ error: "taskId is required." }, { status: 400 });
      }
      // Reject unknown keys rather than ignoring them. A typo'd mark that is
      // silently dropped produces a score that looks deliberate and is not.
      const unknown = Object.keys(rawMarks).filter((k) => !MARK_KEYS.has(k));
      if (unknown.length) {
        return NextResponse.json(
          { error: `Not part of the scorecard: ${unknown.join(", ")}` },
          { status: 400 },
        );
      }

      const marks: Partial<Record<ScorecardKey, boolean>> = {};
      for (const s of SCORECARD) marks[s.key] = rawMarks[s.key] === true;
      const score = scoreFrom(marks);

      const { data: updated, error: upErr } = await service
        .from("program_probation_tasks")
        .update({
          marks,
          score,
          reviewer_id: userId,
          reviewed_at: new Date().toISOString(),
          notes: String(body.notes ?? "") || null,
        })
        .eq("id", taskId)
        // Only score an unscored task: two reviewers at once must not both win
        // and overwrite each other's judgement.
        .is("reviewed_at", null)
        .select("id, user_id, role, round, score")
        .maybeSingle();

      if (upErr) {
        console.error("[admin/probation] score failed:", upErr.message);
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      if (!updated) {
        return NextResponse.json(
          { error: "That task is already scored, or does not exist." },
          { status: 409 },
        );
      }

      return NextResponse.json({
        success: true,
        task: updated,
        outOf: SCORECARD_TOTAL,
        passed: score >= PROBATION_PASS_MARK,
        passMark: PROBATION_PASS_MARK,
      });
    }

    return NextResponse.json({ error: "action must be 'send' or 'score'." }, { status: 400 });
  } catch (err) {
    console.error("[admin/probation] unexpected:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
