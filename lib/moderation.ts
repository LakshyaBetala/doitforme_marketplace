
import { pipeline } from '@xenova/transformers';

// Singleton for lazy loading
let classifier: any = null;
let failed = false; // Circuit breaker to prevent endless retries/log spam

const getClassifier = async () => {
    if (failed) return null; // Stop trying if it failed once
    if (!classifier) {
        try {
            // V3 Model: DistilBERT (Standard) - More stable repo than uncensored
            classifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli');
        } catch (e) {
            console.error("AI Model Failed to Load (Disabling AI Moderation):", e);
            failed = true;
            return null;
        }
    }
    return classifier;
};

import { containsSensitiveInfo } from "./moderation-rules";
export { containsSensitiveInfo };


export const analyzeIntentAI = async (text: string) => {
    // 1. Instant Regex Guard (Standard phone/email block)
    const basicCheck = containsSensitiveInfo(text);
    if (basicCheck.detected) return { success: false, reason: basicCheck.reason };

    // Client-side guard check (optional, but robust)

    try {
        // 2. Semantic AI Guard with 1.5s Timeout
        // Use Singleton to prevent reloading model (Circuit breaker built-in)
        const classifierPromise = getClassifier();

        // Race the LOADING AND INFERENCE
        const analysisPromise = (async () => {
            const classifier = await classifierPromise;
            if (!classifier) throw new Error("AI Model Unavailable"); // Trigger fail-open

            const labels = ['contact info', 'outside payment', 'campus talk'];
            const output = await classifier(text, labels);
            return output;
        })();

        const timeout = new Promise((_, reject) => setTimeout(() => reject('Timeout'), 3000));

        const output: any = await Promise.race([analysisPromise, timeout]);

        if ((output.labels[0] === 'contact info' || output.labels[0] === 'outside payment') && output.scores[0] > 0.8) {
            return { success: false, reason: "AI: Please keep contact and payments on the platform." };
        }
    } catch (e) {
        // Fallback: Allow but mark for manual audit in logs
        console.warn("AI Check Skipped/Failed (Fail Open):", e);
        return { success: true, flagged: true, reason: "AI Service Unavailable/Timeout" };
    }
    return { success: true };
};
