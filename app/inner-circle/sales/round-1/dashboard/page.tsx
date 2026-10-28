"use client";

// Round 1 candidate dashboard. The one page that renders every status in the
// lifecycle: active, submitted, expired, decided (advanced/rejected), or
// switched-to-Tech. Everything is driven by /me, which the server computes
// from the D1 row, so this component holds no derived state the server does
// not already have.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/round1TrackClient";

type Status =
  | "invited"
  | "started"
  | "submitted"
  | "expired"
  | "advanced"
  | "rejected"
  | "switched_to_tech";

interface Candidate {
  email: string;
  name: string | null;
  status: Status;
  invited_at: number;
  started_at: number | null;
  deadline_at: number | null;
  campaign_closes_at: number;
  submission_url: string | null;
  submitted_at: number | null;
  secondsLeft: number | null;
}

interface MeResponse {
  candidate: Candidate;
  templateUrl: string | null;
}

export default function Round1Dashboard() {
  const router = useRouter();

  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "error">("idle");
  const [submitError, setSubmitError] = useState("");
  // Local countdown derived from secondsLeft; re-synced on every /me refresh.
  const [tick, setTick] = useState(0);
  // Fire-once guards for events that should log exactly once per session.
  const trackedDashboardViewed = useRef(false);
  const trackedCountdownCritical = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/inner-circle/round1/me", { credentials: "include" });
      if (r.status === 401) {
        router.replace("/inner-circle/sales/round-1");
        return;
      }
      if (!r.ok) {
        setLoading(false);
        return;
      }
      const d = (await r.json()) as MeResponse;
      setData(d);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { refresh(); }, [refresh]);

  // One global 1-second tick that drives the countdown display. Re-fetching
  // /me when the clock hits zero is what flips the UI into the expired state
  // (the cron will have run first).
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!data) return;
    if (data.candidate.status === "started" && !trackedDashboardViewed.current) {
      trackedDashboardViewed.current = true;
      track("dashboard_viewed");
    }
    if (data.candidate.status !== "started") return;
    const sl = (data.candidate.secondsLeft ?? 0) - tick;
    if (sl > 0 && sl <= 3 * 3600 && !trackedCountdownCritical.current) {
      trackedCountdownCritical.current = true;
      track("countdown_critical", { metadata: { secondsLeft: sl } });
    }
    if (sl <= 0) refresh();
  }, [tick, data, refresh]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0B0B11] text-white flex items-center justify-center">
        <div className="text-sm text-white/50">Loading your Round 1 portal…</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[100dvh] bg-[#0B0B11] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-[16px] font-medium text-white mb-2">Portal unavailable</div>
          <p className="text-[13px] text-white/60">Something went wrong loading your Round 1 state. Try reloading, or sign in again.</p>
          <a href="/inner-circle/sales/round-1" className="mt-4 inline-block text-[13px] text-[#C9A9FF] underline">Sign in</a>
        </div>
      </div>
    );
  }

  const { candidate, templateUrl } = data;
  const secondsLeft = Math.max(0, (candidate.secondsLeft ?? 0) - tick);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    const url = submissionUrl.trim();
    if (!url) {
      setSubmitState("error");
      setSubmitError("Paste the link to your Google Sheet.");
      return;
    }
    track("submit_attempted");
    setSubmitState("submitting");
    try {
      const r = await fetch("/api/inner-circle/round1/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ submissionUrl: url }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        track("submit_rejected", { metadata: { status: r.status } });
        setSubmitState("error");
        setSubmitError(d.error || "Couldn't submit. Try again.");
        return;
      }
      track("submit_success");
      setSubmitState("idle");
      await refresh();
    } catch {
      track("submit_rejected", { metadata: { reason: "network" } });
      setSubmitState("error");
      setSubmitError("We couldn't reach the server. Check your connection and try again.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0B0B11] text-white">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-5 pt-10 pb-16 md:px-8">

        {/* Masthead */}
        <div className="flex items-center justify-between pb-8">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#8825F5]" />
            <span className="text-xs tracking-[0.18em] uppercase text-white/60">Inner Circle · Sales · Round 1</span>
          </div>
          <span className="text-xs text-white/40">{candidate.email}</span>
        </div>

        {/* Status-specific body */}
        {candidate.status === "started" && (
          <StartedView
            secondsLeft={secondsLeft}
            name={candidate.name}
            templateUrl={templateUrl}
            submissionUrl={submissionUrl}
            setSubmissionUrl={setSubmissionUrl}
            submit={submit}
            submitState={submitState}
            submitError={submitError}
          />
        )}

        {candidate.status === "submitted" && (
          <SubmittedView
            name={candidate.name}
            submissionUrl={candidate.submission_url}
            submittedAt={candidate.submitted_at}
          />
        )}

        {candidate.status === "expired" && <ExpiredView name={candidate.name} />}

        {candidate.status === "advanced" && <AdvancedView name={candidate.name} />}

        {candidate.status === "rejected" && <RejectedView name={candidate.name} />}

        {candidate.status === "switched_to_tech" && <SwitchedView name={candidate.name} />}

        {candidate.status === "invited" && (
          <div className="rounded-xl border border-white/[0.08] bg-[#13131A] p-6">
            <h2 className="text-[18px] font-semibold">Your invite isn&apos;t claimed yet</h2>
            <p className="mt-2 text-[13px] text-white/60">
              Open the link in your invite email to begin — your 24-hour clock only starts there.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): { h: string; m: string; s: string } {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

function StartedView({
  secondsLeft, name, templateUrl, submissionUrl, setSubmissionUrl, submit, submitState, submitError,
}: {
  secondsLeft: number;
  name: string | null;
  templateUrl: string | null;
  submissionUrl: string;
  setSubmissionUrl: (v: string) => void;
  submit: (e: React.FormEvent) => void;
  submitState: "idle" | "submitting" | "error";
  submitError: string;
}) {
  const { h, m, s } = formatCountdown(secondsLeft);
  // Visual urgency ramps as the deadline approaches, but we don't change the
  // colour of the primary CTA — a candidate shouldn't feel punished for being
  // close to the wire.
  const under3h = secondsLeft > 0 && secondsLeft <= 3 * 3600;

  return (
    <>
      {/* Countdown + task name */}
      <div className="rounded-xl border border-white/[0.08] bg-[#13131A] p-6">
        <div className="text-[11px] uppercase tracking-[0.14em] text-[#C9A9FF]">
          {name ? `${name}, time left` : "Time left"}
        </div>
        <div
          className="mt-2 flex items-baseline gap-2 font-semibold tracking-tight"
          style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}
        >
          <span className={`text-[56px] md:text-[72px] leading-none ${under3h ? "text-rose-200" : "text-white"}`}>{h}</span>
          <span className="text-[20px] md:text-[24px] text-white/50">h</span>
          <span className={`text-[56px] md:text-[72px] leading-none ${under3h ? "text-rose-200" : "text-white"}`}>{m}</span>
          <span className="text-[20px] md:text-[24px] text-white/50">m</span>
          <span className={`text-[56px] md:text-[72px] leading-none text-white/70`}>{s}</span>
          <span className="text-[20px] md:text-[24px] text-white/50">s</span>
        </div>
        <p className="mt-3 text-[13px] text-white/60">
          Submit before the clock hits zero. Your work lives in your own Google Sheet, so close this tab whenever you need to and come back any time.
        </p>
      </div>

      {/* Task brief */}
      <div className="mt-6 rounded-xl border border-white/[0.08] bg-[#13131A] p-6">
        <h2 className="text-[18px] font-semibold tracking-tight">Your brief</h2>
        <p className="mt-3 text-[14px] leading-relaxed text-white/75">
          Build a sheet of <strong className="text-white">30 qualified B2B prospects</strong> for an India-based AI/IT consultancy. We&apos;re looking for companies that actually have a budget for digital transformation work — software, automation, AI integrations, cloud migration — not consumer brands.
        </p>
        <h3 className="mt-5 text-[13px] uppercase tracking-[0.14em] text-[#C9A9FF]">Column order</h3>
        <ol className="mt-2 grid gap-1 text-[13px] text-white/70 md:grid-cols-2">
          <li>1. Company name</li>
          <li>2. Industry / what they do</li>
          <li>3. Decision-maker name</li>
          <li>4. Decision-maker role</li>
          <li>5. LinkedIn URL</li>
          <li>6. Email</li>
          <li>7. Phone (where you can get it)</li>
          <li>8. Source (where you found them)</li>
          <li>9. One-line fit note</li>
          <li>10. City / HQ</li>
        </ol>
        <h3 className="mt-5 text-[13px] uppercase tracking-[0.14em] text-[#C9A9FF]">How we read the sheet</h3>
        <ul className="mt-2 space-y-1 text-[13px] text-white/70">
          <li>— The fit note is the column where we see your thinking. &quot;They raised in July&quot; beats &quot;good company&quot;.</li>
          <li>— A real decision-maker name and role on every row. Not the receptionist.</li>
          <li>— Rough-but-complete beats polished-but-partial. Submit even if you&apos;re not thrilled.</li>
        </ul>
        <div className="mt-5 flex flex-wrap gap-3">
          {templateUrl && (
            <a
              href={templateUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("template_clicked_task")}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-white/10 bg-white/[0.04] px-4 text-[13px] text-white/85 hover:bg-white/[0.08] transition"
            >
              Open the template sheet ↗
            </a>
          )}
          <span className="self-center text-[13px] text-white/60">
            Then <strong className="font-semibold text-white/85">File &rarr; Make a copy</strong>, and work in your copy.
          </span>
        </div>
      </div>

      {/* Submission */}
      <form onSubmit={submit} className="mt-6 rounded-xl border border-[#8825F5]/40 bg-[#17121F] p-6">
        <h2 className="text-[18px] font-semibold tracking-tight">Submit your sheet</h2>
        <p className="mt-2 text-[13px] text-white/60">
          Share the sheet with <strong className="text-white">doitforme.in@gmail.com</strong> (viewer is fine) and paste the URL here.
        </p>
        <label className="mt-4 block">
          <span className="block text-[12px] uppercase tracking-[0.14em] text-white/50 mb-1.5">Google Sheet URL</span>
          <input
            type="url"
            value={submissionUrl}
            onChange={(e) => setSubmissionUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full min-h-[48px] rounded-lg bg-[#0B0B11] border border-white/10 px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none transition-colors focus-visible:border-[#8825F5] focus-visible:ring-2 focus-visible:ring-[#8825F5]/40"
            disabled={submitState === "submitting"}
          />
        </label>
        <button
          type="submit"
          disabled={submitState === "submitting"}
          className="mt-4 h-[48px] rounded-lg bg-[#8825F5] px-6 text-[14px] font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset] hover:bg-[#9633ff] disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {submitState === "submitting" ? "Submitting…" : "Submit Round 1"}
        </button>
        {submitError && <p className="mt-3 text-[13px] text-rose-300">{submitError}</p>}
      </form>

      <p className="mt-8 text-[11px] text-white/30">
        We&apos;ll email you reminders at 12, 6, 3 hours and 30 minutes before your deadline. Any question — reply to the invite email.
      </p>
    </>
  );
}

function SubmittedView({ name, submissionUrl, submittedAt }: { name: string | null; submissionUrl: string | null; submittedAt: number | null }) {
  const when = submittedAt
    ? new Date(submittedAt * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#13131A] p-7">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[#C9A9FF]">Submission received</div>
      <h2 className="mt-2 text-[28px] md:text-[36px] font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}>
        {name ? `${name}, we got it.` : "We got it."}
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed text-white/70">
        Your Round 1 sheet is in. We&apos;ll review every submission by hand and come back to you — yes or no, with a line on what we saw — within <strong className="text-white">7 days</strong>.
      </p>
      <div className="mt-6 rounded-lg border border-white/[0.08] bg-[#0B0B11] p-4 text-[13px] text-white/65">
        <div className="text-[11px] uppercase tracking-[0.14em] text-white/40">Your submission</div>
        {submissionUrl ? (
          <a href={submissionUrl} target="_blank" rel="noreferrer" className="mt-1 block break-all text-white/85 underline underline-offset-2">
            {submissionUrl}
          </a>
        ) : <div className="mt-1 text-white/40">—</div>}
        {when && <div className="mt-2 text-white/40">Submitted {when}</div>}
      </div>
      <p className="mt-6 text-[12px] text-white/40">
        Spotted a mistake? Reply to the invite email with a corrected link before the review window closes.
      </p>
    </div>
  );
}

function ExpiredView({ name }: { name: string | null }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#13131A] p-7">
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">Round 1 window closed</div>
      <h2 className="mt-2 text-[28px] md:text-[36px] font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}>
        {name ? `${name}, the clock ran out.` : "The clock ran out."}
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed text-white/70">
        Your 24 hours ended without a submission. That&apos;s it for this cohort — but this isn&apos;t a closed door. The Inner Circle will keep opening; we&apos;ll stay in touch about the next round.
      </p>
      <p className="mt-4 text-[13px] text-white/50">
        Something got in the way and you&apos;d like a second look? Reply to the invite email and tell us honestly — we read every one.
      </p>
    </div>
  );
}

function AdvancedView({ name }: { name: string | null }) {
  return (
    <div className="rounded-xl border border-[#8825F5]/40 bg-[#17121F] p-7">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[#C9A9FF]">Through to Round 2</div>
      <h2 className="mt-2 text-[28px] md:text-[36px] font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}>
        {name ? `${name}, you're in.` : "You're in."}
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed text-white/80">
        Your Round 1 sheet made it through. Round 2 is a real-world task — we&apos;ll send the brief and the 24-hour window in a separate email within the next couple of days. Keep an eye on your inbox.
      </p>
    </div>
  );
}

function RejectedView({ name }: { name: string | null }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#13131A] p-7">
      <div className="text-[11px] uppercase tracking-[0.14em] text-white/50">Decision</div>
      <h2 className="mt-2 text-[26px] md:text-[32px] font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}>
        {name ? `${name}, not this cohort.` : "Not this cohort."}
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed text-white/70">
        Thanks for sending Round 1 in. We&apos;re not taking you forward to Round 2 this time. Your invite email has the written note from the reviewer.
      </p>
      <p className="mt-4 text-[13px] text-white/50">
        Future rounds will open as we scale. We&apos;ll stay in touch.
      </p>
    </div>
  );
}

function SwitchedView({ name }: { name: string | null }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#13131A] p-7">
      <div className="text-[11px] uppercase tracking-[0.14em] text-[#C9A9FF]">You moved to the Tech cohort</div>
      <h2 className="mt-2 text-[26px] md:text-[32px] font-semibold tracking-tight" style={{ fontFamily: "'Space Grotesk', ui-sans-serif, system-ui" }}>
        {name ? `${name}, we've got you on the Tech list.` : "We've got you on the Tech list."}
      </h2>
      <p className="mt-4 text-[14px] leading-relaxed text-white/70">
        You&apos;re off the Sales track and queued for the Tech cohort. When Tech Round 1 opens, we&apos;ll invite you the same way.
      </p>
    </div>
  );
}
