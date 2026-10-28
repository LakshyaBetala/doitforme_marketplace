import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type EmptyStateProps = {
  icon?: LucideIcon;
  /** Optional sloth image path (e.g. "/sleeping_sloth.png") — brings the brand's
   *  playful personality to empty/zero states. Takes precedence over `icon`. */
  sloth?: string;
  title: string;
  description?: string;
  /** Primary action — either a Link href or an onClick. */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  /** Optional secondary content (e.g. a tip, chip row). */
  children?: ReactNode;
  className?: string;
};

export default function EmptyState({
  icon: Icon,
  sloth,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  children,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`bg-[var(--surface)] border border-[var(--line)] rounded-2xl px-6 py-12 md:py-16 flex flex-col items-center text-center ${className}`}
    >
      {sloth ? (
        <div className="relative w-24 h-24 mb-4 opacity-90 animate-[float_8s_ease-in-out_infinite]">
          <Image src={sloth} alt="" fill className="object-contain" sizes="96px" />
        </div>
      ) : Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[var(--chip)] border border-[var(--line)] flex items-center justify-center mb-4">
          <Icon size={22} className="text-[var(--fg-faint)]" strokeWidth={1.6} />
        </div>
      )}
      <h3 className="text-base font-semibold text-[var(--fg)] tracking-tight mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[var(--fg-muted)] max-w-sm leading-relaxed">{description}</p>
      )}
      {(actionLabel && (actionHref || onAction)) && (
        <div className="mt-5">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-sm font-medium tracking-tight hover:brightness-110 transition-colors"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[var(--accent)] text-[var(--on-accent)] text-sm font-medium tracking-tight hover:brightness-110 transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
