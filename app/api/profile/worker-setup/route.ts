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
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await req.formData();
        const skillsRaw = formData.get("skills");
        const portfolioLinksRaw = formData.get("portfolio_links");
        const experience = formData.get("experience");
        const resumeFile = formData.get("resume") as File | null;

        const skills = skillsRaw ? JSON.parse(skillsRaw as string) : [];
        const portfolioLinks = portfolioLinksRaw ? JSON.parse(portfolioLinksRaw as string) : [];

        // Upload resume if exists
        let resume_url = null;
        if (resumeFile) {
            // Validate size
            if (resumeFile.size > 2 * 1024 * 1024) {
                return NextResponse.json({ error: "Resume must be less than 2MB." }, { status: 400 });
            }
            
            const fileExt = resumeFile.name.split('.').pop();
            const fileName = `${user.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('resumes')
                .upload(fileName, resumeFile, { upsert: true });

            if (uploadError) {
                console.error("Error uploading resume:", uploadError);
                return NextResponse.json({ error: "Failed to upload resume. Ensure 'resumes' bucket exists." }, { status: 500 });
            }
            
            resume_url = fileName;
        }

        const updateData: any = {
            skills,
            portfolio_links: portfolioLinks,
            experience: experience as string,
        };

        if (resume_url) {
            updateData.resume_url = resume_url;
        }

        const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { cookies: { get() { return '' }, set() {}, remove() {} } }
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
