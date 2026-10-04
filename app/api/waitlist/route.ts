import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

/**
 * Capture a signup while Supabase is restricted.
 *
 * Supabase Auth and REST both answer 402 (exceed_storage_size_quota), so
 * /api/auth/create-user and signUp() are both dead. Anyone who arrives this
 * week would simply bounce — and this is a platform that gets ~100 signups a
 * day, so a week of that is most of a month's growth thrown away.
 *
 * These rows land in Cloudflare D1 instead: free, bound natively to this
 * Worker, and nothing to do with Supabase, so it keeps working no matter what
 * the quota does.
 *
 * Deliberately NO password is collected. Taking credentials into a side store
 * and replaying them later means either holding them in plaintext or hashing
 * them differently from Supabase Auth — both bad, and neither reversible. These
 * people get emailed an invite to finish signup properly when service returns,
 * which has the side benefit of proving the address works.
 */
/**
 * Just the slice of D1 this route uses.
 *
 * @cloudflare/workers-types is installed but deliberately not added to
 * tsconfig "types": it declares globals that collide with the DOM lib the rest
 * of this Next app compiles against. A structural type costs four lines and
 * keeps the collision out of every other file.
 */
interface D1Database {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
    first<T>(): Promise<T | null>;
  };
}

type Body = {
  email?: string;
  name?: string;
  phone?: string;
  college?: string;
  intent?: string;
  lookingFor?: string;
  referralCode?: string;
};

const clean = (v: unknown, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) || null : null;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = clean(body.email, 320)?.toLowerCase();
  // Deliberately loose. A bounced invite costs nothing; refusing a real student
  // over a regex during an outage costs a user.
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const intent = body.intent === "company" ? "company" : "student";

  try {
    const { env } = getCloudflareContext();
    const db = (env as { WAITLIST?: D1Database }).WAITLIST;
    if (!db) {
      console.error("[waitlist] D1 binding missing");
      return NextResponse.json({ error: "Could not save that. Please try again." }, { status: 503 });
    }

    // Upsert: someone refreshing or correcting a typo should update their row,
    // not be rejected or duplicated. invited_at is left alone so a replay that
    // already went out is never repeated.
    await db
      .prepare(
        `INSERT INTO waitlist (email, name, phone, college, intent, looking_for, referral_code, source, user_agent)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(lower(email)) DO UPDATE SET
           name = coalesce(excluded.name, waitlist.name),
           phone = coalesce(excluded.phone, waitlist.phone),
           college = coalesce(excluded.college, waitlist.college),
           intent = excluded.intent,
           looking_for = coalesce(excluded.looking_for, waitlist.looking_for),
           referral_code = coalesce(excluded.referral_code, waitlist.referral_code)`
      )
      .bind(
        email,
        clean(body.name, 120),
        clean(body.phone, 20),
        clean(body.college, 160),
        intent,
        clean(body.lookingFor, 500),
        clean(body.referralCode, 40),
        "maintenance_page",
        (req.headers.get("user-agent") || "").slice(0, 200)
      )
      .run();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[waitlist] write failed:", e);
    return NextResponse.json({ error: "Could not save that. Please try again." }, { status: 500 });
  }
}

/** Count only — so the page can show real numbers without exposing anybody. */
export async function GET() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as { WAITLIST?: D1Database }).WAITLIST;
    if (!db) return NextResponse.json({ count: 0 });
    const row = await db.prepare("SELECT count(*) AS n FROM waitlist").first<{ n: number }>();
    return NextResponse.json({ count: row?.n ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
