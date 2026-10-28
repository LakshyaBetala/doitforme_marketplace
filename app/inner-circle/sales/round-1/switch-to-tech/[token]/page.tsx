"use client";

// One-click lane switch from Sales → Tech.
//
// Reached from the "Switch to Tech cohort" link in the invite email AND the
// matching link on the entry page. We don't auto-fire on page load — a
// click-through from a mail client's link preview must not silently flip
// someone's lane. The candidate confirms once, we POST, we show the result.

import { useEffect, useState, use } from "react";
import { track } from "@/lib/round1TrackClient";

export default function SwitchToTechPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = useState<"idle" | "switching" | "done" | "already" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    track("switch_tech_viewed", { token });
  }, [token]);

  const confirm = async () => {
    setState("switching");
    setMessage("");
    try {
      const r = await fetch("/api/inner-circle/round1/switch-tech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState("error");
        setMessage(d.error || "Couldn't switch your cohort. Try again.");
        return;
      }
      if (!d.alreadySwitched) track("switch_tech_confirmed", { token });
      setState(d.alreadySwitched ? "already" : "done");
    } catch {
      setState("error");
      setMessage("We couldn't reach the server. Check your connection and try again.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0B0B11] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="h-2 w-2 rounded-full bg-[#8825F5]" />
          <span className="text-xs tracking-[0.18em] uppercase text-white/60">Inner Circle · cohort switch</span>
        </div>

        {state === "idle" || state === "switching" || state === "error" ? (
          <>
            <h1
              className="text-[32px] md:text-[42px] leading-[1.05] font-semibold tracking-[-0.02em]"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
            >
              Move your spot to the <span className="text-[#C9A9FF]">Tech cohort</span>?
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-white/70">
              You&apos;ll come off the Sales track and go on the list for the Tech cohort&apos;s Round 1. When that opens, you&apos;ll get a fresh invite the same way.
            </p>
            <p className="mt-3 text-[13px] text-white/50">
              This is one-way for now — if you change your mind after switching, reply to the invite email and we&apos;ll move you back by hand.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={confirm}
                disabled={state === "switching"}
                className="h-[48px] rounded-lg bg-[#8825F5] px-6 text-[14px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:bg-[#9633ff] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {state === "switching" ? "Switching…" : "Switch me to Tech"}
              </button>
              <a
                href={`/inner-circle/sales/round-1/${encodeURIComponent(token)}`}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-6 text-[14px] text-white/85 hover:bg-white/[0.08] transition"
              >
                Actually, back to Sales
              </a>
            </div>
            {message && <p className="mt-4 text-[13px] text-rose-300">{message}</p>}
          </>
        ) : (
          <>
            <h1
              className="text-[32px] md:text-[42px] leading-[1.05] font-semibold tracking-[-0.02em]"
              style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
            >
              {state === "already" ? "You're already on the Tech list." : "You're on the Tech list."}
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-white/70">
              When the Tech cohort&apos;s Round 1 opens, we&apos;ll invite you the same way the Sales invite came. Nothing else to do right now.
            </p>
            <a
              href="/"
              className="mt-8 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-6 py-2 text-[13px] text-white/85 hover:bg-white/[0.08] transition"
            >
              Back to doitforme.in
            </a>
          </>
        )}
      </div>
    </div>
  );
}
