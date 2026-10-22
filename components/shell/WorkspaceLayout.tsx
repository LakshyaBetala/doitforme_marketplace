import { redirect } from "next/navigation";
import { DM_Sans, Manrope } from "next/font/google";
import { createServer } from "@/lib/supabaseServer";
import AppShell from "./AppShell";
import { InShellProvider } from "./InShell";

// The design's faces, self-hosted and preloaded by next/font — no
// render-blocking request to fonts.googleapis.com the way the Figma export had.
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--font-display",
});

/**
 * Auth gate plus shell, in one place, for every signed-in workspace route.
 *
 * Each route keeps its own thin layout.tsx that calls this, rather than the
 * pages being moved into a route group — moving 2,800 lines of page code to
 * introduce a frame is a lot of risk for no user-visible gain, and a route
 * group can still come later once the pages are smaller.
 *
 * The gate itself is unchanged from the original dashboard layout: companies go
 * to their own portal, and a profile missing phone or college goes to
 * onboarding (which is what catches Google OAuth users who skipped the form).
 */
export default async function WorkspaceLayout({
  children,
  lenient = false,
  barePadded = false,
}: {
  children: React.ReactNode;
  /**
   * For pages a person can legitimately open before they are fully set up — a
   * shared /gig link, the post flow. They get the frame, but not the redirects:
   * a half-registered student is not bounced to onboarding for looking at a
   * task, and a company account is not thrown out of a page it was linked to.
   * Companies get the page bare, because the student rail is not their nav.
   */
  lenient?: boolean;
  /** Give the frameless fallback the page padding the shell would have supplied. */
  barePadded?: boolean;
}) {
  const bare = (node: React.ReactNode) =>
    barePadded ? (
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-6 sm:px-6 lg:px-10">{node}</div>
    ) : (
      <>{node}</>
    );
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // proxy.ts already gates /gig and /post with a ?next, so only /chat gets here.
    if (lenient) return bare(children);
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, role, phone, college, upi_id, is_elite, inner_circle_role")
    .eq("id", user.id)
    .single();

  if (lenient) {
    if (!profile || profile.role === "COMPANY") return bare(children);
  } else {
    if (profile?.role === "COMPANY") redirect("/company/dashboard");
    if (!profile || !profile.phone || !profile.college) redirect("/onboarding");
  }

  return (
    <div className={`${dmSans.className} ${manrope.variable}`}>
      <AppShell
        name={profile.name}
        role={profile.role}
        isElite={profile.is_elite}
        innerCircleRole={profile.inner_circle_role}
      >
        <InShellProvider>{children}</InShellProvider>
      </AppShell>
    </div>
  );
}
