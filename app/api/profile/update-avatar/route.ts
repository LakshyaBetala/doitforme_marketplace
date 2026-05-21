import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File) || file.size === 0) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: "Image must be less than 5MB." }, { status: 400 });
        }

        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "File must be an image." }, { status: 400 });
        }

        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `avatar_${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await supabaseAdmin.storage
            .from("gig-images")
            .upload(filePath, fileBuffer, {
                cacheControl: "3600",
                upsert: true,
                contentType: file.type,
            });

        if (uploadError) {
            console.error("Avatar upload error:", uploadError);
            return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
        }

        const { data: publicUrlData } = supabaseAdmin.storage
            .from("gig-images")
            .getPublicUrl(filePath);

        const avatarUrl = publicUrlData.publicUrl;

        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: avatarUrl })
            .eq('id', user.id);

        if (updateError) {
            console.error("Error updating profile avatar:", updateError);
            return NextResponse.json({ error: `Database update failed: ${updateError.message}` }, { status: 500 });
        }
        
        await supabase.auth.updateUser({
            data: { avatar_url: avatarUrl }
        });

        return NextResponse.json({ success: true, avatar_url: avatarUrl, message: "Avatar updated successfully" });

    } catch (err: any) {
        console.error("Update avatar error:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
