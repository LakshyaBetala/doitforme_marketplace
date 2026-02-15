
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

export const containsSensitiveInfo = (text: string): { detected: boolean; reason?: string } => {
    if (!text) return { detected: false };

    // 1. Phone Numbers (India: 10 digits, usually starting with 6-9)
    const phoneRegex = /(\+91[\-\s]?)?[6-9]\d{9}|[6-9]\d{2}[\-\s]?\d{3}[\-\s]?\d{4}/;
    if (phoneRegex.test(text)) {
        return { detected: true, reason: "Phone numbers are not allowed to prevent scams." };
    }

    // 2. Email Addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailRegex.test(text)) {
        return { detected: true, reason: "Email sharing is restricted for safety." };
    }

    // 3. Payment Keywords
    const paymentKeywords = [
        "paytm", "gpay", "phonepe", "upi", "google pay", "bank transfer", "qr code", "cash", "direct"
    ];

    const lowerText = text.toLowerCase();
    const foundKeyword = paymentKeywords.find(keyword => lowerText.includes(keyword));

    if (foundKeyword) {
        return { detected: true, reason: `The keyword "${foundKeyword}" is restricted. Please use the secure Escrow system.` };
    }

    return { detected: false };
};


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
        console.warn("AI Check Skipped/Failed:", e);
        return { success: true, flagged: true };
    }
    return { success: true };
};
