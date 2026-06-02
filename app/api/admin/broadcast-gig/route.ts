import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMINS = ["betala911@gmail.com", "doitforme.in@gmail.com"];

// Admin broadcast: alert the engaged student audience about a new gig via the
// in-app bell (free, no cap) and/or transactional email (batched to respect the
// Resend free-tier daily cap). Idempotent + resumable via `gig_alerts_sent` —
// re-running only hits people who haven't received that channel yet.
const EMAIL_BATCH_DEFAULT = 90; // stay under Resend free-tier ~100/day

type AudienceRow = { id: string; email: string | null; name: string | null; profile_complete: boolean; has_interest: boolean; has_related: boolean };
// match = relationship to this gig (drives the email copy variant).
type Match = "interest" | "related" | "engaged";
type Audience = AudienceRow & { match: Match; rank: number };

// interest → declared interest is THIS gig's category
// related  → interested in one of the admin-selected related fields
// engaged  → otherwise active on the platform
function matchFor(u: AudienceRow): Match {
  if (u.has_interest) return "interest";
  if (u.has_related) return "related";
  return "engaged";
}
// Email send priority: interest, then related, then completed-profile, then rest.
function rankFor(u: AudienceRow): number {
  if (u.has_interest) return 0;
  if (u.has_related) return 1;
  if (u.profile_complete) return 2;
  return 3;
}

