const fs = require('fs');
const path = require('path');

const files = [
    "app/post/page.tsx",
    "app/messages/page.tsx",
    "app/gig/[id]/page.tsx",
    "app/gig/[id]/applicants/page.tsx",
    "app/dashboard/admin/payouts/page.tsx",
    "app/chat/[roomId]/page.tsx"
];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');

    let changed = false;
    if (!content.includes('import { toast } from "sonner"') && !content.includes("import { toast } from 'sonner'")) {
        content = 'import { toast } from "sonner";\n' + content;
        changed = true;
    }

    const successKeywords = [
        "Offer submitted", "Offer Accepted", "Offer accepted", "Handshake Confirmed",
        "Gig cancelled", "Cancellation request", "This gig is now assigned", "Worker has been notified"
    ];

    // Manual replacement specifically for alerts
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('alert(')) {
            let isSuccess = false;
            for (const kw of successKeywords) {
                if (lines[i].toLowerCase().includes(kw.toLowerCase())) {
                    isSuccess = true;
                    break;
                }
            }
            lines[i] = lines[i].replace(/alert\(/g, isSuccess ? 'toast.success(' : 'toast.error(');
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        console.log(`Updated ${file}`);
    }
});
