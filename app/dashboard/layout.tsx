import { redirect } from "next/navigation";
import { createServer } from "@/lib/supabaseServer";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Fetch their public profile
    const { data: profile } = await supabase
        .from("users")
        .select("phone, college, upi_id")
        .eq("id", user.id)
        .single();

    // THE GATE: If critical profile data is missing, force onboarding.
    // This catches Google OAuth users who bypassed the signup form.
    if (!profile || !profile.phone || !profile.college) {
        redirect("/onboarding");
    }

    return (
        <div className="dashboard-wrapper">
            {children}
        </div>
    );
}