// Accepts an array or a comma-separated string of category labels.
function parseCategories(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  if (typeof input === "string") return input.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

// GET ?gigId=... — preview counts without sending anything.
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;
    const service = admin.service;

    const url = new URL(req.url);
    const gigId = url.searchParams.get("gigId");
    if (!gigId) return NextResponse.json({ error: "gigId required" }, { status: 400 });
    const extraCategories = parseCategories(url.searchParams.get("related"));

    const gig = await loadGig(service, gigId);
    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    const { audience } = await resolveTargets(service, gig, extraCategories);
    const sent = await alreadySent(service, gigId);
    const emailPending = audience.filter((u) => !sent.email.has(u.id) && u.email);

    return NextResponse.json({
      gig: { id: gig.id, title: gig.title, price: gig.price, category: gig.category, company: gig.company },
      audienceTotal: audience.length,
      // How many fall into each relationship bucket (the three email designs).
      buckets: {
        interest: audience.filter((u) => u.match === "interest").length,
        related: audience.filter((u) => u.match === "related").length,
        engaged: audience.filter((u) => u.match === "engaged").length,
      },
      inapp: { sent: sent.inapp.size, remaining: audience.filter((u) => !sent.inapp.has(u.id)).length },
      email: {
        sent: sent.email.size,
        remaining: emailPending.length,
        interestRemaining: emailPending.filter((u) => u.match === "interest").length,
        relatedRemaining: emailPending.filter((u) => u.match === "related").length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

// POST { gigId, channel: "inapp"|"email"|"both", test?: boolean, emailLimit?: number }
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;
    const { service, adminEmail } = admin;

    // audienceMode chooses which email design / who receives this send:
    //   interest → only students whose interest is this gig's category
    //   related  → only students into the chosen related fields (relatedCategories)
    //   engaged  → everyone active (each still gets the copy for THEIR match)
    const body = await req.json();
    const { gigId, channel = "email", test = false, emailLimit = EMAIL_BATCH_DEFAULT } = body;
    const audienceMode: Match = (["interest", "related", "engaged"].includes(body.audienceMode) ? body.audienceMode : "interest");
    const relatedCategories = parseCategories(body.relatedCategories);
    if (!gigId) return NextResponse.json({ error: "gigId required" }, { status: 400 });
    if (!["inapp", "email", "both"].includes(channel)) {
      return NextResponse.json({ error: "channel must be inapp | email | both" }, { status: 400 });
    }

    const gig = await loadGig(service, gigId);
    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    let { audience, posterUserId } = await resolveTargets(service, gig, relatedCategories);

    // Test mode: only the acting admin receives it (never logged, so a real run still reaches everyone).
    // The admin row is stamped with the mode being tested so the right email design renders.
    if (test) {
      audience = audience.filter((u) => u.email === adminEmail).map((u) => ({ ...u, match: audienceMode }));
      if (audience.length === 0) {
        const { data: me } = await service.from("users").select("id, email, name").eq("email", adminEmail).maybeSingle();
        if (me) audience = [{ id: me.id, email: me.email, name: me.name, profile_complete: true, has_interest: true, has_related: false, match: audienceMode, rank: 0 }];
      }
    }

    const sent = test ? { inapp: new Set<string>(), email: new Set<string>() } : await alreadySent(service, gigId);
    const link = `/gig/${gig.id}`;
    const result = {
      inappSent: 0, inappTargets: 0, inappError: null as string | null,
      emailSent: 0, emailFailed: 0, emailRemaining: 0, emailError: null as string | null,
    };

    // --- In-app bell (free, no cap) ---
    if (channel === "inapp" || channel === "both") {
      const targets = audience.filter((u) => u.id !== posterUserId && !sent.inapp.has(u.id));
      result.inappTargets = targets.length;
      if (targets.length) {
        const content = `New paid gig: "${gig.title}"${gig.price ? ` — ₹${gig.price}` : ""}${gig.category ? ` (${gig.category})` : ""}`;
        const notifications = targets.map((u) => ({ user_id: u.id, type: "gig", content, link, is_read: false }));
        const { error: nErr } = await service.from("notifications").insert(notifications);
        if (nErr) {
          result.inappError = nErr.message;
        } else {
          if (!test) {
            const { error: logErr } = await service.from("gig_alerts_sent").insert(targets.map((u) => ({ gig_id: gig.id, user_id: u.id, channel: "inapp" })));
            if (logErr) result.inappError = `Sent, but failed to log: ${logErr.message}`;
          }
          result.inappSent = targets.length;
        }
      }
    }

    // --- Email (batched, respects Resend daily cap) — highest-intent first ---
    if (channel === "email" || channel === "both") {
      // "engaged" mode reaches everyone; interest/related restrict to that bucket.
      const inMode = (u: Audience) => audienceMode === "engaged" || u.match === audienceMode;
      const pending = audience
        .filter((u) => u.id !== posterUserId && u.email && !sent.email.has(u.id) && inMode(u))
        .sort((a, b) => a.rank - b.rank);
      const batch = pending.slice(0, Math.max(0, Number(emailLimit) || 0));
      result.emailRemaining = pending.length - batch.length;

      const { sendEmail } = await import("@/lib/email");
      for (const u of batch) {
        try {
          const r = await sendEmail("new_gig_alert", {
            to: u.email!,
            recipientName: u.name,
            gigTitle: gig.title,
            gigId: gig.id,
            amount: gig.price,
            extra: { category: gig.category, company: gig.company, profileIncomplete: u.profile_complete ? "0" : "1", match: u.match },
          });
          if (r.ok) {
            result.emailSent++;
            if (!test) await service.from("gig_alerts_sent").insert({ gig_id: gig.id, user_id: u.id, channel: "email" });
          } else {
            result.emailFailed++;
            result.emailError = r.skipped || "Email provider rejected the send";
          }
        } catch (e: any) {
          result.emailFailed++;
          result.emailError = e?.message || "Email send threw an error";
        }
        await new Promise((res) => setTimeout(res, 120)); // gentle pacing
      }
    }

    return NextResponse.json({ success: true, test, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

async function loadGig(service: any, gigId: string) {
  const { data: gig } = await service
    .from("gigs")
    .select("id, title, price, category, company_id, poster_id")
    .eq("id", gigId)
    .maybeSingle();
  if (!gig) return null;
  let company: string | null = null;
  if (gig.company_id) {
    const { data: c } = await service.from("companies").select("name").eq("id", gig.company_id).maybeSingle();
    company = c?.name ?? null;
  }
  return { ...gig, company };
}

async function resolveTargets(
  service: any,
  gig: { category: string | null; company_id: string | null; poster_id?: string | null },
  extraCategories: string[] = []
): Promise<{ audience: Audience[]; posterUserId: string | null }> {
  const { data, error } = await service.rpc("gig_alert_audience", {
    p_category: gig.category,
    p_extra_categories: extraCategories,
  });
  if (error) throw new Error(error.message);
  const audience: Audience[] = ((data as AudienceRow[]) || []).map((u) => ({ ...u, match: matchFor(u), rank: rankFor(u) }));

  // Don't alert the poster (company account or student poster).
  let posterUserId: string | null = gig.poster_id ?? null;
  if (gig.company_id) {
    const { data: c } = await service.from("companies").select("user_id").eq("id", gig.company_id).maybeSingle();
    posterUserId = c?.user_id ?? posterUserId;
  }
  return { audience, posterUserId };
}

async function alreadySent(service: any, gigId: string) {
  const { data } = await service.from("gig_alerts_sent").select("user_id, channel").eq("gig_id", gigId);
  const inapp = new Set<string>();
  const email = new Set<string>();
  for (const r of (data as { user_id: string; channel: string }[]) || []) {
    if (r.channel === "inapp") inapp.add(r.user_id);
    else if (r.channel === "email") email.add(r.user_id);
  }
  return { inapp, email };
}

async function requireAdmin(): Promise<{ service: any; adminEmail: string } | { error: NextResponse }> {
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
  return { service, adminEmail: user.email || "" };
}
