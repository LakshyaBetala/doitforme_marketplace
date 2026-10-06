import { ReactNode } from "react";

/**
 * Single source of truth for all status pills across the app.
 *
 * Design rule: depth comes from the BORDER color, not a saturated background
 * fill. Written against the shared token contract so the same pill reads
 * correctly on the dark marketing pages and on the cream workspace — the tones
 * used to be hardcoded tailwind dark-mode colors (text-emerald-300 on cream is
 * a pale green on near-white, which is how status disappears).
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  // default — pending, draft, applied
  neutral: "bg-[var(--chip)] text-[var(--fg-muted)] border-[var(--line)]",
  // brand — in-progress, assigned, delivered, hired
  info: "bg-[var(--accent-soft)] text-[var(--accent-ink)] border-[var(--accent-line)]",
  // completed, released, accepted, paid
  success: "bg-[var(--ok-soft)] text-[var(--ok)] border-[var(--ok-line)]",
  // needs-action, held, awaiting-release
  warning: "bg-[var(--warn-soft)] text-[var(--warn)] border-[var(--warn-line)]",
  // cancelled, rejected, disputed, refunded
  danger: "bg-[var(--bad-soft)] text-[var(--bad)] border-[var(--bad-line)]",
};

type StatusBadgeProps = {
  tone?: Tone;
  className?: string;
  children: ReactNode;
};

export default function StatusBadge({ tone = "neutral", className = "", children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium tracking-tight ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/**
 * Map a raw DB status string to a semantic tone.
 * Lowercase the input — DB statuses are inconsistent (gigs.status is lowercase,
 * escrow.status is uppercase, applications mix both).
 */
export function statusToTone(status: string | null | undefined): Tone {
  if (!status) return "neutral";
  const s = status.toLowerCase();

  // success states
  if (["completed", "released", "accepted", "paid", "resolved", "first_gig_done"].includes(s)) return "success";
  // active / in-flight
  if (["assigned", "delivered", "hired", "active", "in_progress", "held", "payout_pending"].includes(s)) return "info";
  // needs attention
  if (["pending", "submitted", "awaiting_release", "applied"].includes(s)) return "warning";
  // failure / terminated
  if (["cancelled", "rejected", "refunded", "failed", "disputed", "open", "opted_out", "expired"].includes(s)) return "danger";
  // neutral default — draft, signed_up, anything unrecognized
  return "neutral";
}

/**
 * Humanize a DB status string for display: "PAYOUT_PENDING" → "Payout pending".
 */
export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return "—";
  const cleaned = status.replace(/_/g, " ").toLowerCase();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
