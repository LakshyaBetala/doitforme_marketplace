"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * WITHOUT THIS FILE A THROWN RENDER ERROR IS A BLANK SCREEN. Next.js has no
 * default error UI in production — it ships the generic grey "Application
 * error" shell with no navigation, so a visitor whose page threw had no route
 * back into the product and no reason to believe anything else worked. Every
 * other failure in this codebase is handled: `not-found.tsx` offers three
 * exits, moderation and KYC fail open, the payment webhook refuses to run
 * unverified. A render throw was the one path that just went white.
 *
 * `reset()` re-renders the segment without a full reload, which is the right
 * first try: most of these are a transient Supabase read, not a broken page.
 * The reload is kept as the second option because `reset()` cannot help when
 * the failure is in the data the segment was given.
 *
 * The error is deliberately NOT rendered to the visitor. A Supabase error
 * message carries table and column names, and this screen is reachable by
 * anyone. It goes to the console, which is where the error-monitoring hook
 * belongs once one is wired up — see CLAUDE.md on there being none today.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // `digest` is the only safe correlator: it is the hash Next puts in the
    // server log for this same throw, so a support conversation can be tied to
    // a log line without showing the visitor the message.
    console.error("[error-boundary]", error.digest ?? "no-digest", error);
  }, [error]);

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-purple-soft)] mb-3">
          Something broke
        </p>

        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight mb-3"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
        >
          This page didn&apos;t load
        </h1>

        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-8">
          The problem is on our side, not yours. Nothing you were doing was lost
          — any money held in escrow stays held until you approve it.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[var(--brand-purple)] hover:opacity-90 text-white text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-[var(--foreground-muted)] text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            Home
          </Link>
        </div>

        {error.digest ? (
          <p className="mt-8 text-[11px] text-[var(--foreground-muted)] font-mono">
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
