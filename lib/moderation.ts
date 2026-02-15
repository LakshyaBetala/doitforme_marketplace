
import { pipeline } from '@xenova/transformers';

// Singleton for lazy loading
let classifier: any = null;

const getClassifier = async () => {
    if (!classifier) {
        // Using a lightweight Zero-Shot Classification model
        classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
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

export const analyzeIntentAI = async (text: string): Promise<{ detected: boolean; reason?: string }> => {
    // Client-side only check for now to prevent serverless timeouts
    if (typeof window === 'undefined') return { detected: false };

    try {
        const classifier = await getClassifier();
        const labels = ["sharing contact info", "outside payment", "normal campus talk", "question about task"];

        const output = await classifier(text, labels);
        // output: { labels: string[], scores: number[] }

        // Find indices of bad labels
        const contactIndex = output.labels.indexOf("sharing contact info");
        const paymentIndex = output.labels.indexOf("outside payment");

        const contactScore = output.scores[contactIndex];
        const paymentScore = output.scores[paymentIndex];

        // Threshold 0.85 to avoid false positives
        if (contactScore > 0.85) {
            return { detected: true, reason: "AI detected intent to share contact info. Please keep comms on-platform." };
        }
        if (paymentScore > 0.85) {
            return { detected: true, reason: "AI detected intent to pay outside. This is a ban-able offense." };
        }

        return { detected: false };

    } catch (error) {
        console.error("AI Moderation Error:", error);
        return { detected: false }; // Fail open if AI breaks
    }
};
