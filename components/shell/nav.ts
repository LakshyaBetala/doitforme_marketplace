import {
  Home,
  Search,
  Briefcase,
  MessageCircle,
  UserCog,
  Sparkles,
  LifeBuoy,
  Hammer,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { InnerCircleRole } from "@/lib/innerCircle";

/**
 * The workspace navigation, in one place.
 *
 * Before this file, there was no app shell at all: app/dashboard/layout.tsx was
 * a 36-line auth gate rendering a bare div, and 25 separate files hand-rolled
 * their own back button or nav strip. Every page invented its own way out of
 * itself, which is why the product never felt like one product.
 *
 * TWO DELIBERATE OMISSIONS, both from the redesign brief:
 *
 * 1. No Wallet. The Figma has one, but payouts are manual — every Indian
 *    payouts product is withheld from proprietorships, so cron/process-payouts
 *    reports a queue and a human pays from the admin desk. A Wallet implies a
 *    balance you can withdraw on demand, which we cannot offer. Earnings live
 *    on the profile instead. The orphaned /payouts route (linked from nowhere
 *    in the entire codebase) goes with it.
 *
 * 2. The Inner Circle appears ONCE. The Figma shows it twice — a sidebar item
 *    under "Extras" and a card in the right rail — which reads as two different
 *    features to anyone who has not seen the design file. It is a real
 *    destination, so it belongs in the nav, and the right rail stays free for
 *    things that change.
 */

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown as a small count chip. Undefined means no chip, 0 renders nothing. */
  count?: number;
  badge?: string;
};

export const PRIMARY_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: Home },
  { label: "Explore work", href: "/feed", icon: Search },
  { label: "My work", href: "/activity", icon: Briefcase },
  { label: "Messages", href: "/messages", icon: MessageCircle },
];

export const SECONDARY_NAV: NavItem[] = [
  { label: "The Inner Circle", href: "/inner-circle", icon: Sparkles, badge: "NEW" },
  { label: "My profile", href: "/profile", icon: UserCog },
  { label: "Help & support", href: "/contact", icon: LifeBuoy },
];

/** Bottom bar on phones. Four is the most that stays tappable at 360px. */
export const MOBILE_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Explore", href: "/feed", icon: Search },
  { label: "My work", href: "/activity", icon: Briefcase },
  { label: "Messages", href: "/messages", icon: MessageCircle },
];

/**
 * The Inner Circle's two working surfaces. These are NOT in SECONDARY_NAV
 * because almost nobody can use them: a TECH member has no business in a lead
 * list holding other companies' contact details, and an OUTREACH member has no
 * delivery queue. Showing a nav item that 403s is worse than not showing it.
 *
 * The nav is a convenience, not the boundary — RLS and is_outreach() are. See
 * 20261006_inner_circle_roles_and_outreach.sql.
 */
const ROLE_NAV: Record<InnerCircleRole, NavItem> = {
  TECH: { label: "My briefs", href: "/inner-circle/work", icon: Hammer },
  OUTREACH: { label: "Outreach", href: "/inner-circle/outreach", icon: Target },
};

export type Membership = {
  isElite?: boolean | null;
  innerCircleRole?: string | null;
};

/**
 * The secondary nav for this particular person.
 *
 * A member's role surface sits directly under The Inner Circle, so the tier and
 * the work it unlocks read as one thing rather than two unrelated entries.
 */
export function secondaryNavFor({ isElite, innerCircleRole }: Membership): NavItem[] {
  const items = [...SECONDARY_NAV];
  const role = innerCircleRole as InnerCircleRole | null | undefined;
  if (isElite && role && ROLE_NAV[role]) {
    items.splice(1, 0, ROLE_NAV[role]);
  }
  return items;
}

/** Every href the nav can produce — used by Topbar to title the current page. */
export const ALL_NAV_ITEMS: NavItem[] = [
  ...PRIMARY_NAV,
  ...SECONDARY_NAV,
  ...Object.values(ROLE_NAV),
];

/**
 * Longest match wins, so /dashboard does not light up while you are on
 * /dashboard/settings and /profile does not light up on /profile/worker-setup.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  // /inner-circle has children that are their own nav items, so a prefix match
  // would light up two rows at once on /inner-circle/outreach.
  if (href === "/inner-circle") return pathname === "/inner-circle";
  return pathname === href || pathname.startsWith(`${href}/`);
}
