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

  const prompt = buildPrompt(opts);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
        // Don't let a slow vision call hang the upload request forever.
        signal: AbortSignal.timeout(20_000),
      }
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[kyc] Gemini ${res.status}: ${body.slice(0, 300)}`);
      return manualReview("We couldn't auto-verify your ID — it's queued for a quick manual review.");
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

function buildPrompt(opts: VerifyOpts): string {
  return [
    "You verify student identity cards for an Indian student gig platform.",
    "Decide if the image is a GENUINE student identity card from ANY recognised educational institution.",
    "A school ID, junior-college ID, college ID, university ID, or a graduate/alumni card ALL count as valid — do not require it to be a university.",
    "School IDs — including Class 11, Class 12, Plus Two / +2, higher-secondary, and junior-college cards — are FULLY VALID student IDs. Approve them with high confidence; never down-rank a card just because it is from a school rather than a university.",
    "Be lenient about the institution type, but STRICT about authenticity: reject blank or unreadable images, random photos/selfies, memes, screenshots of plain text, obvious digital fakes, or documents that are clearly not a student ID (Aadhaar, PAN, driving licence, etc. are NOT student IDs).",
    opts.declaredName ? `The user says their name is "${opts.declaredName}".` : "",
    opts.declaredCollege ? `The user says their institution is "${opts.declaredCollege}".` : "",
    "Respond with ONLY a compact JSON object (no markdown) using exactly these keys:",
    '{"is_student_id": boolean, "institution": string|null, "student_name": string|null, "id_type": "school"|"college"|"university"|"graduate"|"other"|null, "confidence": number 0..1, "reason": "one short sentence a student would understand"}',
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
      return "Your student ID looks valid.";
    case "rejected":
      return "This doesn't look like a valid student ID. Please upload a clear photo of your school/college ID card.";
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
