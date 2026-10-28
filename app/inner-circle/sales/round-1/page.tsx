"use client";

// Return-visit login for the Round 1 portal.
//
// Reached when a candidate hits /inner-circle/sales/round-1 directly — a
// bookmark, a reminder email after the session cookie expired, a different
// device. They identify with email + DOB; both are checked server-side
// against the row's dob_hash. Error messages never confirm whether the email
// is on the list.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/round1TrackClient";

export default function Round1LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [state, setState] = useState<"idle" | "signing" | "error">("idle");
  const [message, setMessage] = useState("");

  // If a valid session cookie is already set, skip straight to the dashboard.
  useEffect(() => {
    fetch("/api/inner-circle/round1/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.candidate) router.replace("/inner-circle/sales/round-1/dashboard");
      })
      .catch(() => {});
  }, [router]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (!email.trim() || !dob) {
      setState("error");
      setMessage("Enter your email and date of birth.");
      return;
    }
    track("login_attempted");
    setState("signing");
    try {
      const r = await fetch("/api/inner-circle/round1/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), dob }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        track("login_failed", { metadata: { status: r.status } });
        setState("error");
        setMessage(d.error || "Couldn't sign you in.");
        return;
      }
      track("login_success");
      router.replace("/inner-circle/sales/round-1/dashboard");
    } catch {
      track("login_failed", { metadata: { reason: "network" } });
      setState("error");
      setMessage("We couldn't reach the server. Check your connection and try again.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0B0B11] text-white flex flex-col">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-5 py-10 md:px-8">
        <div className="flex items-center gap-2 mb-8">
          <span className="h-2 w-2 rounded-full bg-[#8825F5]" />
          <span className="text-xs tracking-[0.18em] uppercase text-white/60">Inner Circle · Sales · Round 1</span>
        </div>

        <h1
          className="text-[32px] md:text-[38px] leading-[1.05] font-semibold tracking-[-0.02em]"
          style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
        >
          Sign back in
        </h1>
        <p className="mt-3 text-[14px] text-white/60">
          Use the email you got the invite at, and the date of birth you set when you clicked Start. Your 24-hour clock keeps running wherever it is.
        </p>

        <form onSubmit={signIn} className="mt-8 space-y-4">
          <label className="block">
            <span className="block text-[12px] uppercase tracking-[0.14em] text-white/50 mb-1.5">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full min-h-[48px] rounded-lg bg-[#13131A] border border-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors focus-visible:border-[#8825F5] focus-visible:ring-2 focus-visible:ring-[#8825F5]/40"
              disabled={state === "signing"}
            />
          </label>
          <label className="block">
            <span className="block text-[12px] uppercase tracking-[0.14em] text-white/50 mb-1.5">Date of birth</span>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full min-h-[48px] rounded-lg bg-[#13131A] border border-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors focus-visible:border-[#8825F5] focus-visible:ring-2 focus-visible:ring-[#8825F5]/40"
              disabled={state === "signing"}
              max={new Date().toISOString().slice(0, 10)}
              min="1950-01-01"
            />
          </label>
          <button
            type="submit"
            disabled={state === "signing"}
            className="h-[48px] w-full rounded-lg bg-[#8825F5] px-6 text-[14px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:bg-[#9633ff] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {state === "signing" ? "Signing in…" : "Sign in"}
          </button>
          {message && <p className="text-[13px] text-rose-300">{message}</p>}
        </form>

        <p className="mt-10 text-[12px] text-white/40">
          Haven&apos;t started yet? Open the invite link in your email — the clock only starts there.
        </p>
      </div>
    </div>
  );
}
