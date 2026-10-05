import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import Topbar from "./Topbar";

/**
 * The frame every signed-in page renders inside.
 *
 * This did not exist. app/dashboard/layout.tsx was an auth gate around a bare
 * div, the root layout rendered {children} with no navigation at all, and 25
 * files hand-rolled their own back button. The Figma is built around a
 * persistent rail, and no amount of restyling individual pages gets there — the
 * frame has to exist first, which is why this is the first thing built.
 *
 * Server component on purpose: only the three navigation pieces need to read
 * the pathname, so they are the client leaves and page content stays server
 * rendered.
 */
export default function AppShell({
  children,
  name,
  role,
  action,
}: {
  children: React.ReactNode;
  name?: string | null;
  role?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="workspace flex min-h-[100dvh]">
      <Sidebar name={name} role={role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav name={name} />
        <Topbar action={action} />

        {/* Bottom padding clears the mobile bar; lg drops it since the bar is gone. */}
        <main className="min-w-0 flex-1 px-4 pb-[calc(84px+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-[1180px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
