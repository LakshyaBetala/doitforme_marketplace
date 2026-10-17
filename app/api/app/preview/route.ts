import { NextResponse, type NextRequest } from "next/server";
import { createServer } from "@/lib/supabaseServer";
import { isAdminEmail } from "@/lib/admins";
import { PREVIEW_COOKIE, isPreviewable } from "@/lib/appIdentity.server";

/**
 * Set or clear the admin's app-surface preview.
 *
 * GET rather than POST because this is a navigation — a link in the Me screen
 * that lands you on the previewed surface. It changes nothing but a cookie
 * scoped to this browser, and the cookie only ever narrows what is rendered,
 * so there is no state a CSRF could damage: the worst a forged link achieves is
 * showing an admin the builder tabs, which is a link they already have.
 *
 * AUTHENTICATES BEFORE READING THE QUERY. An anonymous caller gets 401, never a
 * 400 about a bad role — a validation error tells a prober the endpoint exists
 * and what shape it wants.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (!isAdminEmail(user.email)) {
    // Not 403-with-detail: a non-admin has no business knowing this exists.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const wanted = req.nextUrl.searchParams.get("as");
  const res = NextResponse.redirect(new URL("/app", req.nextUrl.origin));

  if (wanted === null || wanted === "" || wanted === "self") {
    res.cookies.delete(PREVIEW_COOKIE);
    return res;
  }
  if (!isPreviewable(wanted)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }

  res.cookies.set(PREVIEW_COOKIE, wanted, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    // Session-length on purpose. A preview is something you are doing right
    // now, not a setting; it should not still be on next week when a real
    // figure looks wrong and the reason is a cookie nobody remembers.
    maxAge: 60 * 60 * 8,
  });
  return res;
}
