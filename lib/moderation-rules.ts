export const containsSensitiveInfo = (text: string): { detected: boolean; reason?: string } => {
    if (!text) return { detected: false };

    // 1. Phone Numbers (Advanced Obfuscation Catch)
    // Catches: "9876543210", "9 8 7 6...", "9-8-7...", "9_8_7..."
    // Looks for 10 digits separated by common obfuscators
    const phoneRegex = /(?:\+?91|0)?[6-9](?:[\s_.,-]*\d){9}/;
    if (phoneRegex.test(text)) {
        return { detected: true, reason: "Phone number detected (even if hidden). Please keep communication on platform." };
    }

    // 2. Email & Social Handles
    // Catches: standard emails, "example at gmail", "@username", "insta: user"
    const emailRegex = /[a-zA-Z0-9._%+-]+(?:\s*@\s*|\s+at\s+)[a-zA-Z0-9.-]+\s*(?:\.|dot)\s*[a-zA-Z]{2,}/i;
    const socialRegex = /(?:@[\w_.]+|insta|instagram|telegram|tg|snap|sc)\s*[:\-\s]?\s*[\w_.]+/i;

    if (emailRegex.test(text) || socialRegex.test(text)) {
        return { detected: true, reason: "Contact sharing (Email/Social) is restricted for safety." };
    }


    // 3. Strict Handle Detection (Underscores, dots inside words)
    // Catches "laksh_betala", "user.name"
    const handleRegex = /\b[a-zA-Z0-9]+[._-][a-zA-Z0-9]+\b/;
    if (handleRegex.test(text)) {
        return { detected: true, reason: "Potential username/handle detected. Please keep communication on platform." };
    }

    // 4. Payment Keywords
    const paymentKeywords = [
        "paytm", "gpay", "phonepe", "upi", "google pay", "bank transfer", "qr code", "cash", "direct"
    ];

    const lowerText = text.toLowerCase();
    const foundKeyword = paymentKeywords.find(keyword => lowerText.includes(keyword));

    if (foundKeyword) {
        return { detected: true, reason: `The keyword "${foundKeyword}" is restricted. Please use the secure Escrow system.` };
    }

    // 4. Illegal/Prohibited Content (Strict Blocklist)
    const illegalKeywords = [
        "ganja", "weed", "marijuana", "kush", "thc", "drugs", "cocaine", "heroin", "lsd", "mdma", "meth",
        "gun", "weapon", "bomb", "explosive", "hitman",
        "masturbat", "porn", "nude", "sex", "kill", "suicide", "hilla ke de", "hilake de", "masterbait","masturbation"
    ];

    const foundIllegal = illegalKeywords.find(keyword => lowerText.includes(keyword));
    if (foundIllegal) {
        return { detected: true, reason: "Illegal or prohibited content detected. This violates our policies." };
    }

    return { detected: false };
};
