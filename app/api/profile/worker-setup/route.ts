import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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
                        } catch { }
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { skills, portfolio_links, experience, bio } = body;

        const updateData: Record<string, any> = {};
        if (skills !== undefined) updateData.skills = skills;
        if (portfolio_links !== undefined) updateData.portfolio_links = portfolio_links;
        if (experience !== undefined) updateData.experience = experience;
        if (bio !== undefined) updateData.bio = bio;

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "No fields provided to update." }, { status: 400 });
        }

        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', user.id);

        if (updateError) {
            console.error("Error updating profile:", updateError.message, updateError.details);
            return NextResponse.json({ error: `Database update failed: ${updateError.message}` }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Profile updated successfully" });

    } catch (err: any) {
        console.error("Worker Profile update error:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
