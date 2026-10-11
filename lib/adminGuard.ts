import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { isAdminEmail } from "./admins";

/**
 * Authenticate an admin, then hand back a service-role client.
 *
 * This block was copy-pasted into every admin route, which is the same shape of
 * problem the hardcoded ADMINS array had: one place forgotten means an endpoint
 * that answers a non-admin. New admin routes use this; the existing ones keep
 * their inline copies for now, because rewriting eight working money-handling
 * handlers to share a helper is a separate change from adding features.
 *
 * ORDER IS LOAD-BEARING. Identity is checked before the body is read, so an
 * anonymous prober gets 401 rather than a 400 that names the fields it should
 * have sent. A service-role client is only constructed AFTER the check passes —
 * building it first and guarding afterwards means one early return away from a
 * handler that bypasses RLS for anybody.
 */
export type AdminContext = {
  service: SupabaseClient;
  email: string;
  /**
   * The admin's own users.id, for the `created_by` / `reviewer_id` columns.
   *
   * Nullable because an admin whitelisted by email may legitimately have no row
   * in public.users yet, and an audit column is not worth failing a decision
   * over. Routes store null rather than inventing an id.
   */
  userId: string | null;
};

export async function requireAdmin(): Promise<AdminContext | { error: NextResponse }> {
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
    },
  );

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
    { auth: { persistSession: false } },
  );

  // auth.users.id and public.users.id are the same id in this schema, so the
  // JWT subject is the audit id. Read nothing extra for it.
  return { service, email: user.email!, userId: user.id ?? null };
}

export function isGuardError(v: unknown): v is { error: NextResponse } {
  return Boolean(v) && typeof v === "object" && v !== null && "error" in v;
}
