"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { ALL_NAV_ITEMS } from "./nav";

const TITLES = Object.fromEntries(ALL_NAV_ITEMS.map((n) => [n.href, n.label]));

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

      <div className="flex items-center gap-2">
        {action}
        {/* Not navigation: a count that changes and an inbox. The sidebar still
            owns "where can I go" — these are status, which is why they sit here
            and are not repeated as nav items. */}
        <NotificationBell />
        <Link
          href="/messages"
          aria-label="Messages"
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[var(--w-muted)] transition-colors hover:bg-[var(--chip)] hover:text-[var(--w-ink)]"
        >
          <MessageCircle size={19} />
        </Link>
      </div>
    </header>
  );
}
