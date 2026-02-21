import { useState, useRef, useCallback } from 'react';

// Define types locally since we can't import them from module efficiently during SSR
type Pipeline = any;

type ModerationContext = 'CHAT' | 'POST';

interface ModerationResult {
    isSafe: boolean;
    reason?: string;
    flagged?: boolean;
}

export function useModeration() {
    const [isModelLoading, setIsModelLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const classifierRef = useRef<Pipeline>(null);

    const loadModel = useCallback(async () => {
        if (classifierRef.current || isModelLoading) return;

        try {
            setIsModelLoading(true);

            // Dynamic Import to avoid SSR issues
            const XenovaModule = await import('@xenova/transformers');

            // Handle both ESM and CJS/Default export scenarios
            const env = XenovaModule.env || (XenovaModule as any).default?.env;
            const pipeline = XenovaModule.pipeline || (XenovaModule as any).default?.pipeline;

            if (env) {
                // Configure environment
                env.allowLocalModels = false;
                env.useBrowserCache = true;
            }

            // Use the quantifiable/distilbert-base-uncased-mnli model as it's smaller and faster
            if (pipeline) {
                classifierRef.current = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli');
                setIsReady(true);
                console.log("AI Model Loaded Client-Side");
            } else {
                console.error("Xenova pipeline not found in module imports");
            }
        } catch (error) {
            console.error("Failed to load AI model:", error);
        } finally {
            setIsModelLoading(false);
        }
    }, [isModelLoading]);

    const analyze = useCallback(async (text: string, context: ModerationContext): Promise<ModerationResult> => {
        // 1. Pre-computation / Regex Checks (Fastest & Strict)

        // Phone: Catches "9 8 7...", "9_8_7...", "9.8.7..."
        const phoneRegex = /(?:\+?91|0)?[6-9](?:[\s_.,-]*\d){9}/;

        // Email/Handle: Catches "user at gmail", "insta: user", "@handle"
        const emailRegex = /[a-zA-Z0-9._%+-]+(?:\s*@\s*|\s+at\s+)[a-zA-Z0-9.-]+\s*(?:\.|dot)\s*[a-zA-Z]{2,}/i;
        const socialRegex = /(?:@[\w_.]+|insta|instagram|telegram|tg|snap|sc)\s*[:\-\s]?\s*[\w_.]+/i;
        const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/;

        // Handle: Catches "user_name", "user-name", "user.name" (Strict)
        // If a word has an internal symbol often used in handles
        const handleRegex = /\b[a-zA-Z0-9]+[._-][a-zA-Z0-9]+\b/;

        if (phoneRegex.test(text)) return { isSafe: false, reason: "Phone number detected (even if hidden). Keep comms on platform." };
        if (emailRegex.test(text) || socialRegex.test(text)) return { isSafe: false, reason: "External contact/Social handle detected. Keep comms on platform." };
        if (handleRegex.test(text)) return { isSafe: false, reason: "Potential username/handle detected. Please disable auto-correct or remove symbols." };
        if (upiRegex.test(text)) return { isSafe: false, reason: "UPI ID detected. Please use the secure Escrow system." };

        // 1.5 Keyword Blocklist (Catch obvious illegal items that AI might miss)
        // Includes: Drugs, Weapons, Sexual content, Violence, Scams, Common Hindi Slang
        const illegalRegex = /\b(ganja|weed|marijuana|kush|thc|drugs|cocaine|heroin|lsd|mdma|meth|charas|afeem|smack|shrooms|ketamine|gun|weapon|bomb|explosive|hitman|katta|tamancha|pistol|revolver|ammo|masturbat|porn|nude|sex|escort|horny|bobs|vegana|chut|lund|gaand|randi|bhosdi|madarchod|behenchod|kill|suicide|murder|supari|hilla\s*ke\s*de|masterbait|masterbation|masturbation|masturbate|lottery|prize\s*money|otp|cvv)\b/i;
        if (illegalRegex.test(text)) return { isSafe: false, reason: "Illegal or prohibited content detected." };

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
                ? ["exchange phone number", "pay via upi", "pay outside", "illegal content", "prohibited items", "hidden contact info", "social media handle", "username", "social media link"]
                : ["illegal item", "contraband", "academic cheating", "contact info", "safe listing", "selling product", "hiring service", "electronics", "stationery", "educational tool", "calculator", "clothing"];

            const output = await classifierRef.current(text, labels);

            const topLabel = output.labels[0];
            const score = output.scores[0];

            console.log(`AI Analysis (${context}):`, topLabel, score);

            // V6 Smart Threshold: Only block if 'bad' label > 0.90
            const BAD_LABELS = ['exchange phone number', 'pay via upi', 'pay outside', 'illegal item', 'contraband', 'academic cheating', 'illegal content', 'prohibited items', 'hidden contact info', 'social media handle', 'username', 'social media link'];

            if (BAD_LABELS.includes(topLabel) && score > 0.90) {
                if (['exchange phone number', 'contact info', 'hidden contact info', 'social media handle', 'username', 'social media link'].includes(topLabel)) {
                    return { isSafe: false, reason: "AI detected contact sharing. Please keep it on-platform." };
                }
                if (['pay via upi', 'pay outside'].includes(topLabel)) {
                    return { isSafe: false, reason: "AI detected external payment. Use Escrow for safety." };
                }
                if (['illegal item', 'contraband', 'academic cheating', 'illegal content', 'prohibited items'].includes(topLabel)) {
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
