"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Hammer, Target, Wallet, Folder, Users, User } from "lucide-react";
import { TABS, activeTab, type AppRole, type Tab } from "@/lib/appShell";

const ICONS = {
  home: Home,
  hammer: Hammer,
  target: Target,
  wallet: Wallet,
  folder: Folder,
  users: Users,
  user: User,
} as const;

/**
 * The bottom tab bar. This single component is most of what separates "an app"
 * from "a website in a WebView".
 *
 * A website navigates from the top: a logo, a breadcrumb, a menu under a
 * hamburger. Every phone app of the last decade navigates from the bottom,
 * because that is where the thumb is, and the muscle memory is so established
 * that top-only navigation reads as a web page no matter how it is styled. The
 * existing MobileNav already has a bottom bar, but it is the WEBSITE's — it
 * sits under a 62px topbar with a breadcrumb and opens a drawer of twelve
 * links. This replaces both.
 *
 * THREE THINGS THAT ARE EASY TO GET WRONG AND ARE DELIBERATE HERE:
 *
 * 1. THE BAR SITS ABOVE THE SAFE AREA, not inside it. `padding-bottom` is the
 *    inset, so on a notched phone the row of labels stays above the home
 *    indicator instead of being bisected by it. The paired
 *    `--a-tabbar`-derived padding on the content column is what stops the last
 *    list item hiding behind the bar — the two must be declared together or
 *    one of them silently clips.
 *
 * 2. THE ACTIVE TAB IS MARKED BY A FILLED ICON AND A COLOUR, not by a moving
 *    pill. An animated indicator has to be told where to go on a route change
 *    and gets it wrong on back navigation; the derived `activeTab()` cannot.
 *
 * 3. `prefetch` IS LEFT ON. These are the only four destinations in the app and
 *    they are opened constantly over a phone connection — this is exactly the
 *    case prefetching exists for.
 */
export default function BottomTabs({ role }: { role: AppRole }) {
  const pathname = usePathname() || "/app";
  const tabs: Tab[] = TABS[role];
  const active = activeTab(tabs, pathname);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--a-line)] bg-[var(--a-bg)]/95 backdrop-blur-xl"
      style={{ paddingBottom: "var(--a-safe-bottom)" }}
    >
      <ul className="mx-auto flex w-full max-w-[520px]" style={{ height: "var(--a-tabbar)" }}>
        {tabs.map((t) => {
          const Icon = ICONS[t.icon];
          const on = active === t.href;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className="icapp-press flex h-full w-full flex-col items-center justify-center gap-1"
              >
                <Icon
                  size={21}
                  aria-hidden="true"
                  strokeWidth={on ? 2.4 : 1.8}
                  className={on ? "text-[var(--a-accent-ink)]" : "text-[var(--a-fg-faint)]"}
                />
                <span
                  className={`text-[10.5px] font-semibold tracking-wide ${
                    on ? "text-[var(--a-accent-ink)]" : "text-[var(--a-fg-faint)]"
                  }`}
                >
                  {t.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
