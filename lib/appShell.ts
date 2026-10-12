/**
 * The Inner Circle app surface: who gets in, and what they see.
 *
 * WHY A SEPARATE SURFACE AT ALL, rather than the website in a WebView.
 * The marketplace is web-shaped — browsing, long listings, SEO, a marketing
 * landing page. The Inner Circle is app-shaped: a small set of screens that one
 * person opens repeatedly to answer "what is mine today, and what am I owed".
 * That is what a phone app is for, and it is the only part of this product that
 * genuinely wants to be one. So `/app` is designed as an app — bottom tabs,
 * one column, no breadcrumbs, no sidebar — and shares the same Next.js app,
 * the same Supabase RLS and the same auth as the website. No second codebase,
 * no second set of auth bugs.
 *
 * THE ROLE IS DERIVED, NEVER STORED. There is no `app_role` column and there
 * must not be one. `users.inner_circle_role` is TECH or OUTREACH; being an
 * admin is the email whitelist in lib/admins.ts; being a PM is owning a row in
 * `projects`. Three different facts in three places, and a cached fourth column
 * summarising them would be the one that goes stale — the same reason
 * workflowFor() and applicationStage() are computed at read time. See CLAUDE.md
 * on `managed_status` and on `kyc_verified` drifting from `kyc_status`.
 *
 * PRECEDENCE IS DELIBERATE: admin > pm > member. The owner is also a PM and may
 * also hold a member role; they should get the widest surface, not the first
 * one that happens to match.
 */

import type { InnerCircleRole } from "@/lib/innerCircle";

export type AppRole = "ADMIN" | "PM" | "TECH" | "OUTREACH";

/** Everything needed to decide the surface, gathered by the caller. */
export type AppIdentity = {
  isAdmin?: boolean | null;
  /** True when this person is `pm_id` on at least one project. */
  isPm?: boolean | null;
  isElite?: boolean | null;
  innerCircleRole?: string | null;
};

/**
 * The app is invite-only, and that is the product, not a limitation.
 *
 * A tier nobody is refused from is not a tier. The whole retention argument for
 * the Inner Circle is that membership was earned through two paid probation
 * rounds, so the app has to be visibly unavailable to everyone else — otherwise
 * "you are in" means nothing. Admins and PMs are in by virtue of running it.
 */
export function canUseApp(id: AppIdentity): boolean {
  return Boolean(id.isAdmin || id.isPm || (id.isElite && roleOf(id) !== null));
}

/** The one role whose surface this person should see. */
export function appRoleFor(id: AppIdentity): AppRole | null {
  if (id.isAdmin) return "ADMIN";
  if (id.isPm) return "PM";
  if (!id.isElite) return null;
  return roleOf(id);
}

function roleOf(id: AppIdentity): InnerCircleRole | null {
  return id.innerCircleRole === "TECH" || id.innerCircleRole === "OUTREACH"
    ? id.innerCircleRole
    : null;
}

export type Tab = {
  href: string;
  label: string;
  /** Lucide icon name, resolved by the component — keeps this file pure. */
  icon: "home" | "hammer" | "target" | "wallet" | "folder" | "users" | "user";
};

/**
 * FOUR TABS, NEVER FIVE.
 *
 * A thumb reaches three comfortably and four at a stretch; a fifth is where
 * phone apps start hiding things behind "More", which is a menu wearing a tab's
 * clothes. Every role therefore gets Today, two tabs of real work, and Me.
 *
 * "Today" leads for every role because the question that opens the app is
 * always the same — what needs me now — and answering it on arrival is the
 * difference between a tool and a filing cabinet.
 *
 * Earnings is a TOP-LEVEL tab for the two paid-per-outcome roles. Burying "what
 * am I owed" inside a work list is how it stops being believed, and the first
 * payout is the conversation that decides whether a student trusts anything
 * else here.
 */
export const TABS: Record<AppRole, Tab[]> = {
  TECH: [
    { href: "/app", label: "Today", icon: "home" },
    { href: "/app/briefs", label: "Briefs", icon: "hammer" },
    { href: "/app/earnings", label: "Earnings", icon: "wallet" },
    { href: "/app/me", label: "Me", icon: "user" },
  ],
  OUTREACH: [
    { href: "/app", label: "Today", icon: "home" },
    { href: "/app/leads", label: "Leads", icon: "target" },
    { href: "/app/earnings", label: "Earnings", icon: "wallet" },
    { href: "/app/me", label: "Me", icon: "user" },
  ],
  PM: [
    { href: "/app", label: "Today", icon: "home" },
    { href: "/app/projects", label: "Projects", icon: "folder" },
    { href: "/app/team", label: "Team", icon: "users" },
    { href: "/app/me", label: "Me", icon: "user" },
  ],
  ADMIN: [
    { href: "/app", label: "Today", icon: "home" },
    { href: "/app/projects", label: "Projects", icon: "folder" },
    { href: "/app/team", label: "Team", icon: "users" },
    { href: "/app/me", label: "Me", icon: "user" },
  ],
};

/**
 * What the member is called, in the app, to their face.
 *
 * Not the enum. "TECH" is a database value; "Builder" is what someone would
 * call themselves, and the app is the one place that should use their word.
 */
export const ROLE_TITLE: Record<AppRole, string> = {
  ADMIN: "Founder",
  PM: "Project lead",
  TECH: "Builder",
  OUTREACH: "Partner",
};

/** One line, shown under the name. Earned, not assigned. */
export const ROLE_BLURB: Record<AppRole, string> = {
  ADMIN: "You run this.",
  PM: "You own delivery and the client relationship.",
  TECH: "You ship the work clients pay for.",
  OUTREACH: "You bring in the work everyone else builds.",
};

/** Which tab is active, longest-prefix first so /app does not match everything. */
export function activeTab(tabs: Tab[], pathname: string): string {
  const match = [...tabs]
    .sort((a, b) => b.href.length - a.href.length)
    .find((t) => pathname === t.href || pathname.startsWith(t.href + "/"));
  return match?.href ?? tabs[0]?.href ?? "/app";
}
