import WorkspaceLayout from "@/components/shell/WorkspaceLayout";
import "../workspace-theme.css";

// /settings/notifications already existed and rendered with no shell at all —
// a signed-in page with no navigation and no way back except the browser
// button. Putting the layout at the /settings level rather than on each page
// means anything added under it is framed correctly by default.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
