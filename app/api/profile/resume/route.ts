// Authorized access to a student's resume.
//
// Resumes used to live in a PUBLIC bucket with their permanent URL stored in
// users.resume_url and rendered straight into an <a href>. Anyone who ever saw
// one — a shared link, a referrer header, a browser history sync — kept read
// access forever, and 671 students had one uploaded.
//
// The bucket is private now and users.resume_url holds the object PATH. This
// route is the only way back out: it checks the caller has a reason to see the
// file, mints a short-lived signed URL, and redirects to it. Nothing durable
// ever reaches the browser.
//
// Who may read a resume:
//   - the student themselves
//   - an admin
//   - a poster, but only for a worker who actually applied to one of their gigs
//
// That last rule is the point: a resume is visible because of an application,
// not because someone knows a user id.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import { isAdminEmail } from "@/lib/admins";

const BUCKET = "resumes";
const SIGNED_URL_TTL_SECONDS = 300; // long enough to open, short enough to be useless if copied

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // Authenticate before validating input, so a prober learns nothing about the
  // shape of the request.
  const authed = await supabaseServer();
  const { data: userData } = await authed.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  // No userId means "my own resume" — the student reviewing what they uploaded.
  const workerId = searchParams.get("userId") || user.id;

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: worker } = await admin
    .from("users")
    .select("resume_url")
    .eq("id", workerId)
    .single();

  if (!worker?.resume_url) {
    return NextResponse.json({ error: "No resume on file." }, { status: 404 });
  }

  const isSelf = user.id === workerId;
  const isAdmin = isAdminEmail(user.email);

  if (!isSelf && !isAdmin) {
    // Does this caller own a gig this worker applied to?
    const { count, error: appErr } = await admin
      .from("applications")
      .select("id, gigs!inner(poster_id)", { count: "exact", head: true })
      .eq("worker_id", workerId)
      .eq("gigs.poster_id", user.id);

    if (appErr) {
      console.error("resume access check failed:", appErr);
      return NextResponse.json({ error: "Could not verify access." }, { status: 500 });
    }
    if (!count) {
      return NextResponse.json(
        { error: "You can only view resumes of people who applied to your listings." },
        { status: 403 }
      );
    }
  }

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(worker.resume_url, SIGNED_URL_TTL_SECONDS);

  if (signErr || !signed?.signedUrl) {
    console.error("resume sign failed:", signErr);
    return NextResponse.json({ error: "Could not open that resume." }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
