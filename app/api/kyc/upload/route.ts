import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { verifyStudentIdImage } from "@/lib/kycVerification";
import { sendEmail } from "@/lib/email";

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
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${user.id}/${user.id}_student_id_${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabaseAdmin.storage
      .from('kyc-ids')
      .upload(filePath, fileBytes, {
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

    // 5. Pull the user's declared name/college to cross-check against the ID.
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('name, college, email')
      .eq('id', user.id)
      .single();

    // 6. Auto-verify with the free vision model (fails open -> manual_review).
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const result = await verifyStudentIdImage(base64, file.type, {
      declaredName: profile?.name,
      declaredCollege: profile?.college,
    });

    const approved = result.decision === "approved";
    const rejected = result.decision === "rejected";

    // 7. Persist decision. Status drives the UI + admin queue; kyc_verified is the
    //    boolean the rest of the app already keys off, so keep it in sync.
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        id_card_url: filePath,
        kyc_verified: approved,
        kyc_status: result.decision,
        kyc_confidence: result.confidence,
        kyc_institution: result.institution,
        kyc_rejection_reason: rejected ? result.reason : null,
        kyc_reviewed_at: result.decision === "manual_review" ? null : new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error("KYC Profile Update Error Details:", updateError);
      return NextResponse.json({ error: "Failed to update user profile", details: updateError.message }, { status: 500 });
    }

    // 8. Notify the student of the outcome (fire-and-forget; never fails the upload).
    if (profile?.email && (approved || rejected)) {
      sendEmail(approved ? "kyc_approved" : "kyc_rejected", {
        to: profile.email,
        recipientName: profile.name,
        extra: { reason: result.reason, institution: result.institution },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      path: filePath,
      decision: result.decision,
      reason: result.reason,
      institution: result.institution,
    });

  } catch (err: any) {
    console.error("Fatal KYC Upload Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
