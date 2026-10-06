"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, isActive, secondaryNavFor, type NavItem } from "./nav";
import AccountMenu from "./AccountMenu";

/**
 * The one dark surface in the workspace.
 *
 * Grape rail against a cream page is the design's single strongest move, so it
 * carries the whole brand and everything else stays quiet. Active state is the
 * orange fill from the Figma — used here and nowhere else, so "where am I" is
 * never ambiguous.
 */

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={[
        "group flex h-[43px] items-center gap-3.5 rounded-[11px] px-3.5",
        "text-[13px] font-bold transition-colors",
        active
          ? "bg-[var(--w-orange)] text-[#371448] shadow-[0_5px_14px_rgba(28,9,37,0.22)]"
          : "text-[var(--w-rail-ink)] hover:bg-[var(--w-rail-hover)] hover:text-white",
      ].join(" ")}
    >
      <Icon size={19} strokeWidth={2} className="shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span
          className={[
            "rounded px-1.5 py-[3px] text-[9px] font-extrabold tracking-wide",
            active ? "bg-[#341044] text-white" : "bg-[#663474] text-[#ffcc72]",
          ].join(" ")}
        >
          {item.badge}
        </span>
      )}
      {!!item.count && (
        <span
          className={[
            "rounded-md px-1.5 py-0.5 text-[10px] font-bold",
            active ? "bg-[#341044] text-white" : "bg-[var(--w-orange)] text-[#341044]",
          ].join(" ")}
        >
          {item.count}
        </span>
      )}
    </Link>
  );
}

export default function Sidebar({
  name,
  role,
  isElite,
  innerCircleRole,
}: {
  name?: string | null;
  role?: string | null;
  isElite?: boolean | null;
  innerCircleRole?: string | null;
}) {
  const pathname = usePathname();
  const secondary = secondaryNavFor({ isElite, innerCircleRole });

  return (
    <aside className="sticky top-0 z-20 hidden h-[100dvh] w-[244px] shrink-0 flex-col border-r border-[var(--w-rail-line)] bg-[var(--w-rail)] lg:flex">
      <div className="flex h-[89px] items-center border-b border-[#623373] px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 whitespace-nowrap">
          <Image src="/sloth.png" alt="" width={39} height={39} className="rounded-[10px]" />
          <span
            className="text-[21px] font-extrabold tracking-[-0.055em] text-white"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            do<span className="text-[var(--w-orange)]">it</span>forme
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3.5 pb-6 pt-6" aria-label="Workspace">
        <p className="mb-3 ml-3.5 text-[10px] font-extrabold tracking-[0.135em] text-[var(--w-rail-faint)]">
          YOUR WORKSPACE
        </p>
        <div className="grid gap-1">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>

        <div className="my-5 h-px bg-[#5a2e6a]" />

        <div className="grid gap-1">
          {secondary.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>
      </nav>

      {/* The account menu, which is also the only way to sign out. This used to
          be a static name card; log out lived exclusively in the dashboard's own
          top bar, so removing that bar would have stranded it. */}
      <div className="border-t border-[#623373] p-3.5">
        <AccountMenu name={name} role={role} variant="rail" />
      </div>

    </aside>
  );
}
