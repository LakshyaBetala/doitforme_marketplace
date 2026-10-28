import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  DOC_BUCKETS,
  ERASE_COLUMNS,
  IN_FLIGHT_CHECKS,
  type InFlightCounts,
  inFlightMessage,
  summarizeInFlight,
} from "@/lib/accountErasure";

/**
 * Self-serve account deletion.
 *
 * Required by App Store guideline 5.1.1(v): an app that lets someone create an
 * account must let them delete it from inside the app. Until now the only route
 * was emailing support so an operator could run scripts/delete-account.mjs,
 * which is exactly what that guideline rejects.
 *
 * The rules live in lib/accountErasure.ts and are shared with that script, so
 * the two cannot disagree about what deletion means.
 *
 * Authorization: the caller can only ever erase THEMSELVES. There is no userId
 * in the request body and nothing reads one — the id comes from the session.
 * The service-role client below bypasses RLS and can delete any auth identity,
 * so the check has to be here, in the route. That is the documented trap: a
 * `security definer` function's own `auth.uid()` guard evaluates to NULL under
 * the service role and silently passes.
 */

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  // Authenticate BEFORE validating the body. Answering an anonymous caller with
  // a 400 that names the confirmation phrase tells a prober the endpoint exists
  // and exactly what to send; pinned by tests/unit/route-surface.test.mjs.
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let confirm: unknown = null;
  try {
    ({ confirm } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Typed confirmation, not a checkbox. This is irreversible and it deletes the
  // auth identity, so an accidental tap must not be enough.
  if (typeof confirm !== "string" || confirm.trim().toUpperCase() !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm.", code: "CONFIRM_REQUIRED" },
      { status: 400 }
    );
  }

  // The rule is shared; the five counts are run here with the client this route
  // already holds. See the note on IN_FLIGHT_CHECKS for why it is not a
  // function taking the client.
  const counts: InFlightCounts = {};
  for (const check of IN_FLIGHT_CHECKS) {
    const { count } = await admin
      .from(check.table)
      .select("id", { count: "exact", head: true })
      .eq(check.userColumn, user.id)
      .eq(check.column, check.value);
    counts[check.key] = count ?? 0;
  }
  const flight = summarizeInFlight(counts);
  if (flight.blocked) {
    return NextResponse.json(
      { error: inFlightMessage(flight), code: "MONEY_IN_FLIGHT", detail: flight },
      { status: 409 }
    );
  }

  // Documents first. If a later step fails the account still exists, which is
  // recoverable; the reverse — an account gone with its ID card still in a
  // bucket — is not, and it is the part that actually matters for privacy.
  let documents = 0;
  for (const bucket of DOC_BUCKETS) {
    const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
    if (!files?.length) continue;
    const paths = files.map((f) => `${user.id}/${f.name}`);
    const { error: rmErr } = await admin.storage.from(bucket).remove(paths);
    if (rmErr) {
      // Do not continue to delete the auth identity while a document survives.
      console.error(`[account-delete] ${user.id} ${bucket}: ${rmErr.message}`);
      return NextResponse.json(
        { error: "Could not remove your uploaded documents. Nothing was deleted — please try again." },
        { status: 500 }
      );
    }
    documents += paths.length;
  }

  // A device identifier, so remove rather than blank — otherwise the phone keeps
  // receiving push for an account that no longer exists.
  await admin.from("push_subscriptions").delete().eq("user_id", user.id);
  await admin.from("notifications").delete().eq("user_id", user.id);

  const { error: updErr } = await admin.from("users").update(ERASE_COLUMNS).eq("id", user.id);
  if (updErr) {
    console.error(`[account-delete] ${user.id} profile: ${updErr.message}`);
    return NextResponse.json({ error: "Could not erase your profile. Nothing else was deleted." }, { status: 500 });
  }

  // Last, because without it they could still sign in to the emptied row.
  const { error: authErr } = await admin.auth.admin.deleteUser(user.id);
  if (authErr && !/not found/i.test(authErr.message)) {
    console.error(`[account-delete] ${user.id} auth: ${authErr.message}`);
    return NextResponse.json(
      {
        error:
          "Your personal data has been erased, but the sign-in itself could not be removed. Email doitforme.in@gmail.com and we will finish it.",
      },
      { status: 500 }
    );
  }

  console.log(`[account-delete] erased ${user.id}, ${documents} document(s)`);
  return NextResponse.json({ success: true, documents });
}
