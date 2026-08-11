import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Page not found · doitforme",
};

/**
 * Global 404.
 *
 * Offers three real exits rather than a single "go home" — someone who lands
 * here from a shared gig link that expired wants the feed, not the landing page.
 * Expired listings are the most likely way to reach this, so the copy says so
 * instead of implying the visitor typed something wrong.
 */
export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-[var(--background)] text-white flex items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        <div className="relative w-32 h-32 mx-auto mb-8 opacity-90">
          <Image
            src="/hisloth.png"
            alt=""
            fill
            sizes="128px"
            className="object-contain animate-[float_8s_ease-in-out_infinite]"
            priority
          />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-purple-soft)] mb-3">
          404
        </p>

        <h1
          className="text-2xl md:text-3xl font-semibold tracking-tight mb-3"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
        >
          This one got away
        </h1>

        <p className="text-sm text-white/60 leading-relaxed mb-8">
          The page you&apos;re after doesn&apos;t exist any more. Gigs close once they&apos;re
          taken, so a link someone shared with you may have already found its person.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[var(--brand-purple)] hover:opacity-90 text-white text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            Find work
          </Link>
          <Link
            href="/talent"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            Browse talent
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] text-white/70 text-sm font-semibold transition active:scale-[0.99] min-h-[44px]"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
