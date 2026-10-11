import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { TERMS_VERSION, clausesFor, TERMS_PROMISES } from "@/lib/programTerms";

/**
 * Accepting the program terms.
 *
 * WHY THIS IS A ROUTE AND NOT A BROWSER WRITE. The outreach CRM writes straight
 * through RLS, and the comment there explains why: there is no authorization a
 * route could add that the policies do not already enforce. This is the
 * opposite case. An acceptance is evidence, and two of the three columns that
 * make it evidence — the IP and the user agent — cannot be collected in the
 * browser without trusting the browser to report them honestly. A client-side
 * insert would produce a record that proves only that somebody POSTed a row.
 *
 * The version is also taken from the server's own copy of the terms and never
 * from the request body. Otherwise a caller could accept version "1999.1" and
 * satisfy the current-version check for ever.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function callerFrom() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const ROLES = new Set(["TECH", "OUTREACH"]);

/** The current terms, plus whether the caller has already accepted them. */
export async function GET(req: Request) {
  const user = await callerFrom();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (new URL(req.url).searchParams.get("role") || "TECH").toUpperCase();
  if (!ROLES.has(role)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("program_term_acceptances")
    .select("version, role, accepted_at")
    .eq("user_id", user.id)
    .eq("role", role)
    .order("accepted_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[program/terms] read failed:", error.message);
    return NextResponse.json({ error: "Could not load your terms" }, { status: 500 });
  }

  const accepted = data?.[0] ?? null;

  return NextResponse.json({
    version: TERMS_VERSION,
    role,
    promises: TERMS_PROMISES,
    clauses: clausesFor(role as "TECH" | "OUTREACH"),
    accepted,
    current: accepted?.version === TERMS_VERSION,
  });
}

export async function POST(req: Request) {
  try {
    // Authenticate BEFORE reading or validating the body. Answering an
    // anonymous caller with a 400 naming the missing field confirms the
    // endpoint exists and tells a prober what to send next; a 401 tells them
    // only that they are not signed in.
    const user = await callerFrom();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: { role?: unknown; agree?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
    }

    const role = String(body.role ?? "").toUpperCase();
    if (!ROLES.has(role)) {
      return NextResponse.json({ error: "Pick a role to accept the terms for" }, { status: 400 });
    }
    // An explicit affirmative, so a stray POST cannot sign anybody up to
    // anything. The checkbox on the page is what sets this.
    if (body.agree !== true) {
      return NextResponse.json({ error: "You need to tick the box to accept" }, { status: 400 });
    }

    const h = await headers();
    // Cloudflare sets cf-connecting-ip; x-forwarded-for is the generic
    // fallback and its first entry is the client. Both are claims made by a
    // proxy rather than facts, which is why a null IP is allowed to stand.
    const ip =
      h.get("cf-connecting-ip") ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;

    const { error } = await admin.from("program_term_acceptances").upsert(
      {
        user_id: user.id,
        // From the server's own copy, never the request body.
        version: TERMS_VERSION,
        role,
        ip,
        user_agent: h.get("user-agent")?.slice(0, 400) ?? null,
      },
      { onConflict: "user_id,role,version", ignoreDuplicates: true },
    );

    // Checked, because a write that matters and is not checked is how gigs got
    // marked ESCROW_FUNDED with no escrow row behind them.
    if (error) {
      console.error("[program/terms] accept failed:", error.message);
      return NextResponse.json({ error: "Could not record that. Try again." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, version: TERMS_VERSION, role });
  } catch (err) {
    console.error("[program/terms] unexpected:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
