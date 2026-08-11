import { Sun, Maximize2, Type, IdCard } from "lucide-react";

/**
 * How to get an ID approved first time.
 *
 * Each tip maps to a real rejection reason, but the copy never mentions how the
 * check works — a student needs to know what to do with their phone, not what
 * runs on the server. Plain words, one line each, no hedging.
 *
 * Placed above the upload zone: the photo is taken seconds later, so after the
 * upload this is just an explanation of why they failed.
 */
export default function VerificationTips({ className = "" }: { className?: string }) {
  const tips = [
    { icon: Sun, title: "Good light", body: "Stand near a window. No shadows, no flash glare." },
    { icon: Maximize2, title: "Full card in frame", body: "All four corners visible. Lay it flat, don't crop." },
    { icon: Type, title: "Text you can read", body: "Zoom in — if the name and college are blurry, take it again." },
    { icon: IdCard, title: "A student ID", body: "School, college or university card. Not Aadhaar, PAN or a licence." },
  ];

  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5 ${className}`}>
      <p className="text-[13px] font-semibold text-white mb-3">Four things that get you approved</p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {tips.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-2.5 min-w-0">
            <Icon size={15} className="text-[var(--brand-purple-soft)] shrink-0 mt-0.5" />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-white leading-snug">{title}</span>
              <span className="block text-[12px] text-white/55 leading-relaxed mt-0.5">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-white/40 mt-4 pt-3 border-t border-white/[0.06] leading-relaxed">
        Your ID stays private. It&apos;s only used to confirm you&apos;re a student — never shown on
        your profile, never shared with posters.
      </p>
    </div>
  );
}
