import { ReactNode } from "react";

/**
 * Single source of truth for all status pills across the app.
 *
 * Design rule: depth comes from the BORDER color, not a saturated background fill.
 * This keeps the dark-minimal aesthetic intact while still signalling intent.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  // muted gray — default; pending, draft, applied
  neutral: "bg-white/[0.04] text-white/70 border-white/[0.08]",
  // brand purple — in-progress, assigned, delivered, hired
  info: "bg-[#8825F5]/10 text-[#C9A9FF] border-[#8825F5]/25",
  // green — completed, released, accepted, paid
  success: "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/20",
  // amber — needs-action, held, awaiting-release
  warning: "bg-amber-500/[0.08] text-amber-300 border-amber-500/20",
  // red — cancelled, rejected, disputed, refunded
  danger: "bg-red-500/[0.08] text-red-300 border-red-500/20",
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
