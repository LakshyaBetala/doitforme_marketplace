"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { blurOnWheel } from "@/lib/inputs";

/**
 * The page everyone sees while Supabase is restricted.
 *
 * Supabase Auth and REST both answer 402, so login, signup, the feed and every
 * gig page are dead. Showing people a broken login form is worse than showing
 * them nothing — students were already emailing support about "authentication
 * errors" within hours.
 *
 * So this says plainly what is happening, and then does the one useful thing
 * still possible: captures the people who turn up. At ~100 signups a day, a week
 * of bouncing them is most of a month's growth. Their details go to Cloudflare
 * D1 (see /api/waitlist), which has nothing to do with Supabase and keeps
 * working regardless.
 *
 * No password is asked for. We cannot create a real account without Supabase
 * Auth, and collecting credentials into a side store to replay later is how you
 * end up with passwords hashed two different ways. They get an invite instead.
 */

const INPUT =
  "w-full rounded-xl bg-[#0B0B11] border border-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#8825F5] focus:ring-1 focus:ring-[#8825F5] transition";

export default function MaintenancePage() {
  const [form, setForm] = useState({
    email: "",
    name: "",
    phone: "",
    college: "",
    lookingFor: "",
  });
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
    if (!form.email.trim()) return setMessage("Please add your email so we can reach you.");
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
        setMessage(data.error || "Couldn't save that. Please try again.");
        return;
      }
      setStatus("done");
      setWaiting((n) => (n === null ? null : n + 1));
    } catch {
      setStatus("error");
      setMessage("Couldn't reach us. Check your connection and try again.");
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#0B0B11] text-white flex flex-col">
      <div className="mx-auto w-full max-w-xl px-5 py-12 md:py-16 flex-1">
        {/* Mascot + status */}
        <div className="flex flex-col items-center text-center">
          <Image
            src="/sloth.png"
            alt="The DoItForMe sloth, taking a well-earned break"
            width={132}
            height={132}
            priority
            className="rounded-[26px]"
          />
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#8825F5]/25 bg-[#8825F5]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#C9A9FF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C9A9FF] animate-pulse" />
            Upgrading
          </span>

          <h1
            className="mt-5 text-3xl md:text-[40px] font-semibold leading-[1.1] tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
          >
            We&apos;re rebuilding
            <br />
            <span className="text-[#C9A9FF]">something bigger.</span>
          </h1>

          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            DoItForMe is offline for about a week while we move to infrastructure that can
            handle what&apos;s coming — more companies, bigger budgets, and a lot more work
            worth doing.
          </p>
          <p className="mt-3 text-[13px] text-white/40">
            Your account, your gigs and your money are all safe. Nothing has been lost.
          </p>
        </div>

        {/* What's coming — the reason to leave an email rather than forget us */}
        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#13131A] p-5 md:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            What you&apos;ll come back to
          </p>
          <ul className="mt-4 space-y-3">
            {[
              ["Paid company work", "Real businesses posting briefs with real budgets — not just campus odd jobs."],
              ["Your own shopfront", "List what you do, set your rate, and let clients come to you."],
              ["Money held safely", "Clients pay up front into escrow. You get paid when the work is approved."],
              ["First access", "Everyone on this list gets in before we reopen to the public."],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8825F5]" />
                <span>
                  <span className="block text-[14px] font-semibold text-white">{title}</span>
                  <span className="block text-[13px] leading-relaxed text-white/55">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Capture */}
        <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#13131A] p-5 md:p-6">
          {status === "done" ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#8825F5]/15 text-2xl">
                ✓
              </div>
              <h2
                className="text-xl font-semibold tracking-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                You&apos;re on the list
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-white/60">
                We&apos;ll email <span className="text-white/85">{form.email}</span> the moment
                we&apos;re back, with a link to finish setting up your account. You won&apos;t
                have to queue.
              </p>
              <button
                onClick={() => {
                  setStatus("idle");
                  setForm({ email: "", name: "", phone: "", college: "", lookingFor: "" });
                }}
                className="mt-5 text-[13px] font-semibold text-[#C9A9FF] hover:text-white transition"
              >
                Add someone else
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h2
                  className="text-xl font-semibold tracking-tight"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Save your spot
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">
                  Leave your details and we&apos;ll set your account up for you. No password
                  needed now — we&apos;ll send you a link when we reopen.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {([
                  ["student", "I want to earn"],
                  ["company", "I want to hire"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setIntent(value)}
                    className={`rounded-xl border px-3 py-3 text-[13px] font-semibold transition ${
                      intent === value
                        ? "border-[#8825F5] bg-[#8825F5]/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/55 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="Email address"
                value={form.email}
                onChange={set("email")}
                className={INPUT}
              />
              <input
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={form.name}
                onChange={set("name")}
                className={INPUT}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="Phone (optional)"
                  value={form.phone}
                  onChange={set("phone")}
                  onWheel={blurOnWheel}
                  className={INPUT}
                />
                <input
                  type="text"
                  placeholder={intent === "company" ? "Company" : "College"}
                  value={form.college}
                  onChange={set("college")}
                  className={INPUT}
                />
              </div>
              <input
                type="text"
                placeholder={
                  intent === "company"
                    ? "What do you need done?"
                    : "What kind of work are you after?"
                }
                value={form.lookingFor}
                onChange={set("lookingFor")}
                className={INPUT}
              />

              {message && <p className="text-[13px] text-red-400">{message}</p>}

              <button
                type="submit"
                disabled={status === "saving"}
                className="w-full rounded-xl bg-[#8825F5] py-3.5 text-[15px] font-semibold text-white transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
              >
                {status === "saving" ? "Saving…" : "Save my spot"}
              </button>

              <p className="text-center text-[11px] leading-relaxed text-white/35">
                We&apos;ll only use this to tell you when we&apos;re back.
                {waiting !== null && (
                  <>
                    {" "}
                    <span className="text-white/55">{waiting.toLocaleString()}</span> already
                    waiting.
                  </>
                )}
              </p>
            </form>
          )}
        </div>

        <p className="mt-8 text-center text-[12px] leading-relaxed text-white/35">
          Already had an account? It&apos;s untouched — sign in as normal once we&apos;re back.
          <br />
          Questions:{" "}
          <a
            href="mailto:doitforme.in@gmail.com"
            className="text-[#C9A9FF] hover:text-white transition"
          >
            doitforme.in@gmail.com
          </a>
        </p>
      </div>
    </main>
  );
}
