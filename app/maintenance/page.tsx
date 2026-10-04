"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { blurOnWheel } from "@/lib/inputs";

/**
 * The page shown to anyone trying to get INTO the product while Supabase is
 * restricted (402, exceed_storage_size_quota). The landing page and the legal
 * pages stay up — see proxy.ts — because they need no backend and a first-time
 * visitor should still learn what this is.
 *
 * Tone is the design decision here. The mascot is a sloth; the brand's own joke
 * is being unbothered about speed. So this does not apologise or call itself an
 * inconvenience — it says we are taking our time, and means it. An apologetic
 * outage notice would be both off-brand and the template every other site uses.
 *
 * Boldness is spent in exactly one place: the Inner Circle panel is the only
 * filled surface on the page. Everything else is hairlines on near-black, so
 * the one thing we want remembered is the one thing that is loud.
 */

const FIELD =
  "w-full min-h-[48px] rounded-lg bg-[#0B0B11] border border-white/10 px-4 py-3 text-[15px] text-white " +
  "placeholder:text-white/35 outline-none transition-colors focus-visible:border-[#8825F5] " +
  "focus-visible:ring-2 focus-visible:ring-[#8825F5]/40";

export default function MaintenancePage() {
  const [form, setForm] = useState({ email: "", name: "", phone: "", college: "", lookingFor: "" });
  const [intent, setIntent] = useState<"student" | "company">("student");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((d) => typeof d.count === "number" && d.count > 0 && setWaiting(d.count))
      .catch(() => {});
  }, []);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim()) return setMessage("Add an email so we know where to find you.");
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, intent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "That didn't save. Try again.");
        return;
      }
      setStatus("done");
      setWaiting((n) => (n === null ? null : n + 1));
    } catch {
      setStatus("error");
      setMessage("We couldn't reach the server. Check your connection and try again.");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#0B0B11] text-[#FAFAFA]">
      <style>{`
        @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .rise { animation: rise .6s cubic-bezier(.2,.7,.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .rise { animation: none; }
        }
      `}</style>

      <div className="mx-auto w-full max-w-[1120px] px-5 sm:px-8 py-14 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:items-start">
          {/* ───────────── statement ───────────── */}
          <div className="order-1">
            <p className="rise flex items-center gap-2.5 text-[13px] text-white/45" style={{ animationDelay: "0ms" }}>
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#8825F5]/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C9A9FF]" />
              </span>
              Offline while we rebuild
            </p>

            <h1
              className="rise mt-6 text-[clamp(2.75rem,8vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.035em]"
              style={{ fontFamily: "'Space Grotesk', sans-serif", animationDelay: "60ms" }}
            >
              Taking
              <br />
              our time.
            </h1>

            <p
              className="rise mt-7 max-w-[46ch] text-[16px] leading-[1.65] text-white/65"
              style={{ animationDelay: "120ms" }}
            >
              DoItForMe is down for about a week while we rebuild the parts you don&apos;t see.
              Your account, your gigs and your money are exactly where you left them.
            </p>

            {/* The form. Quiet by design — hairline, no fill — so the Inner
                Circle stays the loudest thing on the page. */}
            <div
              className="rise mt-10 rounded-2xl border border-white/[0.08] bg-[#13131A] p-5 sm:p-7"
              style={{ animationDelay: "180ms" }}
            >
              {status === "done" ? (
                <div className="py-4">
                  <h2
                    className="text-[22px] font-semibold tracking-[-0.02em]"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    You&apos;re on the list.
                  </h2>
                  <p className="mt-2.5 max-w-[42ch] text-[14px] leading-[1.6] text-white/60">
                    We&apos;ll write to{" "}
                    <span className="text-white/90">{form.email}</span> the day we reopen, with a
                    link that finishes your account in one step. No queue.
                  </p>
                  <button
                    onClick={() => {
                      setStatus("idle");
                      setForm({ email: "", name: "", phone: "", college: "", lookingFor: "" });
                    }}
                    className="mt-5 min-h-[44px] text-[14px] font-medium text-[#C9A9FF] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8825F5]/50 rounded"
                  >
                    Add someone else
                  </button>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <h2
                    className="text-[22px] font-semibold tracking-[-0.02em]"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    Tell us where to find you
                  </h2>
                  <p className="mt-2 max-w-[46ch] text-[14px] leading-[1.6] text-white/55">
                    No password needed. We build your account and send you a link when we&apos;re
                    back.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-2.5" role="group" aria-label="What brings you here">
                    {([
                      ["student", "I want to earn"],
                      ["company", "I want to hire"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={intent === value}
                        onClick={() => setIntent(value)}
                        className={`min-h-[48px] rounded-lg border px-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8825F5]/50 ${
                          intent === value
                            ? "border-[#8825F5]/60 bg-[#8825F5]/[0.12] text-white"
                            : "border-white/10 bg-white/[0.02] text-white/55 hover:text-white/85"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 space-y-3">
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      aria-label="Email address"
                      placeholder="Email address"
                      value={form.email}
                      onChange={set("email")}
                      className={FIELD}
                    />
                    <input
                      type="text"
                      autoComplete="name"
                      aria-label="Your name"
                      placeholder="Your name"
                      value={form.name}
                      onChange={set("name")}
                      className={FIELD}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        aria-label="Phone number, optional"
                        placeholder="Phone (optional)"
                        value={form.phone}
                        onChange={set("phone")}
                        onWheel={blurOnWheel}
                        className={FIELD}
                      />
                      <input
                        type="text"
                        aria-label={intent === "company" ? "Company" : "College"}
                        placeholder={intent === "company" ? "Company" : "College"}
                        value={form.college}
                        onChange={set("college")}
                        className={FIELD}
                      />
                    </div>
                    <input
                      type="text"
                      aria-label={intent === "company" ? "What you need done" : "What work you want"}
                      placeholder={
                        intent === "company" ? "What do you need done?" : "What work are you after?"
                      }
                      value={form.lookingFor}
                      onChange={set("lookingFor")}
                      className={FIELD}
                    />
                  </div>

                  {message && (
                    <p role="alert" className="mt-3 text-[13px] text-red-400">
                      {message}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "saving"}
                    className="mt-5 w-full min-h-[52px] rounded-lg bg-[#8825F5] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A9FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#13131A]"
                  >
                    {status === "saving" ? "Saving" : "Save my spot"}
                  </button>

                  <p className="mt-3 text-[12px] leading-[1.6] text-white/35">
                    One email when we reopen. Nothing else.
                    {waiting !== null && (
                      <> {waiting.toLocaleString()} people are already on the list.</>
                    )}
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* ───────────── mascot + the one loud thing ───────────── */}
          <div className="order-2 lg:pt-2">
            <div className="rise flex justify-center lg:justify-start" style={{ animationDelay: "90ms" }}>
              <Image
                src="/sloth.png"
                alt="The DoItForMe sloth, arms folded, entirely unhurried"
                width={200}
                height={200}
                priority
                className="h-[132px] w-[132px] sm:h-[168px] sm:w-[168px] lg:h-[200px] lg:w-[200px] rounded-[28px]"
              />
            </div>

            {/* The only filled surface on the page. */}
            <section
              className="rise mt-9 overflow-hidden rounded-2xl bg-[#8825F5]"
              style={{ animationDelay: "240ms" }}
              aria-labelledby="inner-circle"
            >
              <div className="p-6 sm:p-7">
                <p className="text-[13px] font-medium text-white/70">Arriving with the relaunch</p>
                <h2
                  id="inner-circle"
                  className="mt-2 text-[28px] sm:text-[32px] font-semibold leading-[1.05] tracking-[-0.03em] text-white"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  The Inner Circle
                </h2>
                <p className="mt-4 max-w-[44ch] text-[14.5px] leading-[1.65] text-white/85">
                  A small group of students we put in front of real companies first. Paid briefs,
                  proper budgets, and work worth putting your name on.
                </p>
                <p className="mt-3 max-w-[44ch] text-[14.5px] leading-[1.65] text-white/70">
                  It&apos;s invite-only — and this list is where the invitations come from.
                </p>
              </div>
              <div className="border-t border-white/20 px-6 sm:px-7 py-4">
                <p className="text-[13px] text-white/75">
                  Premium side of DoItForMe. Same escrow, bigger work.
                </p>
              </div>
            </section>

            <dl className="mt-9 space-y-5">
              {[
                ["Your own shopfront", "List what you do, set your rate, let clients come to you."],
                ["Money held up front", "Clients pay into escrow before you start. Released when the work is approved."],
                ["Company work, not odd jobs", "Real briefs from real businesses, with budgets to match."],
              ].map(([term, detail]) => (
                <div key={term} className="border-l border-white/[0.14] pl-4">
                  <dt className="text-[14.5px] font-semibold text-white">{term}</dt>
                  <dd className="mt-1 max-w-[42ch] text-[13.5px] leading-[1.6] text-white/55">
                    {detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <footer className="mt-16 border-t border-white/[0.08] pt-7 text-[13px] leading-[1.7] text-white/40">
          <p>
            Already have an account? It&apos;s untouched — sign in as normal when we&apos;re back.
          </p>
          <p className="mt-1">
            Anything urgent:{" "}
            <a
              href="mailto:doitforme.in@gmail.com"
              className="text-[#C9A9FF] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8825F5]/50 rounded"
            >
              doitforme.in@gmail.com
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
