const fs = require('fs');
const path = require('path');

const files = [
    'c:/Users/laksh/doitforme1/app/post/page.tsx',
    'c:/Users/laksh/doitforme1/app/messages/page.tsx',
    'c:/Users/laksh/doitforme1/app/gig/[id]/applicants/page.tsx',
    'c:/Users/laksh/doitforme1/app/dashboard/admin/payouts/page.tsx',
    'c:/Users/laksh/doitforme1/app/chat/[roomId]/page.tsx',
];

let fixed = 0;

for (const file of files) {
    if (!fs.existsSync(file)) {
        console.log(`SKIP (not found): ${file}`);
        continue;
    }

    let content = fs.readFileSync(file, 'utf8');

    // Check if "use client" exists but is NOT the first line
    if (content.includes('"use client"') && !content.startsWith('"use client"')) {
        // Remove the toast import line from wherever it is
        content = content.replace(/import \{ toast \} from ["']sonner["'];\r?\n/g, '');

        // Remove existing "use client" line
        content = content.replace(/["']use client["'];\r?\n/g, '');

        // Re-add both in correct order at the top
        content = '"use client";\n\nimport { toast } from "sonner";\n' + content;

        fs.writeFileSync(file, content, 'utf8');
        console.log(`FIXED: ${path.basename(file)}`);
        fixed++;
    } else if (content.includes('"use client"') && content.startsWith('"use client"')) {
        // Already correct, but check if toast import exists
        if (content.includes('import { toast }') && !content.includes('import { toast } from "sonner"')) {
            console.log(`OK (already correct): ${path.basename(file)}`);
        } else {
            console.log(`OK (already correct): ${path.basename(file)}`);
        }
    } else {
        console.log(`SKIP (no "use client"): ${path.basename(file)}`);
    }
}

console.log(`\nFixed ${fixed} files.`);
