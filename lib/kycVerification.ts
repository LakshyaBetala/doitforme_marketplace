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
}

// Approve at/above APPROVE; treat below REJECT as "unsure" -> manual review.
export const KYC_APPROVE_THRESHOLD = 0.85;
export const KYC_REJECT_THRESHOLD = 0.5;
const GEMINI_MODEL = "gemini-2.5-flash";

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
    return manualReview("Verification service not configured — a human will review your ID shortly.");
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
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: AbortSignal.timeout(60_000),
          }
        );
      } catch (e) {
        console.error(`[kyc] attempt ${attempt} threw:`, (e as Error)?.name || e);
        res = null;
      }
      if (res?.ok) break;
      lastStatus = res?.status ?? 0;
      // A quota rejection will not pass on a retry — don't burn the second one.
      if (lastStatus === 429) break;
      if (attempt === 1) await new Promise((r) => setTimeout(r, 1500));
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
          : "We couldn't auto-verify your ID — it's queued for a quick manual review."
      );
    }

    const data = await res.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = safeParse(text);
    if (!parsed) {
      return manualReview("We couldn't read the verification result — it's queued for a quick manual review.");
    }

    const confidence = clamp01(Number(parsed.confidence));
    const isStudentId = Boolean(parsed.is_student_id);
    const aiReason = String(parsed.reason || "").slice(0, 300);

    let decision: KycDecision;
    if (confidence < KYC_REJECT_THRESHOLD) {
      decision = "manual_review"; // model isn't sure either way
    } else if (isStudentId && confidence >= KYC_APPROVE_THRESHOLD) {
      decision = "approved";
    } else if (!isStudentId && confidence >= KYC_APPROVE_THRESHOLD) {
      decision = "rejected";
    } else {
      decision = "manual_review"; // borderline confidence
    }

    return {
      decision,
      isStudentId,
      institution: nullable(parsed.institution),
      studentName: nullable(parsed.student_name),
      idType: nullable(parsed.id_type),
      confidence,
      reason: aiReason || defaultReason(decision),
    };
  } catch (e) {
    console.error("[kyc] verify threw:", e);
    return manualReview("Verification timed out — your ID is queued for a quick manual review.");
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

function manualReview(reason: string): KycResult {
  return {
    decision: "manual_review",
    isStudentId: false,
    institution: null,
    studentName: null,
    idType: null,
    confidence: 0,
    reason,
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
