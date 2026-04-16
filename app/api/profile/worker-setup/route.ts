import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

        const { error: updateError } = await supabaseAdmin
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
