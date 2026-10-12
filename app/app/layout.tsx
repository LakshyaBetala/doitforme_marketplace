import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { createServer } from "@/lib/supabaseServer";
import { isAdminEmail } from "@/lib/admins";
import { appRoleFor, canUseApp, ROLE_TITLE, ROLE_BLURB } from "@/lib/appShell";
import BottomTabs from "@/components/app/BottomTabs";
import JoinScreen from "@/components/app/JoinScreen";
import "./app-theme.css";

export const metadata: Metadata = {
  title: "Inner Circle",
  description: "The Inner Circle workspace for DoItForMe builders and partners.",
  // Invite-only, so there is nothing here for a crawler and a public result
  // would advertise a door nobody can open.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The app is a fixed, full-bleed surface. Letting it zoom turns a bottom tab
  // bar into something you can pan away from, which no native app does.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#07070B",
};

/**
 * THE GATE, AND WHY IT IS A SERVER COMPONENT.
 *
 * Membership is the product here — the Inner Circle only means something if
 * the app is genuinely unavailable to everyone else. A client-side check would
 * ship the whole surface to the browser and hide it with CSS, which is not a
 * gate, it is a curtain. This resolves identity on the server and the
 * unauthorised branch never renders the shell at all.
 *
 * It is still not the security boundary. RLS is: `is_outreach()`,
 * `is_project_pm()` and the policies in 20261006 / 20261013 are what actually
 * stop a builder reading a deal value. This layout decides what to DRAW. Both
 * layers exist on purpose — CLAUDE.md records that the nav is a convenience and
 * the policies are the boundary.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/app");

  const [{ data: profile }, { data: pmRows }] = await Promise.all([
    supabase.from("users").select("is_elite, inner_circle_role, name").eq("id", user.id).maybeSingle(),
    // One row is all that is being asked: "is this person a PM at all". The
    // limit keeps it a cheap existence check rather than loading a book of
    // projects to compute a boolean.
    supabase.from("projects").select("id").eq("pm_id", user.id).limit(1),
  ]);

  const identity = {
    isAdmin: isAdminEmail(user.email),
    isPm: Boolean(pmRows && pmRows.length > 0),
    isElite: profile?.is_elite,
    innerCircleRole: profile?.inner_circle_role,
  };

  const role = appRoleFor(identity);

  if (!canUseApp(identity) || !role) {
    // NOT a locked door. The app is listed publicly and anyone can install it,
    // so the most common first run is somebody with no membership — and
    // "invite only, goodbye" wastes that install. JoinScreen runs the same
    // application funnel the website does, or shows where their existing
    // application stands. See the note at the top of that file.
    return (
      <div className="icapp">
        <JoinScreen userId={user.id} />
      </div>
    );
  }

  const name = (profile?.name as string | null)?.split(" ")[0] || "there";

  return (
    <div className="icapp">
      <div className="mx-auto w-full max-w-[520px]">
        {/* The one gradient in the app. */}
        <header className="icapp-wash px-5 pb-5" style={{ paddingTop: "calc(var(--a-safe-top) + 20px)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--a-accent-ink)]">
                Inner Circle
              </p>
              <h1
                className="mt-1 truncate text-[26px] font-semibold leading-tight tracking-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "-0.02em" }}
              >
                {name}
              </h1>
              <p className="mt-0.5 text-[12.5px] text-[var(--a-fg-muted)]">{ROLE_BLURB[role]}</p>
            </div>
            {/*
              The badge is the point of the tier. It is the only place in the
              product that says, in the member's own words rather than the
              database's, that they were let in. Two paid probation rounds buy
              this pill; it should look like it cost something.
            */}
            <span className="shrink-0 rounded-full border border-[var(--a-accent-line)] bg-[var(--a-accent-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--a-accent-ink)]">
              {ROLE_TITLE[role]}
            </span>
          </div>
        </header>

        <main
          className="icapp-scroll px-5"
          style={{ paddingBottom: "calc(var(--a-tabbar) + var(--a-safe-bottom) + 24px)" }}
        >
          {children}
        </main>
      </div>
      <BottomTabs role={role} />
    </div>
  );
}
