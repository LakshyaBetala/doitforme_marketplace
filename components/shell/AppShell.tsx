import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import Topbar from "./Topbar";
import WorkspaceThemeColor from "./WorkspaceThemeColor";
import ShellMain from "./ShellMain";

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
  isElite,
  innerCircleRole,
  action,
}: {
  children: React.ReactNode;
  name?: string | null;
  role?: string | null;
  /** Inner Circle membership, which decides whether the role surface is in nav. */
  isElite?: boolean | null;
  innerCircleRole?: string | null;
  action?: React.ReactNode;
}) {
  return (
    <div className="workspace flex min-h-[100dvh]">
      <WorkspaceThemeColor />
      <Sidebar name={name} role={role} isElite={isElite} innerCircleRole={innerCircleRole} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav name={name} role={role} isElite={isElite} innerCircleRole={innerCircleRole} />
        <Topbar action={action} />

        <ShellMain>{children}</ShellMain>
      </div>
    </div>
  );
}
