"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { MOBILE_NAV, PRIMARY_NAV, isActive, secondaryNavFor } from "./nav";
import AccountMenu from "./AccountMenu";
import NotificationBell from "@/components/NotificationBell";

/**
 * Phone navigation: a bottom bar for the four things people do, plus a sheet
 * for the rest.
 *
 * The sidebar is 244px of grape and cannot simply shrink. Four bottom items is
 * the most that stays comfortably tappable at 360px, which is the common width
 * on the Android phones this is actually used on — so Inner Circle, profile and
 * support move into the sheet rather than being crushed into a fifth slot.
 */
export default function MobileNav({
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
  const [open, setOpen] = useState(false);

  // Lock the page behind the sheet. Without this the body scrolls under an open
  // sheet on iOS — you drag the menu, the page moves instead, and closing it
  // leaves you somewhere you did not navigate to.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close the sheet on navigation. It is rendered outside the page, so a route
  // change does not unmount it and it would otherwise stay open over the new page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* top bar */}
      <div className="sticky top-0 z-30 flex h-[62px] items-center justify-between border-b border-[var(--w-line)] bg-[var(--w-surface)] px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/sloth.png" alt="" width={32} height={32} className="rounded-lg" />
          <span
            className="text-[18px] font-extrabold tracking-[-0.055em] text-[var(--w-ink-strong)]"
            style={{ fontFamily: "var(--font-display), sans-serif" }}
          >
            do<span className="text-[var(--w-orange)]">it</span>forme
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-[11px] text-[var(--w-ink)]"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      {/* sheet — always mounted so it can animate out, inert while closed */}
      <div
        className={[
          "fixed inset-0 z-50 lg:hidden",
          "transition-[visibility] duration-[var(--dur-sheet)]",
          open ? "visible" : "invisible delay-[var(--dur-sheet)]",
        ].join(" ")}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
          className={[
            "absolute inset-0 bg-[#2d1937]/45",
            "transition-opacity duration-[var(--dur-sheet)] ease-[var(--ease-out)]",
            open ? "opacity-100" : "pointer-events-none opacity-0",
          ].join(" ")}
        />
        <nav
          aria-label="Menu"
          aria-hidden={!open}
          className={[
            "absolute right-0 top-0 flex h-full w-[82%] max-w-[320px] flex-col bg-[var(--w-rail)] pt-[env(safe-area-inset-top)]",
            "transition-transform duration-[var(--dur-sheet)] ease-[var(--ease-drawer)] will-change-transform",
            open ? "translate-x-0" : "translate-x-full",
          ].join(" ")}
        >
            <div className="flex h-[62px] items-center justify-between border-b border-[#623373] px-4">
              <span className="text-[13px] font-bold text-[var(--w-rail-faint)]">
                {name || "Your account"}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-[11px] text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="grid flex-1 content-start gap-1 overflow-y-auto overscroll-contain p-3.5">
              {[...PRIMARY_NAV, ...secondary].map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={[
                      "flex min-h-[48px] items-center gap-3.5 rounded-[11px] px-3.5 text-[14px] font-bold",
                      active
                        ? "bg-[var(--w-orange)] text-[#371448]"
                        : "text-[var(--w-rail-ink)] active:bg-[var(--w-rail-hover)]",
                    ].join(" ")}
                  >
                    <Icon size={19} className="shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="rounded bg-[#663474] px-1.5 py-[3px] text-[9px] font-extrabold text-[#ffcc72]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

          <div className="border-t border-[#623373] p-3.5 pb-[calc(14px+env(safe-area-inset-bottom))]">
            <AccountMenu name={name} role={role} variant="rail" />
          </div>
        </nav>
      </div>

      {/* bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-[var(--w-line)] bg-[var(--w-surface)] pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[10px] font-bold",
                active ? "text-[var(--w-violet)]" : "text-[var(--w-muted)]",
              ].join(" ")}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
