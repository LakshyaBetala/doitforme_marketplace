import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admins";
import { isRole } from "@/lib/innerCircle";

/**
 * Admin review of Inner Circle applications.
 *
 * Without this, the tier is a form that writes rows nobody can act on — which is
 * what users.is_elite already was for months: a real column, 0 rows flagged, and
 * no way in the product to flip it.
 *
 * Approving does TWO writes that have to agree: the application row is marked
 * approved, and users.is_elite / users.inner_circle_role are set. Membership is
 * is_elite (that is what the managed assignment desk sorts by); the application
 * is only the paper trail. Postgres has no cross-table transaction available to
 * us over PostgREST, so the ORDER matters: set the user first. If the second
 * write fails the person is a member whose application still reads pending —
 * visible and fixable. The other order would leave an approved application and
 * no access, which looks like a working approval and is not.
 */

export async function GET() {
  const admin = await requireAdmin();
  if ("error" in admin) return admin.error;

  const { data, error } = await admin.service
    .from("inner_circle_applications")
    .select("id, user_id, role, status, pitch, links, decision_note, created_at, decided_at, users:user_id(name, email, college, rating, rating_count, jobs_completed, kyc_verified, is_elite, inner_circle_role)")
    .order("status", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data || [] });
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;
    const service = admin.service;

    const { applicationId, action, note, role } = await req.json();

    if (!applicationId || !["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "applicationId and action ('approve'|'reject') are required." },
        { status: 400 }
      );
    }
    // A decision note is mandatory on a rejection, for the same reason it is on a
    // dispute: it is the only thing the student is told, and "no" with no reason
    // is how you lose someone who would have been a yes in three months.
    if (action === "reject" && !String(note || "").trim()) {
      return NextResponse.json(
        { error: "A note is required when rejecting — the student is shown it." },
        { status: 400 }
      );
    }

    const { data: application, error: readErr } = await service
      .from("inner_circle_applications")
      .select("id, user_id, role, status")
      .eq("id", applicationId)
      .single();

    if (readErr || !application) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    if (application.status !== "pending") {
      return NextResponse.json(
        { error: `This application is already ${application.status}.` },
        { status: 409 }
      );
    }

    // An admin may override which role they are admitted into — someone applies
    // to build and is obviously better at outreach.
    const grantedRole = isRole(role) ? role : application.role;
    if (!isRole(grantedRole)) {
      return NextResponse.json({ error: "Unknown role on this application." }, { status: 400 });
    }

    if (action === "approve") {
      // Membership FIRST. See the note at the top of this file for why the order
      // is not arbitrary.
      const { error: userErr } = await service
        .from("users")
        .update({ is_elite: true, inner_circle_role: grantedRole })
        .eq("id", application.user_id);

      if (userErr) {
        return NextResponse.json(
          { error: `Could not grant membership: ${userErr.message}` },
          { status: 500 }
        );
      }
    }

    const { error: appErr } = await service
      .from("inner_circle_applications")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        role: grantedRole,
        decision_note: String(note || "").trim() || null,
        decided_at: new Date().toISOString(),
        decided_by: admin.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      // Only move it if it is still pending: two admins clicking at once must not
      // both "win" and double-write the decision.
      .eq("status", "pending");

    if (appErr) {
      return NextResponse.json(
        {
          error:
            action === "approve"
              ? `Membership was granted but the application row did not update: ${appErr.message}. Fix the row; access is already live.`
              : appErr.message,
        },
        { status: 500 }
      );
    }

    // Fire and forget, like every other notification in the app — a failed email
    // must never undo a decision that is already in the database.
    try {
      const { data: u } = await service
        .from("users")
        .select("email, name")
        .eq("id", application.user_id)
        .single();
      if (u?.email) {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail(action === "approve" ? "inner_circle_approved" : "inner_circle_rejected", {
          to: u.email,
          recipientName: u.name,
          extra: { role: grantedRole, reason: String(note || "").trim() },
        });
      }
    } catch (e) {
      console.error("[admin/inner-circle] notification failed:", e);
    }

    return NextResponse.json({ success: true, role: grantedRole });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

async function requireAdmin(): Promise<{ service: any; email: string } | { error: NextResponse }> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  // Authenticate BEFORE reading the body. A handler that validates input first
  // answers an anonymous prober with "400 missing fields", which tells them the
  // endpoint is open and what to send next.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 }) };
  }

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  return { service, email: user.email! };
}
