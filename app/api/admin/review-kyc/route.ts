import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMINS = ["betala911@gmail.com", "doitforme.in@gmail.com"];

// Admin review queue for student IDs that the AI flagged as `manual_review`
// (and a manual override for any decision). GET lists the queue with short-lived
// signed image URLs; POST approves or rejects a single user.
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;
    const service = admin.service;

    const { targetUserId, action, reason } = await req.json();
    if (!targetUserId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "targetUserId and action ('approve'|'reject') required." }, { status: 400 });
    }

    const approved = action === "approve";
    const { error } = await service
      .from("users")
      .update({
        kyc_verified: approved,
        kyc_status: approved ? "approved" : "rejected",
        kyc_rejection_reason: approved ? null : (reason || "Your ID could not be verified. Please re-upload a clear photo of your student ID."),
        kyc_reviewed_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the student of the manual decision.
    try {
      const { data: u } = await service.from("users").select("email, name, kyc_rejection_reason, kyc_institution").eq("id", targetUserId).single();
      if (u?.email) {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail(approved ? "kyc_approved" : "kyc_rejected", {
          to: u.email,
          recipientName: u.name,
          extra: { reason: u.kyc_rejection_reason, institution: u.kyc_institution },
        });
      }
    } catch (e) {
      console.error("Notification (review-kyc) failed:", e);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;
    const service = admin.service;

    const { data: users, error } = await service
      .from("users")
      .select("id, name, email, college, kyc_status, kyc_confidence, kyc_institution, kyc_rejection_reason, id_card_url")
      .eq("kyc_status", "manual_review")
      .not("id_card_url", "is", null)
      .order("kyc_reviewed_at", { ascending: true, nullsFirst: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Attach a short-lived signed URL for each private ID image.
    const withUrls = await Promise.all(
      (users || []).map(async (u: any) => {
        const { data: signed } = await service.storage
          .from("kyc-ids")
          .createSignedUrl(u.id_card_url, 60 * 30); // 30 min
        return { ...u, id_image_url: signed?.signedUrl || null };
      })
    );

    return NextResponse.json({ users: withUrls });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

async function requireAdmin(): Promise<{ service: any } | { error: NextResponse }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!ADMINS.includes(user.email || "")) {
    return { error: NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 }) };
  }
  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return { service };
}
