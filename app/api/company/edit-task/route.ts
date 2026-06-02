import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { containsSensitiveInfo } from "@/lib/moderation";

// Limited edit for a company-posted task. Allowed ONLY while the gig is `open`
// and nobody has been hired (no accepted applicant / escrow not funded). Title,
// description and category are editable while open; price is locked the moment
// anyone applies (no bait-and-switch). Ownership + state are enforced server-side
// because client-supplied gig fields are not trustworthy.
const CATEGORIES = [
  "Tech & Engineering", "Design & Creative", "Science & Medical", "Law & Humanities",
  "Commerce & Finance", "Academics & Gigs", "Data & Research", "Writing & Content",
  "Marketing & PR", "Other",
];

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const gigId = String(body.gigId || "");
    if (!gigId) return NextResponse.json({ error: "gigId required" }, { status: 400 });

    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const category = typeof body.category === "string" ? body.category : "";
    const priceRaw = body.price;

    if (!title || title.length < 3) return NextResponse.json({ error: "Title is too short." }, { status: 400 });
    if (!description || description.length < 10) return NextResponse.json({ error: "Description is too short." }, { status: 400 });
    if (category && !CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category." }, { status: 400 });

    // Re-moderate the edited copy (same regex guard used on post/chat).
    const mod = containsSensitiveInfo(`${title}\n${description}`);
    if (mod.detected) {
      return NextResponse.json({ error: `Edit blocked: ${mod.reason}. Keep contact/payment details off the listing.` }, { status: 400 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: gig, error: gErr } = await service
      .from("gigs")
      .select("id, poster_id, status, payment_status")
      .eq("id", gigId)
      .maybeSingle();
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });
    if (!gig) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    if (gig.poster_id !== user.id) return NextResponse.json({ error: "Forbidden: not your task." }, { status: 403 });
    if (gig.status !== "open") {
      return NextResponse.json({ error: "This task can no longer be edited — it's already in progress." }, { status: 409 });
    }

    // Lock everything once someone is hired (escrow funded / assigned).
    const { count: acceptedCount } = await service
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("gig_id", gigId)
      .in("status", ["accepted", "pending"]);
    if ((acceptedCount || 0) > 0) {
      return NextResponse.json({ error: "A worker is already hired/in progress — editing is locked." }, { status: 409 });
    }

    const update: Record<string, unknown> = { title, description };
    if (category) update.category = category;

    // Price: only editable while NO ONE has applied yet (people applied at the listed price).
    if (priceRaw !== undefined && priceRaw !== null && priceRaw !== "") {
      const price = Math.round(Number(priceRaw));
      if (!Number.isFinite(price) || price < 1) return NextResponse.json({ error: "Invalid price." }, { status: 400 });
      const { count: anyApps } = await service
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("gig_id", gigId);
      if ((anyApps || 0) === 0) {
        update.price = price;
      } else {
        // Silently ignore price change once applicants exist; surface a note to the client.
        return NextResponse.json({ error: "Price is locked — students have already applied at the listed price. You can still edit the title and description." }, { status: 409 });
      }
    }

    const { data: updated, error: uErr } = await service
      .from("gigs")
      .update(update)
      .eq("id", gigId)
      .select("id, title, description, category, price, status, max_workers")
      .single();
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    return NextResponse.json({ success: true, gig: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
