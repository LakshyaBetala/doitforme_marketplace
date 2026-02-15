export const containsSensitiveInfo = (text: string): { detected: boolean; reason?: string } => {
    if (!text) return { detected: false };

    // 1. Phone Numbers (India: 10 digits, usually starting with 6-9)
    // Regex looks for 10 consecutive digits, allowing for spaces/dashes/periods
    const phoneRegex = /(\+91[\-\s]?)?[6-9]\d{9}|[6-9]\d{2}[\-\s]?\d{3}[\-\s]?\d{4}/;
    if (phoneRegex.test(text)) {
        return { detected: true, reason: "Phone numbers are not allowed to prevent scams." };
    }

    // 2. Email Addresses
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    if (emailRegex.test(text)) {
        return { detected: true, reason: "Email sharing is restricted for safety." };
    }

    // 3. Payment Keywords (Strict block to enforce on-platform payment)
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
