import {
  Home,
  Search,
  Briefcase,
  MessageCircle,
  UserCog,
  Sparkles,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";

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
 * Longest match wins, so /dashboard does not light up while you are on
 * /dashboard/settings and /profile does not light up on /profile/worker-setup.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
