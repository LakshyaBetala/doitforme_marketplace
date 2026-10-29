import Link from "next/link";

/**
 * "Round 1 · Sales is live" — the one announcement the landing page and the
 * hold page share, so the two cannot drift apart.
 *
 * Built to be impossible to miss, because the first version was not: it sat
 * inside the purple Inner Circle panel with a lavender eyebrow and a
 * translucent button, and read as part of the panel's furniture (~2.9:1 and
 * ~2.2:1 contrast on the fill). Purple is the Inner Circle's own colour on the
 * hold page, so the card keeps it as a SOLID fill and puts only white on it:
 * white on #8825F5 is 5.8:1, and the solid white button is the one shape
 * nothing else on either page uses. Never put /70-or-lighter white, or the
 * soft lavender, on this fill — both drop under 4.5:1.
 *
 * /inner-circle/sales/round-1 is the RETURN login (email + date of birth);
 * first entry is the tokened link in the invite email. That login refuses, by
 * design, to say whether an address is on the list, so the card names who the
 * button is for and gives everyone else the way in.
 */
export default function Round1LiveBanner({
  joinHref,
  className = "",
}: {
  /** Where "Not invited yet?" goes: the waitlist form with the Inner Circle box. */
  joinHref: string;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="round1-live-title"
      className={`relative overflow-hidden rounded-2xl bg-[#8825F5] p-5 text-white sm:p-6 ${className}`}
    >
      <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white">
        <span className="relative flex h-2 w-2" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        Inner Circle &middot; Round 1
      </p>
      <h2
        id="round1-live-title"
        className="mt-2 text-[26px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[30px]"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Sales is live.
      </h2>
      <p className="mt-2 max-w-[52ch] text-[14.5px] leading-[1.6] text-white/90">
        The first cohort is being picked now: thirty qualified leads, twenty-four hours, read by a
        human who writes back either way.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <Link
          href="/inner-circle/sales/round-1"
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-white px-5 text-[15px] font-bold text-[#8825F5] transition-transform hover:-translate-y-px active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#8825F5]"
        >
          Open my Round 1 task <span aria-hidden>&rarr;</span>
        </Link>
        <p className="text-[13.5px] leading-[1.55] text-white/90">
          Invited? Sign in with your email and date of birth.
          <br />
          Not invited yet?{" "}
          <Link
            href={joinHref}
            className="font-semibold text-white underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
          >
            Put your hand up
          </Link>{" "}
          &mdash; invites go out by email, in batches.
        </p>
      </div>
    </section>
  );
}
