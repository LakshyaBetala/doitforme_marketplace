import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/auth/check-username?u=<username>
 *
 * Returns { available: boolean, reason?: string }.
 *
 * Public — used during onboarding while user is still authenticating.
 * Uses the service role to bypass RLS, but only reads a single column
 * by exact match. Safe.
 */

const RESERVED = new Set([
  "admin", "administrator", "root", "support", "help", "doitforme",
  "doitfor", "marketforme", "team", "official", "moderator", "mod",
  "system", "api", "auth", "login", "logout", "signup", "signin",
  "settings", "profile", "u", "user", "users", "company", "companies",
  "gig", "gigs", "feed", "dashboard", "messages", "chat", "post",
  "post-a-gig", "explore", "search", "about", "contact", "terms",
  "privacy", "privacy-policy", "refund", "refund-policy", "pricing",
  "verify", "verify-id", "onboarding", "auth-transfer", "payouts",
  "activity", "company-dashboard", "anthropic", "claude", "openai",
  "betala911", "null", "undefined", "owner", "ceo", "cto",
]);

const FORMAT = /^[a-z][a-z0-9_]{2,19}$/;

export async function GET(req: NextRequest) {
  const u = (req.nextUrl.searchParams.get("u") || "").trim().toLowerCase();

  if (!u) return NextResponse.json({ available: false, reason: "Required" });
  if (!FORMAT.test(u)) {
    return NextResponse.json({
      available: false,
      reason: "3–20 chars, lowercase letters/numbers/underscore, must start with a letter",
    });
  }
  if (RESERVED.has(u)) {
    return NextResponse.json({ available: false, reason: "Reserved" });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("username", u)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ available: false, reason: "Lookup failed" }, { status: 500 });
  }

  return NextResponse.json({
    available: !data,
    reason: data ? "Taken" : undefined,
  });
}
