import WorkspaceLayout from "@/components/shell/WorkspaceLayout";
import "../workspace-theme.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayout lenient barePadded>{children}</WorkspaceLayout>;
}
