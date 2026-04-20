import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                        }
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const ADMINS = ["betala911@gmail.com", "doitforme.in@gmail.com"];
        if (!ADMINS.includes(user.email || "")) {
            return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
        }

        const body = await req.json();
        const { targetUserId } = body;

        if (!targetUserId) {
            return NextResponse.json({ error: "Target user ID required." }, { status: 400 });
        }

        const serviceRoleClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Update user
        const { error: userError } = await serviceRoleClient
            .from("users")
            .update({ is_verified_company: true })
            .eq("id", targetUserId);

        if (userError) {
            console.error("verifyUser update error (users):", userError);
            return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
        }

        // Also activate company
        const { error: companyError } = await serviceRoleClient
            .from("companies")
            .update({ is_active: true })
            .eq("user_id", targetUserId);

        if (companyError) {
            console.error("verifyUser update error (companies):", companyError);
        }

        return NextResponse.json({ success: true, message: "Company verified." });
    } catch (err: any) {
        console.error("Verify company error:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
