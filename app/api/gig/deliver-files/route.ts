import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const gigId = formData.get("gigId") as string;
    const deliveryLink = (formData.get("deliveryLink") as string) || "";
    const files = formData.getAll("files") as File[];

    if (!gigId) return NextResponse.json({ error: "Missing gigId" }, { status: 400 });

    // Validate gig and worker identity
    const { data: gig, error: gigError } = await supabaseAdmin
      .from("gigs")
      .select("assigned_worker_id, status, is_physical, poster_id, title")
      .eq("id", gigId)
      .single();

    if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });
    if (gig.assigned_worker_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const currentStatus = gig.status?.toLowerCase();
    if (currentStatus !== "assigned" && currentStatus !== "delivered") {
      return NextResponse.json({ error: `Gig is not in progress (Status: ${gig.status})` }, { status: 400 });
    }

    // Validate: at least a link or a file must be provided
    if (!deliveryLink && files.length === 0) {
      return NextResponse.json({ error: "Please provide a delivery link or upload files." }, { status: 400 });
    }

    // Upload files to Supabase Storage
    const uploadedPaths: string[] = [];
    const allowedTypes = [
      "image/jpeg", "image/png", "image/gif", "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];

    for (const file of files.slice(0, 5)) { // max 5 files
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: `File ${file.name} exceeds 10MB limit` }, { status: 400 });
      }

      const ext = file.name.split(".").pop();
      const path = `deliveries/${gigId}/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from("gig-images") // reuse existing bucket
        .upload(path, buffer, { contentType: file.type, upsert: true });

      if (uploadError) {
        console.error("File upload error:", uploadError.message);
        return NextResponse.json({ error: "File upload failed: " + uploadError.message }, { status: 500 });
      }
      uploadedPaths.push(path);
    }

    // 24-hour auto-release window (poster gets 24h to review or it auto-accepts)
    const autoReleaseTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("gigs")
      .update({
        status: "delivered",
        delivery_link: deliveryLink || null,
        delivery_files: uploadedPaths.length > 0 ? uploadedPaths : null,
        delivered_at: new Date().toISOString(),
        auto_release_at: autoReleaseTime,
      })
      .eq("id", gigId);

    if (updateError) throw updateError;

    // Notify poster via Telegram
    try {
      const { data: poster } = await supabaseAdmin
        .from("users")
        .select("telegram_chat_id")
        .eq("id", gig.poster_id)
        .single();

      if (poster?.telegram_chat_id) {
        const { sendTelegramAlert } = await import("@/lib/telegram");
        await sendTelegramAlert(
          poster.telegram_chat_id,
          `📦 <b>Work Delivered!</b>\nThe worker has submitted their work for <i>${gig.title}</i>.\nYou have <b>24 hours</b> to review and approve. If no action is taken, payment will be auto-released.\n<a href="https://doitforme.in/gig/${gigId}">Review Now →</a>`
        );
      }
    } catch (e) {
      console.error("Telegram notification failed:", e);
    }

    return NextResponse.json({ success: true, uploadedFiles: uploadedPaths });

  } catch (err: any) {
    console.error("Deliver Files Error:", err);
    return NextResponse.json({ error: err.message || "Delivery failed" }, { status: 500 });
  }
}
