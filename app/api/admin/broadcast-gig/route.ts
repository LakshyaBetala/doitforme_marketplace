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

type AudienceRow = { id: string; email: string | null; name: string | null; profile_complete: boolean; has_interest: boolean };
type Audience = AudienceRow & { tier: 1 | 2 | 3 };

// Priority tier: interest-match first, then completed profiles, then the rest.
function tierFor(u: AudienceRow): 1 | 2 | 3 {
  if (u.has_interest) return 1;
  if (u.profile_complete) return 2;
  return 3;
}

// GET ?gigId=... — preview counts without sending anything.
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if ("error" in admin) return admin.error;
    const service = admin.service;

    const gigId = new URL(req.url).searchParams.get("gigId");
    if (!gigId) return NextResponse.json({ error: "gigId required" }, { status: 400 });

    const gig = await loadGig(service, gigId);
    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    const { audience } = await resolveTargets(service, gig);
    const sent = await alreadySent(service, gigId);
    const emailPending = audience.filter((u) => !sent.email.has(u.id) && u.email);

    return NextResponse.json({
      gig: { id: gig.id, title: gig.title, price: gig.price, category: gig.category, company: gig.company },
      audienceTotal: audience.length,
      tiers: {
        interest: audience.filter((u) => u.tier === 1).length,
        completeProfile: audience.filter((u) => u.tier === 2).length,
        engaged: audience.filter((u) => u.tier === 3).length,
      },
      inapp: { sent: sent.inapp.size, remaining: audience.filter((u) => !sent.inapp.has(u.id)).length },
      email: {
        sent: sent.email.size,
        remaining: emailPending.length,
        // Default per-gig email target: only the interest-matched (tier 1).
        tier1Remaining: emailPending.filter((u) => u.tier === 1).length,
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

    // emailTier caps which tiers receive email. Default 1 = interest-matched only
    // (most personalized, smallest volume — stays well under the Resend free cap).
    // Pass 3 to deliberately reach all engaged students in batches.
    const { gigId, channel = "both", test = false, emailLimit = EMAIL_BATCH_DEFAULT, emailTier = 1 } = await req.json();
    if (!gigId) return NextResponse.json({ error: "gigId required" }, { status: 400 });
    if (!["inapp", "email", "both"].includes(channel)) {
      return NextResponse.json({ error: "channel must be inapp | email | both" }, { status: 400 });
    }
    const maxTier = Math.min(3, Math.max(1, Number(emailTier) || 1)) as 1 | 2 | 3;

    const gig = await loadGig(service, gigId);
    if (!gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

    let { audience, posterUserId } = await resolveTargets(service, gig);

    // Test mode: only the acting admin receives it (never logged, so a real run still reaches everyone).
    if (test) {
      audience = audience.filter((u) => u.email === adminEmail);
      if (audience.length === 0) {
        const { data: me } = await service.from("users").select("id, email, name").eq("email", adminEmail).maybeSingle();
        if (me) audience = [{ id: me.id, email: me.email, name: me.name, profile_complete: true, has_interest: true, tier: 1 }];
      }
    }

    const sent = test ? { inapp: new Set<string>(), email: new Set<string>() } : await alreadySent(service, gigId);
    const link = `/gig/${gig.id}`;
    const result = { inappSent: 0, emailSent: 0, emailFailed: 0, emailRemaining: 0 };

    // --- In-app bell (free, no cap) ---
    if (channel === "inapp" || channel === "both") {
      const targets = audience.filter((u) => u.id !== posterUserId && !sent.inapp.has(u.id));
      if (targets.length) {
        const content = `New paid gig: "${gig.title}"${gig.price ? ` — ₹${gig.price}` : ""}${gig.category ? ` (${gig.category})` : ""}`;
        const notifications = targets.map((u) => ({ user_id: u.id, type: "gig", content, link, is_read: false }));
        const { error: nErr } = await service.from("notifications").insert(notifications);
        if (!nErr && !test) {
          await service.from("gig_alerts_sent").insert(targets.map((u) => ({ gig_id: gig.id, user_id: u.id, channel: "inapp" })));
        }
        if (!nErr) result.inappSent = targets.length;
      }
    }

    // --- Email (batched, respects Resend daily cap) — highest-intent tier first ---
    if (channel === "email" || channel === "both") {
      const pending = audience
        .filter((u) => u.id !== posterUserId && u.email && !sent.email.has(u.id) && u.tier <= maxTier)
        .sort((a, b) => a.tier - b.tier);
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
            extra: { category: gig.category, company: gig.company, profileIncomplete: u.profile_complete ? "0" : "1", tier: u.tier },
          });
          if (r.ok) {
            result.emailSent++;
            if (!test) await service.from("gig_alerts_sent").insert({ gig_id: gig.id, user_id: u.id, channel: "email" });
          } else {
            result.emailFailed++;
          }
        } catch {
          result.emailFailed++;
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
  gig: { category: string | null; company_id: string | null; poster_id?: string | null }
): Promise<{ audience: Audience[]; posterUserId: string | null }> {
  const { data, error } = await service.rpc("gig_alert_audience", { p_category: gig.category });
  if (error) throw new Error(error.message);
  const audience: Audience[] = ((data as AudienceRow[]) || []).map((u) => ({ ...u, tier: tierFor(u) }));

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
