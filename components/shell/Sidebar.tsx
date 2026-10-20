"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronsLeft, ChevronsRight, Plus } from "lucide-react";
import { PRIMARY_NAV, isActive, secondaryNavFor, type NavItem } from "./nav";
import AccountMenu from "./AccountMenu";

/**
 * The one dark surface in the workspace.
 *
 * Grape rail against a cream page is the design's single strongest move, so it
 * carries the whole brand and everything else stays quiet. Active state is the
 * orange pill — used here and nowhere else, so "where am I" is never ambiguous.
 *
 * TWO WIDTHS. The full rail (256px, icons + words) is the default, because a
 * person who has never seen the product should not have to guess what an icon
 * means. The compact rail (84px, icons only) exists for one reason: pages that
 * are already two panels. Messages is a conversation list next to a chat, and
 * a 256px rail beside those is three columns of chrome competing for a phone-
 * sized amount of content. On those routes the rail shrinks on its own; on any
 * other page it stays however the person last left it.
 */

const STORAGE_KEY = "dfm_rail_collapsed";

/** Routes that are already a list + detail layout, so the rail steps aside. */
const IMMERSIVE = ["/messages", "/chat"];

function NavLink({
  item,
  active,
  compact,
}: {
  item: NavItem;
  active: boolean;
  compact: boolean;
}) {
  const Icon = item.icon;
  const reduce = useReducedMotion();
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={compact ? item.label : undefined}
      className={[
        "group relative flex h-[48px] items-center rounded-[12px] text-[14px] font-bold transition-colors",
        compact ? "justify-center px-0" : "gap-3.5 px-4",
        active ? "text-[#371448]" : "text-[var(--w-rail-ink)] hover:bg-[var(--w-rail-hover)] hover:text-white",
      ].join(" ")}
    >
      {/* One pill that slides between rows instead of blinking on and off. */}
      {active && (
        <motion.span
          layoutId="rail-active"
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38 }}
          className="absolute inset-0 rounded-[12px] bg-[var(--w-orange)] shadow-[0_6px_16px_rgba(28,9,37,0.28)]"
        />
      )}
      <Icon size={20} strokeWidth={2.1} className="relative shrink-0" />
      {!compact && <span className="relative flex-1 truncate">{item.label}</span>}
      {!compact && item.badge && (
        <span
          className={[
            "relative rounded px-1.5 py-[3px] text-[9px] font-extrabold tracking-wide",
            active ? "bg-[#341044] text-white" : "bg-[#663474] text-[#ffcc72]",
          ].join(" ")}
        >
          {item.badge}
        </span>
      )}
      {!compact && !!item.count && (
        <span className="relative rounded-md bg-[var(--w-orange)] px-1.5 py-0.5 text-[10px] font-bold text-[#341044]">
          {item.count}
        </span>
      )}

      {/* Label on hover for the compact rail — an icon alone is a guess. */}
      {compact && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#1d0a27] px-3 py-1.5 text-[12.5px] font-bold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.label}
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

  const [pinnedCompact, setPinnedCompact] = useState(false);
  useEffect(() => {
    try {
      // Read after mount: localStorage does not exist on the server, so a lazy
      // initial state would render differently there and trip hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPinnedCompact(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* private mode — default to the full rail */
    }
  }, []);

  const immersive = IMMERSIVE.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const compact = immersive || pinnedCompact;

  const toggle = () => {
    setPinnedCompact((v) => {
      try {
        localStorage.setItem(STORAGE_KEY, v ? "0" : "1");
      } catch {
        /* non-fatal */
      }
      return !v;
    });
  };

  return (
    <aside
      data-compact={compact || undefined}
      className={[
        "sticky top-0 z-30 hidden h-[100dvh] shrink-0 flex-col border-r border-[var(--w-rail-line)] bg-[var(--w-rail)] lg:flex",
        "transition-[width] duration-[260ms] ease-[var(--ease-out)]",
        compact ? "w-[84px]" : "w-[256px]",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-[84px] items-center border-b border-[#623373]",
          compact ? "justify-center px-0" : "px-6",
        ].join(" ")}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5 whitespace-nowrap" aria-label="doitforme home">
          <Image src="/sloth.png" alt="" width={40} height={40} className="rounded-[11px]" />
          {!compact && (
            <span
              className="text-[21px] font-extrabold tracking-[-0.055em] text-white"
              style={{ fontFamily: "var(--font-display), sans-serif" }}
            >
              do<span className="text-[var(--w-orange)]">it</span>forme
            </span>
          )}
        </Link>
      </div>

      <nav
        // Compact lets the hover labels escape the rail; an overflow-auto parent
        // would clip them. The icon-only list is short enough not to need scroll.
        className={`flex-1 px-3.5 pb-4 pt-5 ${compact ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"}`}
        aria-label="Workspace"
      >
        {/* The one thing most people come here to do, always one tap away. */}
        <Link
          href="/post"
          aria-label={compact ? "Post a task" : undefined}
          className={[
            "mb-5 flex h-[50px] items-center justify-center gap-2 rounded-[13px] bg-white/[0.08] text-[14px] font-extrabold text-white",
            "ring-1 ring-inset ring-white/15 transition hover:bg-white/[0.14] active:scale-[0.98]",
          ].join(" ")}
        >
          <Plus size={19} strokeWidth={2.6} className="text-[var(--w-orange)]" />
          {!compact && "Post a task"}
        </Link>

        {!compact && (
          <p className="mb-2.5 ml-4 text-[10px] font-extrabold tracking-[0.135em] text-[var(--w-rail-faint)]">
            YOUR WORKSPACE
          </p>
        )}
        <div className="grid gap-1">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} compact={compact} />
          ))}
        </div>

        <div className="my-5 h-px bg-[#5a2e6a]" />

        <div className="grid gap-1">
          {secondary.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} compact={compact} />
          ))}
        </div>
      </nav>

      {/* The account menu, which is also the only way to sign out. */}
      <div className="border-t border-[#623373] p-3.5">
        <AccountMenu name={name} role={role} variant="rail" compact={compact} />
        {!immersive && (
          <button
            type="button"
            onClick={toggle}
            aria-label={compact ? "Expand menu" : "Collapse menu"}
            className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-[10px] text-[12px] font-bold text-[var(--w-rail-faint)] transition-colors hover:bg-[var(--w-rail-hover)] hover:text-white"
          >
            {compact ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            {!compact && "Collapse"}
          </button>
        )}
      </div>
    </aside>
  );
}
