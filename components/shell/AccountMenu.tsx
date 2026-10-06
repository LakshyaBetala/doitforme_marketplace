"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { ChevronUp, LogOut, UserCog, Wallet2 } from "lucide-react";
import InstallAppButton from "@/components/InstallAppButton";
import EnableNotificationsButton from "@/components/EnableNotificationsButton";

/**
 * The account block in the sidebar footer, and the only way out of the app.
 *
 * This exists because of what removing the dashboard's top bar would otherwise
 * have cost. Log out, Install app and Enable notifications lived ONLY inside the
 * profile dropdown in that bar — app/dashboard/page.tsx — so deleting it to stop
 * the duplicate navigation would have left a signed-in user with no way to sign
 * out from anywhere in the product. These move here, where they are reachable
 * from every page instead of one.
 *
 * "Payouts" sits in this menu rather than the nav on purpose. There is no Wallet
 * in this product — payouts are manual, so a balance you could withdraw on
 * demand would be a promise we cannot keep — but a student still has to be able
 * to see what they are owed. Account-level, not a destination.
 */
export default function AccountMenu({
  name,
  role,
  variant = "rail",
}: {
  name?: string | null;
  role?: string | null;
  variant?: "rail" | "sheet";
}) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape. Both, because a popover that traps you
  // until you find the trigger again is worse than no popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const signOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    // refresh() first so the server components drop their cached session before
    // the navigation — without it the next render can still read the old user.
    router.refresh();
    router.replace("/login");
  };

  const onRail = variant === "rail";
  const initial = (name || "?").trim().charAt(0).toUpperCase();

  const items = (
    <div className="grid gap-0.5">
      <Link
        href="/profile"
        onClick={() => setOpen(false)}
        className="flex min-h-[44px] items-center gap-3 rounded-[9px] px-3 text-[13px] font-semibold text-[var(--w-ink)] hover:bg-[var(--chip)]"
      >
        <UserCog size={16} className="text-[var(--w-muted)]" />
        My profile
      </Link>
      <Link
        href="/payouts"
        onClick={() => setOpen(false)}
        className="flex min-h-[44px] items-center gap-3 rounded-[9px] px-3 text-[13px] font-semibold text-[var(--w-ink)] hover:bg-[var(--chip)]"
      >
        <Wallet2 size={16} className="text-[var(--w-muted)]" />
        Payouts
      </Link>

      {/* Both of these render nothing when they are not applicable — already
          installed, or notifications already granted/unsupported. */}
      <InstallAppButton />
      <EnableNotificationsButton />

      <div className="my-1 h-px bg-[var(--w-line)]" />

      <button
        onClick={signOut}
        disabled={signingOut}
        className="flex min-h-[44px] items-center gap-3 rounded-[9px] px-3 text-[13px] font-semibold text-[var(--bad)] hover:bg-[var(--bad-soft)] disabled:opacity-60"
      >
        <LogOut size={16} />
        {signingOut ? "Signing out" : "Log out"}
      </button>
    </div>
  );

  return (
    <div ref={wrap} className={onRail ? "relative" : ""}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={[
          "flex w-full items-center gap-3 rounded-[11px] p-3 text-left transition-colors",
          onRail
            ? "bg-[#421750] hover:bg-[#4d1d5e]"
            : "border border-[var(--w-line-strong)] bg-[var(--w-raised)]",
        ].join(" ")}
      >
        <span
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold",
            onRail ? "bg-[#ffdf9a] text-[#5b1f79]" : "bg-[var(--w-orange-soft)] text-[var(--w-orange-ink)]",
          ].join(" ")}
        >
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[13px] font-bold ${
              onRail ? "text-white" : "text-[var(--w-ink-strong)]"
            }`}
          >
            {name || "Your account"}
          </span>
          <span
            className={`block truncate text-[11px] ${
              onRail ? "text-[#b99bc5]" : "text-[var(--w-muted)]"
            }`}
          >
            {role === "COMPANY" ? "Company account" : "Student account"}
          </span>
        </span>
        <ChevronUp
          size={15}
          className={[
            "shrink-0 transition-transform",
            onRail ? "text-[#b99bc5]" : "text-[var(--w-faint)]",
            open ? "" : "rotate-180",
          ].join(" ")}
        />
      </button>

      {open &&
        (onRail ? (
          <div
            role="menu"
            className="absolute bottom-[calc(100%+8px)] left-0 w-full rounded-[13px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-1.5 shadow-[0_18px_44px_-14px_rgba(28,9,37,0.45)]"
          >
            {items}
          </div>
        ) : (
          <div role="menu" className="mt-2 rounded-[13px] border border-[var(--w-line-strong)] bg-[var(--w-raised)] p-1.5">
            {items}
          </div>
        ))}
    </div>
  );
}
