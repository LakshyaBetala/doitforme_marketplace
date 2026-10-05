"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav";

const TITLES = Object.fromEntries(
  [...PRIMARY_NAV, ...SECONDARY_NAV].map((n) => [n.href, n.label])
);

/**
 * Desktop top bar: where you are, and the one action that matters here.
 *
 * Deliberately NOT a second navigation. The sidebar already answers "where can
 * I go"; repeating those links here is how products end up with three ways to
 * reach the same page and users trusting none of them.
 */
export default function Topbar({ action }: { action?: React.ReactNode }) {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Workspace";

  return (
    <header className="sticky top-0 z-20 hidden h-[72px] items-center justify-between border-b border-[var(--w-line)] bg-[var(--w-surface)] px-8 lg:flex">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]">
        <Link href="/dashboard" className="font-semibold text-[var(--w-faint)] hover:text-[var(--w-violet)]">
          Workspace
        </Link>
        <span className="text-[var(--w-faint)]" aria-hidden>
          /
        </span>
        <span className="font-bold text-[var(--w-ink-strong)]">{title}</span>
      </nav>

      <div className="flex items-center gap-3">{action}</div>
    </header>
  );
}
