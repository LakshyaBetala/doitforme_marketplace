import { Sun, Crop, Eye, FileWarning } from "lucide-react";

/**
 * Tips for getting through ID verification on the first try.
 *
 * These map directly to what the Gemini check in lib/kycVerification.ts
 * actually rejects: unreadable images, cropped/partial cards, screenshots of
 * text, and documents that aren't student IDs. Telling people the failure modes
 * up front is cheaper than a rejection email and a re-upload — and every
 * borderline scan that lands in manual_review is work for an admin.
 *
 * Deliberately phrased as "do this" rather than "don't do that": instructions
 * people can follow beat a list of ways to fail.
 */
export default function VerificationTips({ className = "" }: { className?: string }) {
  const tips = [
    {
      icon: Sun,
      title: "Bright, even light",
      body: "Near a window works best. Avoid shadows falling across the card and glare from a flash.",
    },
    {
      icon: Crop,
      title: "The whole card, flat",
      body: "All four corners in frame, card flat on a plain surface. Don't crop the edges off.",
    },
    {
      icon: Eye,
      title: "Name and college readable",
      body: "If you can't read the text when you zoom in, neither can the checker. Retake it closer.",
    },
    {
      icon: FileWarning,
      title: "A student ID, not other proof",
      body: "School, Class 11/12, junior college, university and alumni cards all work. Aadhaar, PAN and licences don't.",
    },
  ];

  return (
    <div className={`bg-[var(--card)] border border-white/[0.08] rounded-2xl p-5 ${className}`}>
      <h3 className="text-sm font-semibold mb-1">Get approved in about a minute</h3>
      <p className="text-xs text-white/55 mb-4 leading-relaxed">
        Most IDs are approved instantly. These four things are what decide it.
      </p>
      <ul className="space-y-3">
        {tips.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="w-7 h-7 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
              <Icon size={14} className="text-[var(--brand-purple-soft)]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-white leading-snug">{title}</span>
              <span className="block text-[12px] text-white/55 leading-relaxed mt-0.5">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-white/40 mt-4 leading-relaxed">
        Your ID is stored privately and is only used to confirm you&apos;re a student. It is never
        shown on your profile or shared with posters.
      </p>
    </div>
  );
}
