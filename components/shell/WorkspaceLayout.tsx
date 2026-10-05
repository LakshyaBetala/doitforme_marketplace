import { redirect } from "next/navigation";
import { DM_Sans, Manrope } from "next/font/google";
import { createServer } from "@/lib/supabaseServer";
import AppShell from "./AppShell";

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
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, role, phone, college, upi_id")
    .eq("id", user.id)
    .single();

  if (profile?.role === "COMPANY") redirect("/company/dashboard");
  if (!profile || !profile.phone || !profile.college) redirect("/onboarding");

  return (
    <div className={`${dmSans.className} ${manrope.variable}`}>
      <AppShell name={profile.name} role={profile.role}>
        {children}
      </AppShell>
    </div>
  );
}
