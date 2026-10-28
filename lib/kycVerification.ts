// Server-only student-ID verifier.
//
// Uses Google Gemini (free tier — get a key at https://aistudio.google.com/apikey)
// to decide whether an uploaded image is a genuine student identity card from ANY
// educational institution: school, junior college, college, university, or a
// graduate/alumni card all count. The check is deliberately LENIENT about the
// *type* of institution but STRICT about authenticity (no memes, blank frames,
// random selfies, or screenshots of text).
//
// Like lib/moderation.ts this fails OPEN: any configuration/network/parse error
// returns `manual_review` so a real student is never hard-blocked by an outage —
// the upload simply lands in the admin review queue instead.

export type KycDecision = "approved" | "rejected" | "manual_review";

export interface KycResult {
  decision: KycDecision;
  isStudentId: boolean;
  institution: string | null;
  studentName: string | null;
  idType: string | null; // school | college | university | graduate | other
  confidence: number; // 0..1
  reason: string; // plain-language, shown to the student when rejected
  /**
   * Why this was NOT a real decision, when it was not one.
   *
   * null means the model actually looked at the image and said what it thought.
   * Anything else means we failed open: the decision is manual_review because
   * the service could not answer, not because the document was ambiguous.
   *
   * Without this the two are indistinguishable in the database, and they were.
   * 348 of the 372 students sitting in manual_review had confidence exactly
   * 0.00 and no reason recorded, which reads like 348 unclear documents and was
   * actually a service that had stopped answering. A caller that needs to tell
   * them apart - the backfill, which must stop rather than stamp hundreds of
   * students with a non-answer - now can.
   */
  failure: KycFailure | null;
  /**
   * True when the uploaded image should be DELETED rather than kept.
   *
   * Set only for the hopeless band: the image is demonstrably not a document,
   * so there is nothing to review on appeal and no reason to retain a photo of
   * somebody. The upload route removes the object and clears id_card_url so the
   * next attempt starts clean.
   */
  purgeDocument: boolean;
}

export type KycFailure = "quota" | "network" | "unreadable" | "unconfigured";

/**
 * The band logic, as a pure function so the thresholds are testable.
 *
 * Extracted from the middle of verifyStudentIdImage, which cannot be unit
 * tested without a network call — so the one part of KYC that decides whether a
 * real student gets in was the one part with no test. Covered by
 * tests/unit/kyc-decision.test.mjs.
 */
export function decideKyc(
  confidence: number,
  isStudentId: boolean
): { decision: KycDecision; purgeDocument: boolean } {
  // No document in the frame at all. A decision, not a deferral.
  if (confidence < KYC_HOPELESS_THRESHOLD) {
    return { decision: "rejected", purgeDocument: true };
  }
  if (confidence >= KYC_APPROVE_THRESHOLD) {
    // Confidently a document and confidently not a student ID — an Aadhaar
    // card, a bus pass, somebody else's fee receipt. Kept, because that is the
    // rejection a person might reasonably appeal.
    return { decision: isStudentId ? "approved" : "rejected", purgeDocument: false };
  }
  // Genuinely ambiguous: [HOPELESS, APPROVE).
  return { decision: "manual_review", purgeDocument: false };
}

/**
 * Three bands, tuned so the overwhelming majority of uploads get an answer
 * immediately instead of joining a queue.
 *
 *   >= APPROVE   and is a student ID  -> approved
 *   >= APPROVE   and is NOT one       -> rejected, with a reason, re-uploadable
 *   <  HOPELESS                       -> rejected AND the image is deleted
 *   in between                        -> manual_review
 *
 * APPROVE was 0.85, which is a high bar for a model reading a phone photo of a
 * laminated card, and REJECT was 0.5 — so EVERYTHING from 0 to 0.85 landed in
 * manual_review, a queue nothing drains. 372 students were sitting in it. The
 * band is now [0.10, 0.65), which is about a third as wide, and the ends are
 * both decisions rather than deferrals.
 *
 * Lowering the approve bar is the right trade here and worth saying out loud:
 * the cost of wrongly approving someone is that a non-student can apply for
 * gigs, which escrow and ratings already bound. The cost of wrongly deferring a
 * real student is that they wait forever and leave, which is what has actually
 * been happening.
 *
 * HOPELESS is not "unsure", it is "there is no document here" — a selfie, a
 * landscape, a blank wall. The model reports those at 0.00-0.05 with a plain
 * explanation. Keeping the image serves nobody: there is nothing for an admin
 * to review, and it is a photo of a person's face sitting in a private bucket,
 * so it is deleted and they are asked to upload the right thing.
 */
export const KYC_APPROVE_THRESHOLD = 0.65;
export const KYC_HOPELESS_THRESHOLD = 0.1;

