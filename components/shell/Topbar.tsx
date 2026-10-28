"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { ALL_NAV_ITEMS } from "./nav";

const TITLES: Record<string, string> = Object.fromEntries(
  ALL_NAV_ITEMS.map((n) => [n.href, n.label])
);

/**
 * Routes that are real destinations but deliberately not in the nav — you reach
 * them from a card, a button or an account menu. Without them the breadcrumb
 * fell back to "Workspace", directly under a crumb already reading "Workspace".
 */
const EXTRA_TITLES: Record<string, string> = {
  "/post": "Post a task",
  "/payouts": "Payouts",
  "/verify-id": "Verify your ID",
  "/settings/notifications": "Notifications",
  "/profile/worker-setup": "Payment details",
};

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname];
  if (EXTRA_TITLES[pathname]) return EXTRA_TITLES[pathname];
  // Longest prefix wins, so /inner-circle/outreach keeps its own label while
  // /gig/<id> inherits a sensible parent instead of repeating "Workspace".
  const prefix = [...Object.keys(TITLES), ...Object.keys(EXTRA_TITLES)]
    .filter((href) => href !== "/dashboard" && pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix) return TITLES[prefix] ?? EXTRA_TITLES[prefix];
  if (pathname.startsWith("/gig/")) return "Task";
  if (pathname.startsWith("/u/")) return "Profile";
  // Last resort: title-case the first segment. Still better than a second
  // "Workspace", because it at least names where you are.
  const seg = pathname.split("/").filter(Boolean)[0];
  return seg ? seg.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Overview";
}

/**
 * Desktop top bar: where you are, and the one action that matters here.
 *
 * Deliberately NOT a second navigation. The sidebar already answers "where can
 * I go"; repeating those links here is how products end up with three ways to
 * reach the same page and users trusting none of them.
 */
export default function Topbar({ action }: { action?: React.ReactNode }) {
  const pathname = usePathname();
  const title = titleFor(pathname);

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
