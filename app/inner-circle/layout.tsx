import WorkspaceLayout from "@/components/shell/WorkspaceLayout";
import "../workspace-theme.css";

export default function InnerCircleLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayout>{children}</WorkspaceLayout>;
}