/** @deprecated kept so existing imports do not break; use the two above. */
export const KYC_REJECT_THRESHOLD = KYC_HOPELESS_THRESHOLD;
/**
 * Tried in order, falling through on a 429.
 *
 * The free tier is metered PER MODEL PER DAY and the ceiling is far lower than
 * it looks. The live quota for gemini-2.5-flash, read off the 429 itself, is
 *
 *   GenerateRequestsPerDayPerProjectPerModel-FreeTier = 20
 *
 * Twenty verifications a day. Every upload past the twentieth failed open to
 * manual_review, and because nothing reviews that queue the student simply
 * waited - which is the real reason 348 of them are parked there with
 * confidence 0, rather than the cold-start timeout diagnosed below. That one
 * was real too and the retry fixed it; this is the other half.
 *
 * Because the quota id is PerProjectPerModel, a second model carries its own
 * twenty. Falling through does not make the limit generous, but it stops a
 * single model's daily cap from being a cliff for everyone who uploads after
 * it. The real fix is billing on the Google project, where this costs a
 * fraction of a paisa per ID. Until then order matters: the stronger model
 * reads first and the lighter one is the safety net, not the default.
 */
export const KYC_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"] as const;

interface VerifyOpts {
  declaredName?: string | null;
  declaredCollege?: string | null;
}

export async function verifyStudentIdImage(
  imageBase64: string,
  mimeType: string,
  opts: VerifyOpts = {}
): Promise<KycResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return manualReview(
      "Verification service not configured — a human will review your ID shortly.",
      "unconfigured"
    );
  }

  const prompt = buildKycPrompt(opts);

  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });

  try {
    // 60s, and retry once.
    //
    // This was a single attempt with a 20-SECOND timeout, which Gemini's vision
    // model routinely overshoots: a measured cold call on a 70 KB ID took
    // 24.6s, and the warm call right after took 4.4s. So the first upload of
    // the day aborted, fell open to manual_review, and sat there — because
    // nothing reviews that queue. 261 students were parked in it with
    // confidence 0, and they are the ones writing to support asking why
    // verification has been "pending" for days.
    //
    // Failing open is still right; failing open on a timer shorter than the
    // service's own p50 is not. The retry is what converts the slow-cold-start
    // case into a normal result rather than a queue entry.
    let res: Response | null = null;
    let lastStatus = 0;
    // Each model gets the two timeout attempts; a 429 moves to the NEXT model
    // instead of ending the verification, because the daily cap is per-model
    // and the next one still has its own.
    // A WALL-CLOCK BUDGET ACROSS THE WHOLE CASCADE.
    //
    // The student is waiting on this request with a spinner. Two models times
    // two attempts times a 60s timeout is a four-minute worst case, which is
    // not a slow verification, it is a hung browser — and the outcome after
    // four minutes is the same manual_review it would have reached in one.
    //
    // 75s leaves room for one cold call (measured at 24.6s) plus a retry, and
    // still gives the second model a chance when the first fails fast, which is
    // what a 429 does. Past the budget we stop and fail open, which is the same
    // answer sooner.
    const deadline = Date.now() + 75_000;
    outer: for (const model of KYC_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (Date.now() >= deadline) {
          console.error("[kyc] cascade budget exhausted; failing open");
          break outer;
        }
        try {
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
              signal: AbortSignal.timeout(60_000),
            }
          );
        } catch (e) {
          console.error(`[kyc] ${model} attempt ${attempt} threw:`, (e as Error)?.name || e);
          res = null;
        }
        if (res?.ok) break outer;
        lastStatus = res?.status ?? 0;
        // A quota rejection will not pass on a retry — don't burn the second
        // attempt on it, go and try the next model.
        if (lastStatus === 429) break;
        if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!res || !res.ok) {
      const text = res ? await res.text().catch(() => "") : "";
      console.error(`[kyc] Gemini ${lastStatus || "no response"}: ${text.slice(0, 300)}`);
      // Name the quota case distinctly. "Queued for review" told the student
      // a human was coming, and told us nothing about why, which is how a
      // service outage stayed invisible for weeks.
      return manualReview(
        lastStatus === 429
          ? "Our verification service is at its daily limit — your ID is queued and will be checked shortly."
          : "We couldn't auto-verify your ID — it's queued for a quick manual review.",
        lastStatus === 429 ? "quota" : "network"
      );
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeParse(text);
    if (!parsed) {
      return manualReview(
        "We couldn't read the verification result — it's queued for a quick manual review.",
        "unreadable"
      );
    }

    const confidence = clamp01(Number(parsed.confidence));
    const isStudentId = Boolean(parsed.is_student_id);
    const aiReason = String(parsed.reason || "").slice(0, 300);

    const { decision, purgeDocument } = decideKyc(confidence, isStudentId);

    // The model's own sentence is usually the clearest thing we can say ("this
    // is a selfie and not an official document"). What it never includes is
    // what to do about it, and this is the one rejection where the image is
    // also gone — so the instruction is appended rather than replacing it.
    const reason = purgeDocument
      ? `${aiReason || "That image does not appear to contain a student ID."} We have deleted it — please upload a clear photo of the front of your school, college or university ID card.`
      : aiReason || defaultReason(decision);

    return {
      decision,
      isStudentId,
      institution: nullable(parsed.institution),
      studentName: nullable(parsed.student_name),
      idType: nullable(parsed.id_type),
      confidence,
      reason,
      failure: null,
      purgeDocument,
    };
  } catch (e) {
    console.error("[kyc] verify threw:", e);
    return manualReview("Verification timed out — your ID is queued for a quick manual review.", "network");
  }
}

