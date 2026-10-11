"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { friendlyError } from "@/lib/errors";
import type { Clause } from "@/lib/programTerms";

/**
 * The terms page. Read once, accepted once, before any paid work.
 *
 * TWO THINGS ABOUT THE LAYOUT ARE DELIBERATE.
 *
 * It opens with what the member GETS, not with nine obligations. A terms page
 * that leads with duties reads as a trap and gets scrolled past, and a clause
 * nobody read is a weak clause — particularly the IP assignment, which is the
 * one that has to hold up if a client ever asks who owns the software.
 *
 * The strict clauses are visually separated from the rest. A list where every
 * item looks equally important is a list where nothing is, and only some of
 * these end the arrangement when broken. Someone skimming should still come
 * away knowing which eight those are.
 */

type Payload = {
  version: string;
  role: "TECH" | "OUTREACH";
  promises: string[];
  clauses: Clause[];
  accepted: { version: string; accepted_at: string } | null;
  current: boolean;
};

const ROLE_LABEL: Record<string, string> = {
  TECH: "Build",
  OUTREACH: "Outreach",
};

export default function ProgramTermsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const role = (params.get("role") || "TECH").toUpperCase();

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [agree, setAgree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/program/terms?role=${encodeURIComponent(role)}`);
      if (res.status === 401) return router.replace("/login?next=/program/terms");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load the terms");
      setData(json);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [role, router]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/program/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, agree: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not record that");
      await load();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--w-faint)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-[14.5px] text-[var(--w-muted)]">{error || "Could not load the terms."}</p>
      </div>
    );
  }

  const strict = data.clauses.filter((c) => c.strict);
  const rest = data.clauses.filter((c) => !c.strict);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 pb-24 sm:px-6">
      <header className="mb-8">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.08em] text-[var(--w-faint)]">
          {ROLE_LABEL[data.role] ?? data.role} · version {data.version}
        </p>
        <h1 className="mt-2 text-[27px] font-bold leading-[1.15] tracking-[-0.02em] text-[var(--w-ink-strong)] sm:text-[33px]">
          How we work together
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--w-muted)]">
          Read this once. It is short on purpose, and it is the whole agreement. Nothing is
          hidden in a longer document somewhere else.
        </p>
      </header>

      {data.current && (
        <div className="mb-8 flex items-start gap-3 rounded-[var(--w-r-md)] border border-[var(--w-line-strong)] bg-[var(--w-surface)] p-4">
          <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--w-violet)]" />
          <div>
            <p className="text-[14.5px] font-bold text-[var(--w-ink-strong)]">You have accepted these.</p>
            <p className="mt-0.5 text-[13.5px] text-[var(--w-muted)]">
              Recorded{" "}
              {data.accepted
                ? new Date(data.accepted.accepted_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "earlier"}
              . If we change anything material we will ask you again.
            </p>
          </div>
        </div>
      )}

      {/* What you get, first. */}
      <section className="mb-10 rounded-[var(--w-r-lg)] border border-[var(--w-line-strong)] bg-[var(--w-surface)] p-5 sm:p-6">
        <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--w-ink-strong)]">
          What you get
        </h2>
        <ul className="mt-4 space-y-3">
          {data.promises.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-[17px] w-[17px] shrink-0 text-[var(--w-violet)]" />
              <span className="text-[14.5px] leading-relaxed text-[var(--w-ink)]">{p}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert className="h-[17px] w-[17px] text-[var(--w-orange)]" />
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-[var(--w-ink-strong)]">
            Break these and we stop working together
          </h2>
        </div>
        <p className="mb-5 text-[13.5px] leading-relaxed text-[var(--w-muted)]">
          There are {strict.length}. We would rather name them plainly now than surprise you
          with one later.
        </p>
        <ol className="space-y-4">
          {strict.map((c, i) => (
            <li
              key={c.key}
              className="rounded-[var(--w-r-md)] border border-[var(--w-line-strong)] bg-[var(--w-surface)] p-4 sm:p-5"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-[12.5px] font-bold tabular-nums text-[var(--w-faint)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[15px] font-bold leading-snug text-[var(--w-ink-strong)]">
                  {c.title}
                </h3>
              </div>
              <p className="mt-2 pl-[27px] text-[14.5px] leading-relaxed text-[var(--w-ink)]">
                {c.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="mb-5 text-[16px] font-bold tracking-[-0.01em] text-[var(--w-ink-strong)]">
          How the rest of it works
        </h2>
        <div className="divide-y divide-[var(--w-line)]">
          {rest.map((c) => (
            <div key={c.key} className="py-4 first:pt-0 last:pb-0">
              <h3 className="text-[15px] font-bold leading-snug text-[var(--w-ink-strong)]">
                {c.title}
              </h3>
              <p className="mt-1.5 text-[14.5px] leading-relaxed text-[var(--w-ink)]">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      {!data.current && (
        <section className="rounded-[var(--w-r-lg)] border border-[var(--w-line-strong)] bg-[var(--w-surface)] p-5 sm:p-6">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--w-violet)]"
            />
            <span className="text-[14.5px] leading-relaxed text-[var(--w-ink)]">
              I have read all of it and I agree. I understand that work I am paid for transfers
              to the client, and that I do not contact clients directly.
            </span>
          </label>

          {error && (
            <p className="mt-4 text-[13.5px] font-semibold text-[var(--w-orange)]">{error}</p>
          )}

          <button
            onClick={accept}
            disabled={!agree || saving}
            className="mt-5 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[var(--w-r-md)] bg-[var(--w-violet)] px-5 text-[14.5px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Accept and continue
          </button>

          <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--w-faint)]">
            We record the date and your device when you accept, so both of us can show what was
            agreed. You can read this page again any time.
          </p>
        </section>
      )}
    </div>
  );
}
