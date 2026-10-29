"use client";

// Round 1 entry page — reached via the per-candidate invite link.
//
// This page sells the Inner Circle before it asks for anything. A visitor who
// came here from an invite email already knows DoItForMe exists and they
// opted in; what we need to do is match the premium of the group they're
// joining, not read like a job application. So the whole page is one long
// Sales-themed landing experience: giant animated SALES word, S-A-L-E-S
// breakdown, pipeline visualization, scroll-reveal sections, a ticker at the
// bottom, and only at the bottom does the DOB input + Start button land.
//
// Animations are all native: IntersectionObserver for scroll reveals, CSS
// keyframes for the SALES letters and the marquee, requestAnimationFrame for
// the scroll progress bar and count-up numbers. Zero animation libs.

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { blurOnWheel } from "@/lib/inputs";
import { track } from "@/lib/round1TrackClient";

const SHEET_TEMPLATE_URL =
  "https://docs.google.com/spreadsheets/d/1ILhCN7x1m1ZTQU4vwY7yFK4kOiPeI36jEyD85pyYfrs/edit?usp=sharing";

// ────────────────────────────────────────────────────────────────────────────
// Reusable primitives
// ────────────────────────────────────────────────────────────────────────────

/** Thin fixed bar at the top of the viewport that fills as you scroll. */
function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const scrolled = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, scrolled / max) : 0);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[2px] bg-white/[0.04]">
      <div
        className="h-full bg-[#8825F5] transition-[width] duration-100 ease-out"
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}

/**
 * Wraps children in a div that fades + rises in when it enters the viewport.
 * Uses IntersectionObserver (no animation library). Each section can stagger
 * via the `delay` prop in ms.
 */
