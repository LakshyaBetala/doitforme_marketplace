import { cookies } from "next/headers";
import { createServer } from "@/lib/supabaseServer";
import { isAdminEmail } from "@/lib/admins";
import { appRoleFor, canUseApp, type AppIdentity, type AppRole } from "@/lib/appShell";

/**
 * One place that answers "who is this and which app surface do they get".
 *
 * The layout, the Today screen and the Me screen each resolved this
 * independently — the same two Supabase queries and the same precedence
 * written out three times. Three copies of an authorisation decision is how
 * they drift, and the one that drifts is the one nobody re-reads.
 *
 * THE PREVIEW COOKIE. An admin always resolves to ADMIN, because precedence is
 * ADMIN > PM > member and the owner should get the widest surface. The side
 * effect is that the owner can NEVER see what a builder sees, which makes the
 * builder and partner screens untestable without registering a second account.
 * So an admin may set a preview role and borrow those tabs.
 *
 * IT PREVIEWS THE SURFACE, NOT THE PERMISSIONS, and that distinction is the
 * whole safety of it. The cookie changes which tabs and which layout render.
 * It does not touch the Supabase session, so every query still runs under the
 * admin's own RLS — an admin previewing as TECH sees a builder's SCREENS with
 * an admin's DATA. That means it is useless as an escalation (an admin already
 * had the wider access) and it must not be trusted as a test of what a real
 * builder can read. The live RLS audit, `npm run db:access-audit`, is what
 * proves that.
 *
 * `.server.ts` because `cookies()` is request-scoped and this must never be
 * reachable from a client component.
 */

const PREVIEW_COOKIE = "ic_preview_role";
const PREVIEWABLE: AppRole[] = ["PM", "TECH", "OUTREACH"];

export function isPreviewable(v: unknown): v is AppRole {
  return typeof v === "string" && (PREVIEWABLE as string[]).includes(v);
}

export { PREVIEW_COOKIE, PREVIEWABLE };

export type ResolvedApp = {
  /** Null when signed out. */
  userId: string | null;
  email: string | null;
  /** First name, for the greeting. */
  firstName: string;
  identity: AppIdentity;
  /** The surface to render. Null when this person has no workspace. */
  role: AppRole | null;
  /** What they actually are, ignoring any preview. */
  realRole: AppRole | null;
  /** True when `role` came from the preview cookie rather than from identity. */
  previewing: boolean;
  allowed: boolean;
};

export async function resolveApp(): Promise<ResolvedApp> {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: null,
      email: null,
      firstName: "there",
      identity: {},
      role: null,
      realRole: null,
      previewing: false,
      allowed: false,
    };
  }

  const [{ data: profile }, { data: pmRows }] = await Promise.all([
    supabase.from("users").select("is_elite, inner_circle_role, name").eq("id", user.id).maybeSingle(),
    // An existence check, not a page of projects: the question is only
    // "is this person a PM at all".
    supabase.from("projects").select("id").eq("pm_id", user.id).limit(1),
  ]);

  const identity: AppIdentity = {
    isAdmin: isAdminEmail(user.email),
    isPm: Boolean(pmRows && pmRows.length > 0),
    isElite: profile?.is_elite,
    innerCircleRole: profile?.inner_circle_role,
  };

  const realRole = appRoleFor(identity);

  // Only an admin may borrow another surface, and only one that exists.
  let role = realRole;
  let previewing = false;
  if (identity.isAdmin) {
    const wanted = (await cookies()).get(PREVIEW_COOKIE)?.value;
    if (isPreviewable(wanted)) {
      role = wanted;
      previewing = true;
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    firstName: (profile?.name as string | null)?.split(" ")[0] || "there",
    identity,
    role,
    realRole,
    previewing,
    allowed: canUseApp(identity),
  };
}
