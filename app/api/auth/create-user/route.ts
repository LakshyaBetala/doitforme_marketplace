import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { normalizeIndianPhone } from "@/lib/phone";
import { isValidSource } from "@/lib/attribution";
import { checkUpi } from "@/lib/upi";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      email, name, phone, college, upi_id, username,
      signup_source, signup_source_detail, referrer, landing,
    } = body;

    // Username format validation — same rules as /api/auth/check-username
    const USERNAME_FORMAT = /^[a-z][a-z0-9_]{2,19}$/;
    const RESERVED_USERNAMES = new Set([
      "admin", "administrator", "root", "support", "help", "doitforme",
      "doitfor", "marketforme", "team", "official", "moderator", "mod",
      "system", "api", "auth", "login", "logout", "signup", "signin",
      "settings", "profile", "u", "user", "users", "company", "companies",
      "gig", "gigs", "feed", "dashboard", "messages", "chat", "post",
      "explore", "search", "about", "contact", "terms", "privacy",
      "pricing", "verify", "onboarding", "payouts", "activity",
      "anthropic", "claude", "openai", "null", "undefined",
    ]);
    let cleanedUsername: string | null = null;
    if (username) {
      const u = String(username).trim().toLowerCase();
      if (!USERNAME_FORMAT.test(u)) {
        return NextResponse.json(
          { error: "Invalid username. 3–20 chars, lowercase letters/numbers/underscore, must start with a letter." },
          { status: 400 }
        );
      }
      if (RESERVED_USERNAMES.has(u)) {
        return NextResponse.json({ error: "That username is reserved." }, { status: 400 });
      }
      cleanedUsername = u;
    }

    // SECURITY: Authenticate caller via cookie — use session user ID, never trust body
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = user.id; // Server-verified user ID

    if (!email) {
      return NextResponse.json({ error: "Missing Email" }, { status: 400 });
    }

    // Validate UPI ID Format
    let normalizedUpi: string | null = null;
    if (upi_id) {
      // Server-side gate. lib/upi.ts is the single source of truth; the old
      // inline regex allowed a 256-char local part and "..@a" style garbage.
      const upiCheck = checkUpi(upi_id);
      if (!upiCheck.valid) {
        return NextResponse.json({ error: upiCheck.error || "Invalid UPI ID." }, { status: 400 });
      }
      // Persist the NORMALISED form so the same destination can never be stored
      // as two different strings (case, stray zero-width characters).
      normalizedUpi = upiCheck.normalized;
    }

    // Admin Client (Bypasses RLS for user upsert operations)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch existing user data
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    // Smart data: keep old, overwrite only if new data sent
    const finalName = name || existingUser?.name || email.split("@")[0];
    // Always store the canonical 10-digit form (strip +91 / stray country-code
    // digits) so WhatsApp deep links build correctly later.
    const finalPhone = phone ? (normalizeIndianPhone(phone) || phone) : (existingUser?.phone || null);
    const finalCollege = college || existingUser?.college || null;
    const finalUpi = normalizedUpi || existingUser?.upi_id || null;
    const finalKyc = existingUser?.kyc_verified || false;
    // Once a username is claimed it's permanent for this iteration — no overwrite of an existing one.
    const finalUsername = existingUser?.username || cleanedUsername || null;

    // Attribution is WRITE-ONCE. Profile edits re-POST here, so without this the
    // original source would be clobbered (or nulled) every time someone updates
    // their phone number, and the cohort numbers would silently rot.
    const clip = (v: unknown, n: number) =>
      typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;
    const finalSource = existingUser?.signup_source ?? (isValidSource(signup_source) ? signup_source : null);
    const finalSourceDetail = existingUser?.signup_source_detail ?? clip(signup_source_detail, 120);
    const finalReferrer = existingUser?.signup_referrer ?? clip(referrer, 300);
    const finalLanding = existingUser?.signup_landing ?? clip(landing, 300);

    // If a NEW username was requested but the user already has one, ignore silently.
    // If a NEW username was requested AND it conflicts with another user, fail loud.
    if (cleanedUsername && !existingUser?.username) {
      const { data: conflict } = await supabase
        .from("users")
        .select("id")
        .eq("username", cleanedUsername)
        .maybeSingle();
      if (conflict && conflict.id !== id) {
        return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
      }
    }

    // Upsert user (with verified ID from session)
    const core = {
      id: id,
      email: email,
      name: finalName,
      phone: finalPhone,
      college: finalCollege,
      upi_id: finalUpi,
      username: finalUsername,
      kyc_verified: finalKyc,
      updated_at: new Date().toISOString(),
    };

    let { error: userError } = await supabase
      .from("users")
      .upsert({
        ...core,
        signup_source: finalSource,
        signup_source_detail: finalSourceDetail,
        signup_referrer: finalReferrer,
        signup_landing: finalLanding,
      })
      .select()
      .single();

    // The attribution columns arrive in 20260812_growth_instrumentation.sql. If
    // the deploy lands before the migration does, retry without them rather than
    // hard-failing: losing a signup costs far more than losing its attribution.
    if (userError && (userError.code === "PGRST204" || userError.code === "42703")) {
      console.warn("create-user: attribution columns missing, run 20260812_growth_instrumentation.sql");
      ({ error: userError } = await supabase.from("users").upsert(core).select().single());
    }

    if (userError) {
      console.error("API: User Upsert Error:", userError);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    // Auto-generate referral code if missing
    if (!existingUser?.referral_code) {
      const { data: codeData } = await supabase.rpc("generate_referral_code");
      if (codeData) {
        await supabase
          .from("users")
          .update({ referral_code: codeData })
          .eq("id", id);
      }
    }

    // Ensure wallet exists
    const { error: walletError } = await supabase
      .from("wallets")
      .upsert(
        { user_id: id, balance: 0, frozen: 0 },
        { onConflict: "user_id", ignoreDuplicates: true }
      );

    if (walletError) console.error("API: Wallet Upsert Error:", walletError);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("API: Critical Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}