import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import Link from "next/link";

type EmptyStateProps = {
  icon?: LucideIcon;
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
      className={`bg-[#13131A] border border-white/[0.08] rounded-2xl px-6 py-12 md:py-16 flex flex-col items-center text-center ${className}`}
    >
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
          <Icon size={22} className="text-white/40" strokeWidth={1.6} />
        </div>
      )}
      <h3 className="text-base font-semibold text-white tracking-tight mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-white/50 max-w-sm leading-relaxed">{description}</p>
      )}
      {(actionLabel && (actionHref || onAction)) && (
        <div className="mt-5">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[#8825F5] text-white text-sm font-medium tracking-tight hover:bg-[#7a1fe0] transition-colors"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[#8825F5] text-white text-sm font-medium tracking-tight hover:bg-[#7a1fe0] transition-colors"
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