function Reveal({
  children,
  delay = 0,
  className = "",
  threshold = 0.15,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setShown(true), delay);
          io.disconnect();
        }
      },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay, threshold]);
  return (
    <div
      ref={ref}
      className={`transition-all duration-[700ms] ease-out ${className} ${
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * Counts from 0 up to `end` once the component scrolls into view. Uses a cubic
 * ease-out so the pace feels like a slot machine landing, not a linear tick.
 */
function CountUp({
  end,
  duration = 1400,
  format = (n: number) => n.toLocaleString("en-IN"),
}: {
  end: number;
  duration?: number;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(eased * end));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [end, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {format(value)}
    </span>
  );
}

/** Infinite horizontal marquee of plain text separated by middots. */
function Marquee({ items }: { items: string[] }) {
  const row = items.join("   ·   ");
  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.015] py-5">
      <div className="flex whitespace-nowrap animate-[round1marquee_60s_linear_infinite]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="px-6 text-[11px] tracking-[0.35em] uppercase text-white/40 font-medium"
          >
            {row}   ·   {row}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function Round1EntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [dob, setDob] = useState("");
  const [status, setStatus] = useState<"idle" | "starting" | "error">("idle");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  // Load-time animation flag for the hero. Setting this on mount triggers the
  // CSS keyframes for the SALES word letter stagger.
  const [heroLive, setHeroLive] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setHeroLive(true), 60);
    return () => clearTimeout(id);
  }, []);

  // Already-claimed candidate on this device? Jump to dashboard.
  useEffect(() => {
    track("invite_opened", { token });
    fetch("/api/inner-circle/round1/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // Any claimed status has a dashboard view -- including expired and
        // the admin's decision. Only 'invited' belongs on this page; sending
        // anyone else here put a "Start my 24 hours" button in front of a
        // candidate whose clock had already run, or whose result was in.
        if (d?.candidate?.status && d.candidate.status !== "invited") {
          router.replace("/inner-circle/sales/round-1/dashboard");
        }
      })
      .catch(() => {});
  }, [router, token]);


  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dob) {
      setStatus("error");
      setMessage("Please enter your date of birth to begin.");
      return;
    }
    track("start_clicked", { token });
    setStatus("starting");
    setMessage("");
    try {
      const r = await fetch("/api/inner-circle/round1/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, dob }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        track("claim_failed", { token, metadata: { status: r.status } });
        setStatus("error");
        setMessage(d.error || "Couldn't start your task. Try again.");
        return;
      }
      track("claim_success", { token });
      router.replace("/inner-circle/sales/round-1/dashboard");
    } catch {
      track("claim_failed", { token, metadata: { reason: "network" } });
      setStatus("error");
      setMessage("We couldn't reach the server. Check your connection and try again.");
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-[#0B0B11] text-white overflow-x-hidden">
      {/* Animations keyframes injected once per page. Keeping them here (vs */}
      {/* globals.css) means this experience doesn't leak into the rest of    */}
      {/* the app's palette. Scoped to the sr1- prefix so there's no clash.   */}
      <style>{`
        @keyframes sr1-letter-in {
          0%   { opacity: 0; transform: translateY(60%) rotate(-6deg); filter: blur(10px); }
          60%  { opacity: 1; transform: translateY(-6%) rotate(0.5deg); filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) rotate(0); filter: blur(0); }
        }
        @keyframes sr1-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(136,37,245,0.0); }
          50%      { box-shadow: 0 0 24px 2px rgba(136,37,245,0.35); }
        }
        @keyframes sr1-pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50%      { transform: scale(1.15); opacity: 1; }
        }
        @keyframes round1marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-25%); }
        }
        @keyframes sr1-scroll-hint {
          0%, 100% { transform: scaleX(1); transform-origin: left; }
          50%      { transform: scaleX(1.6); }
        }
        .sr1-letter {
          display: inline-block;
          opacity: 0;
          transform: translateY(60%);
        }
        .sr1-live .sr1-letter {
          animation: sr1-letter-in 900ms cubic-bezier(.22,1,.36,1) both;
        }
        .sr1-live .sr1-letter:nth-child(1) { animation-delay: 60ms; }
        .sr1-live .sr1-letter:nth-child(2) { animation-delay: 180ms; }
        .sr1-live .sr1-letter:nth-child(3) { animation-delay: 300ms; }
        .sr1-live .sr1-letter:nth-child(4) { animation-delay: 420ms; }
        .sr1-live .sr1-letter:nth-child(5) { animation-delay: 540ms; }
        .sr1-live .sr1-letter:nth-child(6) { animation-delay: 660ms; }
      `}</style>

      {/* Scroll progress + grid bg */}
      <ScrollProgress />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.9), transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.9), transparent 70%)",
        }}
      />
      {/* Soft purple glow behind the hero so it reads as the brightest spot */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 -top-32 -translate-x-1/2 h-[560px] w-[920px] rounded-full blur-[120px] opacity-30"
        style={{ background: "radial-gradient(circle, #8825F5 0%, transparent 60%)" }}
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1120px] flex-col px-5 pt-8 pb-20 md:px-8">
        {/* ─── Masthead ─── */}
        <div className="flex items-center justify-between pb-10">
          <div className="flex items-center gap-2.5">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-[#8825F5] animate-[sr1-pulse_2s_ease-in-out_infinite]" />
              <span className="absolute inset-0 rounded-full bg-[#8825F5]" />
            </span>
            <span className="text-[11px] tracking-[0.2em] uppercase text-white/60">
              Inner Circle · Sales · Round 1
            </span>
          </div>
          <a href="/" className="text-[11px] text-white/40 hover:text-white/70 transition">
            doitforme.in
          </a>
        </div>

        {/* ─── Hero (fills the viewport so SALES stays below the fold) ─── */}
        <section className="min-h-[calc(100dvh-120px)] flex flex-col justify-center pt-4 pb-10">
          <div>
            <Reveal>
              <div className="text-[11px] tracking-[0.2em] uppercase text-[#C9A9FF] mb-5">
                A letter from Mouriyan opened in your inbox.
              </div>
            </Reveal>
            <Reveal delay={120}>
              <h1
                className="text-[36px] sm:text-[48px] md:text-[72px] leading-[0.98] font-semibold tracking-[-0.025em] max-w-[18ch]"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
              >
                You put your hand up.<br />
                <span className="text-white/50">Round 1 starts when you</span>{" "}
                <span className="text-[#C9A9FF]">click Start.</span>
              </h1>
            </Reveal>
            <Reveal delay={260}>
              <p className="mt-7 max-w-xl text-[15px] md:text-[15.5px] leading-relaxed text-white/65">
                One of over{" "}
                <span className="font-semibold text-white">
                  <CountUp end={1300} />
                </span>{" "}
                people who ticked Inner Circle. We're starting with the side that moves
                real money, right now, today.
              </p>
            </Reveal>
          </div>
          {/* Pinned at the bottom of the viewport so the scroll hint is actually at the fold edge */}
          <Reveal delay={500}>
            <div className="mt-auto pt-10 flex items-center gap-2 text-[11px] text-white/35 tracking-[0.14em] uppercase">
              <span>Scroll</span>
              <span
                className="inline-block h-[1px] w-10 bg-white/20"
                style={{ animation: "sr1-scroll-hint 2.4s ease-in-out infinite" }}
              />
              <span className="inline-block text-white/40 translate-y-[-1px]">↓</span>
            </div>
            {/* Second device. Someone who started on a laptop and reopens this
                invite on a phone has no session here, and the only way
                forward was the whole letter, the read-gate, and a button
                labelled "Start my 24 hours" -- with their clock running.
                The claim route never restarts a timer, but the button says
                it might. This sends them to the one-screen return login. */}
            <Link
              href="/inner-circle/sales/round-1"
              className="mt-4 inline-flex min-h-[44px] items-center text-[13px] text-white/60 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8825F5]/50 rounded"
            >
              Already started? Sign in to your task &rarr;
            </Link>
          </Reveal>
        </section>

        {/* ─── SALES giant word ─── */}
        <section className={`py-16 md:py-24 ${heroLive ? "sr1-live" : ""}`}>
          <Reveal>
            <div className="text-[11px] tracking-[0.2em] uppercase text-white/50 mb-6 text-center">
              A five-letter word
            </div>
          </Reveal>
          <h2
            aria-label="SALES."
            className="relative text-center text-[22vw] md:text-[220px] leading-[0.86] font-semibold tracking-[-0.06em] text-[#C9A9FF] select-none"
            style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
          >
            {/* Ghost outline behind for depth */}
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none"
              style={{
                WebkitTextStroke: "1px rgba(201,169,255,0.4)",
                color: "transparent",
              }}
            >
              SALES.
            </span>
            {/* Animated solid letters */}
            <span className="relative inline-flex gap-[0.01em]">
              {["S", "A", "L", "E", "S", "."].map((c, i) => (
                <span key={i} className="sr1-letter">
                  {c}
                </span>
              ))}
            </span>
          </h2>
          <Reveal delay={200}>
            <p className="mt-8 text-center text-[14.5px] text-white/55 max-w-xl mx-auto">
              The thing that moved the first spice from Kerala to Rome. The thing
              that will move Indian software to Silicon Valley. Not a department.
              The muscle.
            </p>
          </Reveal>
        </section>

        {/* ─── S-A-L-E-S breakdown ─── */}
        <section className="py-16">
          <Reveal>
            <div className="text-[11px] tracking-[0.2em] uppercase text-white/50 mb-8">
              Five letters, one job
            </div>
          </Reveal>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { l: "S", word: "Spot", line: "the opportunity before it hits the inbox" },
              { l: "A", word: "Approach", line: "the actual decision-maker, not the gate" },
              { l: "L", word: "Lead", line: "the conversation to what matters" },
              { l: "E", word: "Earn", line: "the trust before you ask for the signature" },
              { l: "S", word: "Seal", line: "the deal without hoping" },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="group h-full rounded-xl border border-white/[0.08] bg-[#13131A] p-5 transition-all duration-300 hover:border-[#8825F5]/40 hover:bg-[#17121F] hover:-translate-y-0.5">
                  <div
                    className="text-[48px] leading-none font-semibold text-[#C9A9FF] transition-transform duration-300 group-hover:scale-110 origin-left"
                    style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
                  >
                    {item.l}
                  </div>
                  <div className="mt-3 text-[14px] font-semibold text-white tracking-tight">
                    {item.word}
                  </div>
                  <div className="mt-1.5 text-[12px] leading-relaxed text-white/55">
                    {item.line}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ─── Pipeline: 3 rounds ─── */}
        <section className="py-20">
          <Reveal>
            <div className="text-[11px] tracking-[0.2em] uppercase text-white/50 mb-10">
              Your pipeline
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="relative">
              {/* Connecting line, hidden on mobile where cards stack */}
              <div
                aria-hidden
                className="hidden md:block absolute top-[36px] left-[8%] right-[8%] h-[1px] bg-gradient-to-r from-transparent via-white/[0.14] to-transparent"
              />
              <div className="grid gap-5 md:grid-cols-3 relative">
                {[
                  {
                    tag: "Round 1",
                    chip: "24 hrs · you are here",
                    title: "The lead-list brief",
                    body: "30 qualified B2B prospects for an India-based AI/IT consultancy. Honest work, done the way you'd actually do it.",
                    current: true,
                  },
                  {
                    tag: "Round 2",
                    chip: "24 hrs",
                    title: "A real-world task",
                    body: "Briefed only if you clear Round 1. Live situation, not a case study.",
                  },
                  {
                    tag: "Round 3",
                    chip: "~30 min",
                    title: "A conversation",
                    body: "Us, you, and the shape of what comes next inside the Inner Circle.",
                  },
                ].map((r, i) => (
                  <div
                    key={i}
                    className={`relative rounded-2xl border p-6 pt-10 transition-all duration-300 ${
                      r.current
                        ? "border-[#8825F5]/50 bg-[#17121F] shadow-[0_0_40px_-12px_rgba(136,37,245,0.4)]"
                        : "border-white/[0.08] bg-[#13131A] hover:border-white/20"
                    }`}
                  >
                    {/* Node dot sitting on the pipeline line */}
                    <div className="hidden md:flex absolute -top-3 left-1/2 -translate-x-1/2 items-center justify-center">
                      <span
                        className={`relative inline-flex h-5 w-5 rounded-full border-2 ${
                          r.current
                            ? "border-[#8825F5] bg-[#8825F5]"
                            : "border-white/20 bg-[#0B0B11]"
                        }`}
                      >
                        {r.current && (
                          <span
                            className="absolute inset-[-6px] rounded-full border border-[#8825F5]/60 animate-[sr1-pulse_2s_ease-in-out_infinite]"
                          />
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="text-[11px] tracking-[0.18em] uppercase text-[#C9A9FF] font-semibold">
                        {r.tag}
                      </div>
                      <div
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase ${
                          r.current
                            ? "border-[#8825F5]/50 bg-[#8825F5]/15 text-[#C9A9FF]"
                            : "border-white/10 bg-white/[0.03] text-white/50"
                        }`}
                      >
                        {r.chip}
                      </div>
                    </div>
                    <div
                      className="text-[18px] font-semibold text-white tracking-tight mb-2"
                      style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
                    >
                      {r.title}
                    </div>
                    <div className="text-[13.5px] leading-relaxed text-white/65">
                      {r.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* ─── Metrics strip ─── */}
        <section className="py-16">
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { n: 1300, label: "ticked Inner Circle", suffix: "+" },
                { n: 24, label: "hours per round", suffix: "h" },
                { n: 30, label: "leads to source", suffix: "" },
                { n: 3, label: "rounds, then in", suffix: "" },
              ].map((m, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 transition-colors duration-300 hover:bg-white/[0.04]"
                >
                  <div
                    className="text-[42px] leading-none font-semibold text-white tracking-[-0.02em]"
                    style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
                  >
                    <CountUp end={m.n} />
                    {m.suffix}
                  </div>
                  <div className="mt-2 text-[12px] text-white/50 tracking-wider uppercase">
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ─── The task preview ─── */}
        <section className="py-16">
          <Reveal>
            <div className="rounded-2xl border border-white/[0.08] bg-[#13131A] p-7 md:p-9">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="text-[11px] tracking-[0.2em] uppercase text-[#C9A9FF] mb-2">
                    Round 1
                  </div>
                  <h3
                    className="text-[24px] md:text-[28px] font-semibold tracking-[-0.01em]"
                    style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
                  >
                    What we're asking of you
                  </h3>
                </div>
                <div className="hidden md:inline-flex items-center rounded-full border border-[#8825F5]/40 bg-[#8825F5]/10 px-3 py-1 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#C9A9FF]">
                  24 Hours
                </div>
              </div>

              <ol className="space-y-4 text-[14.5px] leading-relaxed text-white/80">
                {[
                  "Clone the template sheet we share. Keep its column headers as they are, we read every submission in the same shape.",
                  "Find 30 Indian companies that could use an AI/IT consultancy. LinkedIn is the obvious primary source; use whatever gives you real decision-makers.",
                  "Pull the decision-maker's name, role, email and phone where you can. Apollo, ContactOut, Lusha, Hunter, pick your tool.",
                  "One line per row on why this company is a fit. That column is where you actually stand out.",
                  "Share the sheet with doitforme.in@gmail.com (editor or viewer), then paste the sheet URL in the submission box here.",
                ].map((line, i) => (
                  <li key={i} className="flex gap-4">
                    <span
                      className="shrink-0 text-[13px] font-semibold text-[#C9A9FF] w-6 pt-0.5"
                      style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
                    >
                      0{i + 1}
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-10 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!ready) track("brief_expanded", { token });
                    setReady((v) => !v);
                    // Scroll to the start form when they say they're ready
                    if (!ready) {
                      setTimeout(() => {
                        document.getElementById("sr1-start")?.scrollIntoView({ behavior: "smooth", block: "center" });
                      }, 150);
                    }
                  }}
                  className={`group inline-flex items-center justify-center gap-2 rounded-xl px-7 py-4 text-[15px] font-bold tracking-[-0.005em] transition-all ${
                    ready
                      ? "bg-white/[0.08] border border-white/15 text-white hover:bg-white/[0.12]"
                      : "bg-[#8825F5] text-white shadow-[0_8px_30px_-8px_rgba(136,37,245,0.6),0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:bg-[#9633ff] hover:shadow-[0_12px_40px_-8px_rgba(136,37,245,0.8),0_0_0_1px_rgba(255,255,255,0.08)_inset]"
                  }`}
                >
                  {ready ? "I need another look" : (
                    <>
                      I've read this · take me to Start
                      <span className="inline-block transition-transform duration-300 group-hover:translate-x-0.5">→</span>
                    </>
                  )}
                </button>
                <a
                  href={SHEET_TEMPLATE_URL}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => track("template_clicked_pre", { token })}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-transparent px-7 py-4 text-[15px] font-bold text-white hover:bg-white/[0.05] hover:border-white/25 transition-all"
                >
                  Preview the template sheet
                  <span className="text-white/60">↗</span>
                </a>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ─── Start form ─── */}
        <section id="sr1-start" className="py-16 scroll-mt-16">
          <Reveal>
            <form
              onSubmit={start}
              className={`relative rounded-2xl border p-7 md:p-9 transition-all duration-500 ${
                ready
                  ? "border-[#8825F5]/50 bg-gradient-to-br from-[#17121F] to-[#13131A]"
                  : "border-white/[0.08] bg-[#13131A] opacity-80"
              }`}
              style={ready ? { animation: "sr1-glow 2.4s ease-in-out infinite" } : undefined}
              aria-disabled={!ready}
            >
              <div className="text-[11px] tracking-[0.2em] uppercase text-[#C9A9FF] mb-3">
                Begin
              </div>
              <h3
                className="text-[28px] md:text-[36px] font-semibold tracking-[-0.015em]"
                style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
              >
                Start your 24 hours
              </h3>
              <p className="mt-3 text-[14px] text-white/60 max-w-xl">
                Your date of birth is how you'll sign back in if you lose the tab.
                No password. Nothing else to remember.
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label className="block">
                  <span className="block text-[11px] uppercase tracking-[0.14em] text-white/50 mb-2">
                    Date of birth
                  </span>
                  <input
                    type="date"
                    autoComplete="bday"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    onWheel={blurOnWheel}
                    className="w-full min-h-[52px] rounded-lg bg-[#0B0B11] border border-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors focus-visible:border-[#8825F5] focus-visible:ring-2 focus-visible:ring-[#8825F5]/40"
                    disabled={!ready || status === "starting"}
                    max={new Date().toISOString().slice(0, 10)}
                    min="1950-01-01"
                  />
                </label>
                <button
                  type="submit"
                  disabled={!ready || status === "starting"}
                  className="group h-[52px] rounded-lg bg-[#8825F5] px-7 text-[14.5px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:bg-[#9633ff] disabled:opacity-50 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
                >
                  {status === "starting" ? (
                    <>Starting…</>
                  ) : (
                    <>
                      Start my 24 hours
                      <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </>
                  )}
                </button>
              </div>
              {message && (
                <p className={`mt-4 text-[13px] ${status === "error" ? "text-rose-300" : "text-white/70"}`}>
                  {message}
                </p>
              )}
              <p className="mt-6 text-[12px] text-white/40 flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-white/30" />
                Clock starts the moment you click Start. Not before.
              </p>
            </form>
          </Reveal>
        </section>

        {/* ─── Switch to Tech ─── */}
        <section className="py-10">
          <Reveal>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 md:p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="text-[13.5px] text-white/60 leading-relaxed">
                  More interested in <strong className="text-white">building</strong> than
                  selling? Totally fair. Hold your spot for the Tech cohort instead.
                </div>
                <a
                  href={`/inner-circle/sales/round-1/switch-to-tech/${encodeURIComponent(token)}`}
                  className="shrink-0 inline-flex items-center justify-center rounded-lg border border-white/15 bg-transparent px-4 py-2 text-[13px] text-white/85 hover:bg-white/[0.06] transition whitespace-nowrap"
                >
                  Switch to Tech cohort →
                </a>
              </div>
            </div>
          </Reveal>
        </section>
      </div>

      {/* ─── Marquee ticker at bottom ─── */}
      <Marquee
        items={[
          // Floors, not live counts: these only grow, so a floor stays true.
          // Live D1 2026-10-29: 1,323 Inner Circle opt-ins, 2,207 on the waitlist.
          "1,300+ asked for the Inner Circle",
          "2,200+ on the waitlist",
          "24 hours per round",
          "30 B2B prospects",
          "Sales cohort opens first",
          "Round 1 live now",
          "Questions? Reply to your invite email",
        ]}
      />

      {/* Footer */}
      <div className="relative mx-auto max-w-[1120px] px-5 md:px-8 py-10 text-center">
        <div className="text-[11px] text-white/30 tracking-[0.08em]">
          doitforme.in · the invite link stays live for 7 days
        </div>
      </div>
    </div>
  );
}
