"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { MOBILE_NAV, PRIMARY_NAV, SECONDARY_NAV, isActive } from "./nav";

/**
 * Phone navigation: a bottom bar for the four things people do, plus a sheet
 * for the rest.
 *
 * The sidebar is 244px of grape and cannot simply shrink. Four bottom items is
 * the most that stays comfortably tappable at 360px, which is the common width
 * on the Android phones this is actually used on — so Inner Circle, profile and
 * support move into the sheet rather than being crushed into a fifth slot.
 */
export default function MobileNav({ name }: { name?: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-[11px] text-[var(--w-ink)]"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* sheet */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#2d1937]/45"
          />
          <nav
            aria-label="Menu"
            className="absolute right-0 top-0 flex h-full w-[82%] max-w-[320px] flex-col bg-[var(--w-rail)] pt-[env(safe-area-inset-top)]"
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
            <div className="grid gap-1 overflow-y-auto p-3.5">
              {[...PRIMARY_NAV, ...SECONDARY_NAV].map((item) => {
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
          </nav>
        </div>
      )}

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
