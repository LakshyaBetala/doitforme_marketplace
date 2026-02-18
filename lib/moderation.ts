
import { containsSensitiveInfo } from "./moderation-rules";
export { containsSensitiveInfo };

// Server-side analysis is now LITE-WEIGHT (Regex only)
// The heavy lifting is done on the client-side via useModeration hook.
export const analyzeIntentAI = async (text: string) => {
    // 1. Instant Regex Guard (Standard phone/email block)
    const basicCheck = containsSensitiveInfo(text);
    if (basicCheck.detected) return { success: false, reason: basicCheck.reason };

    // 2. Client-side AI has already run. Server trusts the regex + client validation.
    // If needed, we could add a DB log here, but for now, we pass.
    return { success: true, flagged: false };
};
