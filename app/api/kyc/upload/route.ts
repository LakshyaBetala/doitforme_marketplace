import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Service-role client bypasses all Storage RLS policies
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Auth: verify the requesting user is logged in
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 3. Validate file type and size
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed (JPG/PNG)" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    // 4. Upload to Storage
    console.log("Starting KYC upload to bucket 'kyc-ids' for user:", user.id);
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `kyc/${user.id}/${user.id}_student_id_${Date.now()}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('gig-images')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true
      });

    if (uploadError) {
      console.error("KYC Storage Upload Error Details:", uploadError);
      return NextResponse.json({ 
        error: "Storage upload failed", 
        details: uploadError.message,
        code: (uploadError as any).statusCode 
      }, { status: 500 });
    }

    console.log("Upload successful:", uploadData.path);

    // 5. Update User Profile
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        student_id_url: filePath,
        kyc_status: 'PENDING'
      })
      .eq('id', user.id);

    if (updateError) {
      console.error("KYC Profile Update Error Details:", updateError);
      return NextResponse.json({ error: "Failed to update user profile", details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, path: filePath });

  } catch (err: any) {
    console.error("Fatal KYC Upload Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
