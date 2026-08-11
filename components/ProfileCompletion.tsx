"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Share2, ArrowRight } from "lucide-react";

/**
 * "Claim your page" — the retention surface for users with no gigs to do.
 *
 * Most students who sign up will not get a task soon, because demand is the
 * bottleneck. If the only thing the product offers is "apply and wait", they
 * churn (older cohorts show 0-4% ever doing anything). A public profile at
 * /u/<username> delivers value on day one without needing any demand to exist,
 * and every profile a student shares is a free inbound link.
 *
 * Progress is deliberately framed around a shareable outcome, not chores.
 */

type Props = {
  user: {
    username?: string | null;
    avatar_url?: string | null;
    skills?: string[] | null;
    resume_url?: string | null;
    upi_id?: string | null;
    bio?: string | null;
  } | null;
};

export default function ProfileCompletion({ user }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (!user || dismissed) return null;

  const steps = [
    { key: "username", label: "Claim your link", done: !!user.username, href: "/profile?edit=username" },
    { key: "avatar", label: "Add a photo", done: !!user.avatar_url, href: "/profile?edit=avatar" },
    { key: "skills", label: "List your skills", done: !!(user.skills && user.skills.length > 0), href: "/profile/worker-setup" },
    { key: "bio", label: "Write a short bio", done: !!user.bio, href: "/profile?edit=bio" },
    { key: "resume", label: "Upload a resume", done: !!user.resume_url, href: "/profile/worker-setup" },
    { key: "upi", label: "Add UPI to get paid", done: !!user.upi_id, href: "/profile?edit=upi" },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  if (doneCount === steps.length) return null;

  const next = steps.find((s) => !s.done)!;
  const profileUrl = user.username ? `https://doitforme.in/u/${user.username}` : null;

  const share = async () => {
    if (!profileUrl) return;
    try {
      // Native share on mobile is the whole point — it puts the link one tap
      // away from the WhatsApp groups this platform actually grew through.
      if (navigator.share) {
        await navigator.share({ title: "My doitforme profile", url: profileUrl });
      } else {
        await navigator.clipboard.writeText(profileUrl);
        toast.success("Profile link copied");
      }
    } catch {
      /* user cancelled the share sheet — not an error */
    }
  };

  return (
    <section className="bg-[var(--card)] border border-white/[0.08] rounded-3xl p-5 md:p-6 mb-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h2 className="text-base md:text-lg font-semibold tracking-tight">
            {profileUrl ? "Your page is live" : "Claim your page"}
          </h2>
          <p className="text-xs md:text-[13px] text-white/60 mt-1 leading-relaxed">
            {profileUrl
              ? "Share it anywhere — it works as your portfolio."
              : "A public profile you can send to anyone, instead of a resume PDF."}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[11px] text-white/40 hover:text-white/70 transition-colors shrink-0"
          aria-label="Dismiss"
        >
          Hide
        </button>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-1.5 flex-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full bg-[var(--brand-purple)] rounded-full transition duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[11px] font-semibold text-white/50 tabular-nums shrink-0">
          {doneCount}/{steps.length}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {steps.map((s) => (
          <span
            key={s.key}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
              s.done
                ? "bg-white/[0.04] border-white/[0.08] text-white/40"
                : "bg-white/[0.02] border-white/[0.12] text-white/70"
            }`}
          >
            {s.done && <Check size={11} className="text-[#C9A9FF]" />}
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          href={next.href}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--brand-purple)] hover:opacity-90 text-white text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
        >
          {next.label} <ArrowRight size={16} />
        </Link>
        {profileUrl && (
          <button
            onClick={share}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            <Share2 size={15} /> Share
          </button>
        )}
      </div>
    </section>
  );
}
