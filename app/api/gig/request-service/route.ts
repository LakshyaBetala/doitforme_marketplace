import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isServiceAdvert } from "@/lib/gigRoles";

/**
 * Hire someone from their service advert.
 *
 * A SERVICE listing is a shopfront, not a job — see lib/gigRoles.ts. Applying
 * to one made the reader an "applicant" for work they were trying to BUY, and
 * every downstream step then pointed the wrong way: the customer could not fund
 * it, the customer would have had to deliver it, and the provider would have
 * approved their own work. 787 people took that path and none of them reached a
 * transaction.
 *
 * So a request does not attach anything to the advert. It creates a normal
 * engagement in the platform's single money direction —
 *
 *     poster = the customer (pays)
 *     assigned worker = the provider (is paid)
 *
 * — with the provider pre-applied, so the customer can hire and fund through the
 * existing /api/gig/hire path and delivery, release, dispute and payout all work
 * with no special cases at all.
 *
 * The advert stays open. One shopfront can produce many engagements, which is
 * the entire point of having a shopfront.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  try {
    // Authenticate BEFORE reading the body. Validating input first tells an
    // anonymous prober the endpoint exists and what it wants — the same trap
    // /api/payments/verify-payment fell into.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please log in to request this service." }, { status: 401 });
    }

    const { serviceId, brief, offerPrice } = await req.json();
    if (!serviceId) {
      return NextResponse.json({ error: "Missing service id." }, { status: 400 });
    }

    const { data: advert, error: advertError } = await supabase
      .from("gigs")
      .select("id, title, description, category, price, poster_id, status, listing_type, is_physical, location")
      .eq("id", serviceId)
      .single();

    if (advertError || !advert) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }
    if (!isServiceAdvert(advert)) {
      return NextResponse.json(
        { error: "That listing is a task, not a service. Apply to it instead." },
        { status: 400 }
      );
    }
    if (advert.status !== "open") {
      return NextResponse.json({ error: "This service is no longer available." }, { status: 400 });
    }
    if (advert.poster_id === user.id) {
      return NextResponse.json({ error: "This is your own service listing." }, { status: 400 });
    }

    // Price comes from the advert, never from the request body — the same rule
    // the payment routes follow. A customer may offer MORE (a bigger job than
    // the advertised starting price), but may not talk the number down here;
    // negotiating below the asking price is what chat and negotiated_price are
    // for, and it needs the provider to agree.
    const advertised = Number(advert.price) || 0;
    const requested = Number(offerPrice) || 0;
    const price = requested > advertised ? requested : advertised;
    if (!Number.isFinite(price) || price < 1) {
      return NextResponse.json({ error: "This service has no valid price." }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Don't let one customer pile up duplicate open engagements against the same
    // advert by double-tapping the button or coming back a day later. Hand the
    // existing one back instead — the flow then resumes exactly where it was.
    const { data: existing } = await supabaseAdmin
      .from("gigs")
      .select("id")
      .eq("source_service_id", advert.id)
      .eq("poster_id", user.id)
      .eq("status", "open")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, gigId: existing.id, existing: true });
    }

    const cleanBrief = String(brief || "").trim();

    // The engagement. listing_type HUSTLE because that is what it now is: a
    // client paying a student for work. It carries source_service_id so the
    // provider knows which advert produced it.
    const { data: engagement, error: engagementError } = await supabaseAdmin
      .from("gigs")
      .insert({
        poster_id: user.id,
        title: advert.title,
        description: cleanBrief || advert.description,
        category: advert.category,
        price,
        listing_type: "HUSTLE",
        status: "open",
        max_workers: 1,
        is_physical: advert.is_physical,
        location: advert.location,
        source_service_id: advert.id,
        payment_status: "UNPAID",
        escrow_status: "NONE",
      })
      .select("id")
      .single();

    if (engagementError || !engagement) {
      console.error("[request-service] engagement insert failed:", engagementError?.message);
      return NextResponse.json({ error: "Could not create the request." }, { status: 500 });
    }

    // Pre-apply the provider. They are the only candidate — the customer picked
    // this person specifically — so the customer can go straight to hiring.
    // Escrow-only, forced server-side, exactly as /api/gig/apply does it.
    const { error: applicationError } = await supabaseAdmin.from("applications").insert({
      gig_id: engagement.id,
      worker_id: advert.poster_id,
      status: "pending",
      pitch: cleanBrief || `Requested from your "${advert.title}" service listing.`,
      payment_preference: "ESCROW",
    });

    if (applicationError) {
      // The engagement exists but has no candidate on it, which is a dead end
      // for both sides. Remove it rather than leave a half-built gig behind.
      await supabaseAdmin.from("gigs").delete().eq("id", engagement.id);
      console.error("[request-service] application insert failed:", applicationError.message);
      return NextResponse.json({ error: "Could not create the request." }, { status: 500 });
    }

    // Open the conversation on the engagement, not the advert, so the thread and
    // the money are about the same gig.
    await supabaseAdmin.from("messages").insert({
      gig_id: engagement.id,
      sender_id: user.id,
      receiver_id: advert.poster_id,
      content:
        cleanBrief ||
        `Hi — I'd like to hire you for "${advert.title}". Happy to share details here.`,
      message_type: "text",
      is_pre_agreement: true,
    });

    // Fire-and-forget, like every other notification: a failed alert must never
    // undo a request the customer has already made.
    try {
      const { data: provider } = await supabaseAdmin
        .from("users")
        .select("email, name, telegram_chat_id")
        .eq("id", advert.poster_id)
        .single();

      if (provider?.telegram_chat_id) {
        const { sendTelegramAlert } = await import("@/lib/telegram");
        await sendTelegramAlert(
          provider.telegram_chat_id,
          `<b>New service request</b>\nSomeone wants to hire you for <i>${advert.title}</i>.\n<a href="https://doitforme.in/gig/${engagement.id}">View request</a>`
        );
      }
      if (provider?.email) {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail("service_requested", {
          to: provider.email,
          recipientName: provider.name,
          gigTitle: advert.title,
          gigId: engagement.id,
          amount: price,
        });
      }
    } catch (e) {
      console.error("Notification (request-service) failed:", e);
    }

    return NextResponse.json({ success: true, gigId: engagement.id });
  } catch (error: any) {
    console.error("Request Service Error:", error?.message);
    return NextResponse.json({ error: "Could not create the request." }, { status: 500 });
  }
}
