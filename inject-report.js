const fs = require('fs');
const file = 'c:/Users/laksh/doitforme1/app/gig/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. imports
if (!content.includes('Flag,')) {
    content = content.replace(
        '  Eye\n} from "lucide-react";',
        '  Eye,\n  Flag\n} from "lucide-react";'
    );
}

// 2. Add State
const stateTarget = `  const [submitting, setSubmitting] = useState(false);`;
const stateReplacement = `  const [submitting, setSubmitting] = useState(false);

  // Report State
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isReporting, setIsReporting] = useState(false);`;
if (content.includes(stateTarget)) {
    content = content.replace(stateTarget, stateReplacement);
}

// 3. Add Handler
const handlerTarget = `  const submitReview = async () => {`;
const handlerReplacement = `  const handleReport = async () => {
    if (!reportReason) return toast.error("Please select a reason.");
    setIsReporting(true);
    try {
      const res = await fetch("/api/gig/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: id, targetType: "gig", reason: reportReason, details: reportDetails })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit report");
      
      toast.success("Report submitted successfully for review.");
      setShowReportModal(false);
      setReportReason("");
      setReportDetails("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsReporting(false);
    }
  };

  const submitReview = async () => {`;
if (content.includes(handlerTarget) && !content.includes('handleReport')) {
    content = content.replace(handlerTarget, handlerReplacement);
}

// 4. Add Modal
const modalTarget = `      {/* BACKGROUND BLOBS */}`;
const modalReplacement = `      {/* REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1A24] border border-white/10 rounded-3xl p-8 max-w-md w-full animate-in zoom-in-95 relative shadow-2xl">
            <button onClick={() => setShowReportModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><Flag size={20}/></div>
            <h2 className="text-xl font-bold text-center mb-2">Report this Listing</h2>
            <p className="text-center text-white/50 text-sm mb-6">Help keep our community safe.</p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {["Scam / Fraud", "Inappropriate", "Spam", "Other"].map(r => (
                  <button key={r} onClick={() => setReportReason(r)} className={\`py-2 px-3 text-xs font-bold rounded-xl border transition-all \${reportReason === r ? "bg-red-500/20 border-red-500/50 text-red-500" : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"}\`}>{r}</button>
                ))}
              </div>

              <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} placeholder="Provide specific details (optional)..." className="w-full bg-[#0B0B11] border border-white/10 rounded-xl p-4 h-24 outline-none text-white resize-none focus:border-red-500/50 transition-all font-mono text-sm" />

              <button onClick={handleReport} disabled={isReporting} className="w-full py-4 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                {isReporting ? <Loader2 className="animate-spin w-5 h-5" /> : <Flag className="w-5 h-5" />} Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BACKGROUND BLOBS */}`;
if (content.includes(modalTarget) && !content.includes('REPORT MODAL')) {
    content = content.replace(modalTarget, modalReplacement);
}

// 5. Add Flag Button to Header
const headerTarget = `              <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">\n                {gig.title}\n              </h1>`;
const headerReplacement = `              <div className="flex items-start justify-between gap-4 pr-0 md:pr-12">
                <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                  {gig.title}
                </h1>
                <button onClick={() => setShowReportModal(true)} className="w-10 h-10 shrink-0 mt-1 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 flex items-center justify-center transition-all group" title="Report Listing">
                  <Flag size={16} className="group-hover:fill-red-400/20" />
                </button>
              </div>`;
if (content.includes(headerTarget) && !content.includes('setShowReportModal(true)')) {
    content = content.replace(headerTarget, headerReplacement);
}

fs.writeFileSync(file, content, 'utf8');
console.log("Report UI elements injected safely.");
