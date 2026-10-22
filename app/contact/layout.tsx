import WorkspaceLayout from "@/components/shell/WorkspaceLayout";
import "../workspace-theme.css";

// Support is public (it is in the footer and the payment-provider checklist),
// but a signed-in person reaches it from "Help & support" in the sidebar and
// should stay inside the workspace. `lenient` gives them the shell and leaves
// everyone else the public page untouched.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayout lenient>{children}</WorkspaceLayout>;
}
