import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The app's primitives. Separate from components/ui/ on purpose: those carry
 * the website's token contract (`--surface`, `--fg`) which resolves to cream
 * inside `.workspace`, and these carry the app's (`--a-*`). Importing a Card
 * from the website into the app is how the two palettes end up in one screen.
 *
 * Deliberately small. Four things cover every screen here, and a component
 * nobody has needed yet is a component nobody has had to maintain.
 */

/** A section heading. Sentence case, because the app talks rather than labels. */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--a-fg-faint)]">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
  href,
}: {
  children: ReactNode;
  className?: string;
  href?: string;
}) {
  const cls = `block rounded-[var(--a-r-card)] border border-[var(--a-line)] bg-[var(--a-surface)] p-4 ${className}`;
  // A card that navigates is a link, not a div with an onClick — it gets the
  // keyboard, the focus ring from globals.css, and a long-press menu for free.
  return href ? (
    <Link href={href} className={`icapp-press ${cls}`}>
      {children}
    </Link>
  ) : (
    <div className={cls}>{children}</div>
  );
}

/**
 * The number someone opened the app to see.
 *
 * `tone="money"` is the ONLY place --a-gold is used. See the note in
 * app-theme.css: an amount should never be confusable with a status chip, and
 * money is the figure that proves this platform actually pays.
 */
export function Stat({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "money" | "warn";
}) {
  const colour =
    tone === "money"
      ? "text-[var(--a-gold)]"
      : tone === "warn"
        ? "text-[var(--a-warn)]"
        : "text-[var(--a-fg)]";
  return (
    <div className="rounded-[var(--a-r-card)] border border-[var(--a-line)] bg-[var(--a-surface)] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--a-fg-faint)]">
        {label}
      </p>
      <p
        className={`icapp-num mt-1.5 text-[27px] font-semibold leading-none ${colour}`}
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[12px] text-[var(--a-fg-muted)]">{sub}</p> : null}
    </div>
  );
}

const TONES = {
  ok: "border-[rgba(78,192,138,0.28)] bg-[var(--a-ok-soft)] text-[var(--a-ok)]",
  warn: "border-[rgba(224,162,60,0.28)] bg-[var(--a-warn-soft)] text-[var(--a-warn)]",
  bad: "border-[rgba(226,104,95,0.28)] bg-[var(--a-bad-soft)] text-[var(--a-bad)]",
  neutral: "border-[var(--a-line-strong)] bg-[var(--a-surface-2)] text-[var(--a-fg-muted)]",
} as const;

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * The empty state.
 *
 * Every screen here can legitimately be empty — a builder between projects, a
 * partner who has cleared their follow-ups — and "nothing" has to read as
 * success rather than as a failed load. So it says what the screen WILL show,
 * never "no data".
 */
export function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-[var(--a-r-card)] border border-dashed border-[var(--a-line-strong)] px-5 py-10 text-center">
      <p className="text-[15px] font-semibold text-[var(--a-fg)]">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-[var(--a-fg-muted)]">
        {hint}
      </p>
    </div>
  );
}

/** Rupees, as a person writes them. No decimals: every amount here is whole. */
export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
