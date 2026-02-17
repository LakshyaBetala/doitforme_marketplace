import { useState, useRef, useCallback } from 'react';
import { pipeline, env } from '@xenova/transformers';

// Skip local model checks since we are running in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

type ModerationContext = 'CHAT' | 'POST';

interface ModerationResult {
    isSafe: boolean;
    reason?: string;
    flagged?: boolean;
}

export function useModeration() {
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const classifierRef = useRef<any>(null);

    const loadModel = useCallback(async () => {
        if (classifierRef.current || isModelLoading) return;

        try {
            setIsModelLoading(true);
            // Use the quantifiable/distilbert-base-uncased-mnli model as it's smaller and faster
            classifierRef.current = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli');
            setIsReady(true);
            console.log("AI Model Loaded Client-Side");
        } catch (error) {
            console.error("Failed to load AI model:", error);
        } finally {
            setIsModelLoading(false);
        }
    }, [isModelLoading]);

    const analyze = useCallback(async (text: string, context: ModerationContext): Promise<ModerationResult> => {
        // 1. Pre-computation / Regex Checks (Fastest)
        const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/;

        if (phoneRegex.test(text)) return { isSafe: false, reason: "Phone number detected. Please keep communication on platform." };
        if (emailRegex.test(text)) return { isSafe: false, reason: "Email detected. Please keep communication on platform." };
        if (upiRegex.test(text)) return { isSafe: false, reason: "UPI ID detected. Please use the secure Escrow system." };

        // 2. AI Check
        if (!classifierRef.current) {
            // If model isn't loaded, trigger load and Fail Open (allow post but warn logic could be added)
            // OR await loadModel(); // But that might be too slow for an interaction
            // For now, if regex passes and model isn't ready, we might just allow it or try to lazy load.
            // Let's try to lazy load if not ready, but usually this is called after focus.
            if (!isModelLoading) loadModel();
            return { isSafe: true, flagged: false };
        }

        try {
            const labels = context === 'CHAT'
                ? ["exchange phone number", "pay via upi", "pay outside", "normal conversation", "helpful message"]
                : ["illegal item", "contraband", "academic cheating", "contact info", "safe listing", "selling product", "hiring service"];

            const output = await classifierRef.current(text, labels);

            const topLabel = output.labels[0];
            const score = output.scores[0];

            console.log(`AI Analysis (${context}):`, topLabel, score);

            if (score > 0.85) {
                if (['exchange phone number', 'contact info'].includes(topLabel)) {
                    return { isSafe: false, reason: "AI detected contact sharing. Please keep it on-platform." };
                }
                if (['pay via upi', 'pay outside'].includes(topLabel)) {
                    return { isSafe: false, reason: "AI detected external payment. Use Escrow for safety." };
                }
                if (['illegal item', 'contraband', 'academic cheating'].includes(topLabel)) {
                    return { isSafe: false, reason: "AI detected prohibited content (Illegal/Cheating)." };
                }
            }

            return { isSafe: true };

        } catch (e) {
            console.error("AI Analysis Failed:", e);
            return { isSafe: true, flagged: true }; // Fail open
        }
    }, [loadModel, isModelLoading]);

    return { analyze, loadModel, isReady, isModelLoading };
}
