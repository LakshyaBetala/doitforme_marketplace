import WorkspaceLayout from "@/components/shell/WorkspaceLayout";
import "../workspace-theme.css";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
