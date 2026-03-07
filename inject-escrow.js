const fs = require('fs');
const file = 'c:/Users/laksh/doitforme1/app/gig/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Normalize to LF
content = content.replace(/\r\n/g, '\n');

// 1. Add Lucide Imports (Key, Eye)
if (!content.includes('Key,')) {
    content = content.replace(
        '  FileText\n} from "lucide-react";',
        '  FileText,\n  Key,\n  Eye\n} from "lucide-react";'
    );
}

// 2. Inject Escrow Visual Guide
const searchTarget = `                <p className="text-white/60 text-sm leading-relaxed">\n                  {isOwner\n                    ? "To ensure safety, only share this code when you physically meet the worker and verify the service/item. Once they enter it, funds are released to them."\n                    : "Ask the seller for the 4-digit code when you meet. Entering this code confirms you have received the item/service and releases the payment."}\n                </p>`;

const replacement = `                <p className="text-white/60 text-sm leading-relaxed mb-6">\n                  {isOwner\n                    ? "To ensure safety, only share this code when you physically meet the worker and verify the service/item. Once they enter it, funds are released to them."\n                    : "Ask the seller for the 4-digit code when you meet. Entering this code confirms you have received the item/service and releases the payment."}\n                </p>\n\n                {/* ESCROW 3-STEP VISUAL */}\n                <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/50 bg-black/30 p-4 rounded-3xl border border-white/10 w-full md:w-auto mt-6 shadow-inner">\n                   <div className="flex flex-col items-center gap-2 flex-1 relative">\n                      <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30"><User size={18}/></div>\n                      <span className="text-center text-blue-400 shrink-0">1. Meet Up</span>\n                   </div>\n                   <ChevronRight size={16} className="text-white/20 shrink-0"/>\n                   <div className="flex flex-col items-center gap-2 flex-1 relative">\n                      <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30"><Eye size={18}/></div>\n                      <span className="text-center text-purple-400 shrink-0">2. Inspect</span>\n                   </div>\n                   <ChevronRight size={16} className="text-white/20 shrink-0"/>\n                   <div className="flex flex-col items-center gap-2 flex-1 relative">\n                      <div className="w-10 h-10 rounded-2xl bg-yellow-500/20 text-yellow-500 flex items-center justify-center border border-yellow-500/30"><Key size={18}/></div>\n                      <span className="text-center text-yellow-500 shrink-0">3. Exchange</span>\n                   </div>\n                </div>`;

if (content.includes(searchTarget)) {
    content = content.replace(searchTarget, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Escrow Handshake UI injected safely.");
} else {
    console.log("Could not find the target code block to inject the UI.");
}
