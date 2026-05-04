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

        // Detect content type and parse accordingly
        const contentType = req.headers.get("content-type") || "";
        let skills: string[] | undefined;
        let portfolio_links: string[] | undefined;
        let experience: string | undefined;
        let bio: string | undefined;
        let resumeFile: File | null = null;

        if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
            // Client sends FormData (multipart) — parse with formData()
            const formData = await req.formData();

            const skillsRaw = formData.get("skills");
            if (skillsRaw && typeof skillsRaw === "string") {
                try { skills = JSON.parse(skillsRaw); } catch { skills = []; }
            }

            const linksRaw = formData.get("portfolio_links");
            if (linksRaw && typeof linksRaw === "string") {
                try { portfolio_links = JSON.parse(linksRaw); } catch { portfolio_links = []; }
            }

            const expRaw = formData.get("experience");
            if (expRaw && typeof expRaw === "string") {
                experience = expRaw;
            }

            const bioRaw = formData.get("bio");
            if (bioRaw && typeof bioRaw === "string") {
                bio = bioRaw;
            }

            const file = formData.get("resume");
            if (file && file instanceof File && file.size > 0) {
                resumeFile = file;
            }
        } else {
            // Fallback: JSON body
            const body = await req.json();
            skills = body.skills;
            portfolio_links = body.portfolio_links;
            experience = body.experience;
            bio = body.bio;
        }

        const updateData: Record<string, any> = {};
        if (skills !== undefined) updateData.skills = skills;
        if (portfolio_links !== undefined) updateData.portfolio_links = portfolio_links;
        if (experience !== undefined) updateData.experience = experience;
        if (bio !== undefined) updateData.bio = bio;

        // Handle resume upload if present
        if (resumeFile) {
            if (resumeFile.size > 2 * 1024 * 1024) {
                return NextResponse.json({ error: "Resume must be less than 2MB." }, { status: 400 });
            }

            const fileExt = resumeFile.name.split('.').pop() || 'pdf';
            const fileName = `resume_${user.id}_${Date.now()}.${fileExt}`;
            const filePath = `resumes/${fileName}`;

            const arrayBuffer = await resumeFile.arrayBuffer();
            const fileBuffer = new Uint8Array(arrayBuffer);

            const { error: uploadError } = await supabaseAdmin.storage
                .from("gig-images")
                .upload(filePath, fileBuffer, {
                    cacheControl: "3600",
                    upsert: true,
                    contentType: resumeFile.type,
                });

            if (uploadError) {
                console.error("Resume upload error:", uploadError);
                return NextResponse.json({ error: `Resume upload failed: ${uploadError.message}` }, { status: 500 });
            }

            const { data: publicUrlData } = supabaseAdmin.storage
                .from("gig-images")
                .getPublicUrl(filePath);

            updateData.resume_url = publicUrlData.publicUrl;
        }

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
