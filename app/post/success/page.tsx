"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight, Info } from "lucide-react";

/**
 * Post-submit confirmation.
 *
 * Two questions every poster had immediately after submitting, neither of which
 * the old redirect-to-dashboard answered:
 *   "Did that work?"        -> a clear confirmation, not a toast that vanishes.
 *   "Why can't I see it?"   -> your own posts are excluded from the feed by
 *                              design; they live in Activity. Saying so here
 *                              stops people re-posting the same gig.
 */
function PostSuccessContent() {
  const params = useSearchParams();
  const gigId = params.get("id");
  const isService = params.get("kind") === "service";

  const steps = isService
    ? [
        "Your listing is in the Talent directory now.",
        "People browse it and message you directly.",
        "Agree the work in chat — they pay before you start.",
      ]
    : [
        "Students can see it and start applying.",
        "You'll get a notification for every application.",
        "Pick someone, pay, and the work begins.",
      ];

  return (
    <div className="min-h-[70dvh] text-[var(--fg)] flex items-center justify-center px-1 py-10">
      <div className="w-full max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-line)] flex items-center justify-center mb-6">
          <CheckCircle2 size={26} className="text-[var(--brand-purple-soft)]" />
        </div>

        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
        >
          {isService ? "You're listed" : "Your gig is live"}
        </h1>
        <p className="text-sm text-[var(--fg-muted)] leading-relaxed mb-7">
          {isService
            ? "People looking to hire can find you from now on."
            : "It's visible to students right now."}
        </p>

        <ol className="space-y-3 mb-7">
          {steps.map((line, i) => (
            <li key={line} className="flex items-start gap-3">
              <span className="w-5 h-5 shrink-0 rounded-full bg-[var(--chip)] border border-[var(--line)] text-[10px] font-semibold text-[var(--fg-muted)] flex items-center justify-center tabular-nums mt-0.5">
                {i + 1}
              </span>
              <span className="text-[13px] text-[var(--fg-muted)] leading-relaxed">{line}</span>
            </li>
          ))}
        </ol>

        {/* The bit that stops duplicate posts. */}
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-[var(--chip)] border border-[var(--line)] mb-7">
          <Info size={15} className="text-[var(--fg-faint)] shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--fg-muted)] leading-relaxed">
            You won&apos;t find it in your own feed — that only shows other people&apos;s
            listings. Track yours, and everyone who applies, in{" "}
            <span className="text-[var(--fg-muted)] font-medium">Activity</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href="/activity"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[var(--accent)] hover:opacity-90 text-[var(--on-accent)] text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            Go to Activity <ArrowRight size={15} />
          </Link>
          {gigId && (
            <Link
              href={`/gig/${gigId}`}
              className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[var(--chip)] hover:bg-[var(--chip-strong)] border border-[var(--line)] text-[var(--fg)] text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
            >
              View it
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PostSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PostSuccessContent />
    </Suspense>
  );
}