/**
 * The one description of what counts as proof of study.
 *
 * Exported because scripts/maintenance/reverify-kyc.mjs used to carry its own
 * copy, so a backfill scored students against different rules than the live
 * upload path — and broadening one left the other unchanged.
 */
export function buildKycPrompt(opts: VerifyOpts): string {
  return [
    "You verify proof of student status for an Indian student gig platform.",
    "Decide if the image is GENUINE official evidence that this person is currently studying at ANY recognised educational institution.",
    "A school ID, junior-college ID, college ID, university ID, or a graduate/alumni card ALL count as valid — do not require it to be a university.",
    "School IDs — including Class 11, Class 12, Plus Two / +2, higher-secondary, and junior-college cards — are FULLY VALID student IDs. Approve them with high confidence; never down-rank a card just because it is from a school rather than a university.",
    // An ID CARD is not the only proof, and insisting on one excludes real
    // students: schools that never issue cards, first-years whose cards have not
    // been printed yet, distance and open-university learners. Two students
    // wrote in asking what else they could send and the honest answer was
    // "nothing", which is a verification gate failing at its own purpose.
    "An ID CARD IS NOT REQUIRED. Any official document naming the student and the institution and showing current enrolment is EQUALLY VALID — accept it with the same confidence as a card. This explicitly includes: a bonafide / study certificate, an admission or allotment letter, a fee receipt or challan, a recent marksheet or report card, an exam hall ticket or admit card, a library or hostel card, or a transfer certificate.",
    "Judge the DOCUMENT, not its format: if it is on institutional letterhead, or bears an institutional seal, stamp or signature, and names the student, treat it as genuine proof.",
    "Be lenient about the document type and the institution, but STRICT about authenticity: reject blank or unreadable images, random photos/selfies, memes, screenshots of plain text, obvious digital fakes, or government identity documents that say nothing about studying (Aadhaar, PAN, driving licence and passport are NOT proof of student status on their own).",
    // Offered as a WEAK hint only. Students sign up with handles, nicknames and
    // initials — "Shanks D. Shekhar" against an ID reading "Shashank Shekhar"
    // was scored down to 0.6 and parked in manual review, which is a real
    // student blocked by a naming convention rather than by any doubt about the
    // document.
    opts.declaredName
      ? `For context only, the account name is "${opts.declaredName}". Account names are often nicknames, handles or initials, so DO NOT reduce confidence when it differs from the document — judge the document's authenticity on its own. Only treat a name as disqualifying if it belongs to an obviously different person.`
      : "",
    opts.declaredCollege ? `The user says their institution is "${opts.declaredCollege}".` : "",
    "Respond with ONLY a compact JSON object (no markdown) using exactly these keys:",
    '{"is_student_id": boolean, "institution": string|null, "student_name": string|null, "id_type": "school"|"college"|"university"|"graduate"|"certificate"|"admission_letter"|"fee_receipt"|"marksheet"|"other"|null, "confidence": number 0..1, "reason": "one short sentence a student would understand"}',
  ]
    .filter(Boolean)
    .join("\n");
}

function manualReview(reason: string, failure: KycFailure): KycResult {
  return {
    decision: "manual_review",
    isStudentId: false,
    institution: null,
    studentName: null,
    idType: null,
    confidence: 0,
    reason,
    failure,
    // Never purge on a fail-open. Confidence is 0 here because nothing looked
    // at the image, not because the image is empty — deleting it would destroy
    // a perfectly good student ID whenever the service is down.
    purgeDocument: false,
  };
}

function defaultReason(decision: KycDecision): string {
  switch (decision) {
    case "approved":
      return "Your student proof looks valid.";
    case "rejected":
      return "We couldn't read this as proof of study. Send a clear photo of your student ID — or, if you don't have one, a bonafide certificate, admission letter, fee receipt or recent marksheet.";
    default:
      return "Your ID is queued for a quick manual review.";
  }
}

function safeParse(text: string): any | null {
  if (!text) return null;
  // Strip ```json fences if the model added them despite responseMimeType.
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function nullable(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s && s.toLowerCase() !== "null" ? s : null;
}
