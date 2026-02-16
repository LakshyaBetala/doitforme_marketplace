
import { pipeline } from '@xenova/transformers';

// Singleton for lazy loading
let classifier: any = null;

const getClassifier = async () => {
    if (!classifier) {
        // V3 Model: DistilBERT for better semantic understanding
        classifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncensored-mnli');
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
        // 2. Semantic AI Guard with 2s Timeout
        // Use Singleton to prevent reloading model
        const classifierPromise = getClassifier();
        const timeout = new Promise((_, reject) => setTimeout(() => reject('Timeout'), 2000));

        // Race the LOADING/GETTING of the model? 
        // If model is already loaded, getClassifier returns fast.

        const classifier: any = await Promise.race([classifierPromise, timeout]);

        // Run classification
        const labels = ['contact info', 'outside payment', 'campus talk'];
        const output = await classifier(text, labels);

        if ((output.labels[0] === 'contact info' || output.labels[0] === 'outside payment') && output.scores[0] > 0.8) {
            return { success: false, reason: "AI: Please keep contact and payments on the platform." };
        }
    } catch (e) {
        // Fallback: Allow but mark for manual audit in logs
        console.warn("AI Check Skipped/Failed (Fail Open):", e);
        return { success: true, flagged: true, reason: "AI Service Unavailable" };
    }
    return { success: true };
};
