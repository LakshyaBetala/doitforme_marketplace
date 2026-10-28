// GET /api/admin/inner-circle-round1/export-invites
//
// Downloadable CSV of every candidate's invite URL and switch-cohort URL,
// for operators who want to mail-merge from Gmail / their own mail client
// rather than letting lib/email.ts handle sending. The portal flow works
// identically whether the invite reached the candidate via ZeptoMail or via
// a hand-sent Gmail message — the token in the URL is what matters.
//
// The CSV columns are shaped for direct paste into Gmail's merge tool, Zoho
// Mail's mail-merge, or a Google Sheets + Apps Script sender.
//
// Query:
//   cohort      default = CURRENT_COHORT
//   status      optional comma list; defaults to "invited" (not yet started)
//
// Returns text/csv with Content-Disposition attachment so browsers download.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isAdminEmail } from "@/lib/admins";
import {
  CURRENT_COHORT,
  Round1Row,
  missingBindings,
  round1Env,
} from "@/lib/innerCircleRound1";

export const dynamic = "force-dynamic";

const SITE = "https://doitforme.in";

const VALID_STATUS = new Set([
  "invited",
  "started",
  "submitted",
  "expired",
  "advanced",
  "rejected",
  "switched_to_tech",
]);

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  // Wrap in quotes if the value contains a comma, quote, newline, or starts
  // with a formula-trigger char. Formula injection is the specific risk a
  // bare CSV open in Excel would allow.
  const needsQuote = /[,"\n\r]/.test(s) || /^[=+\-@]/.test(s);
  if (!needsQuote) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const cohort = url.searchParams.get("cohort") || CURRENT_COHORT;
  const requestedStatus = (url.searchParams.get("status") || "invited")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => VALID_STATUS.has(s));
  const statusList = requestedStatus.length ? requestedStatus : ["invited"];

  const { env } = getCloudflareContext();
  const e = round1Env(env);
  const missing = missingBindings(e);
  if (missing.length) {
    return NextResponse.json({ error: `Missing bindings: ${missing.join(", ")}` }, { status: 503 });
  }
  const db = e.WAITLIST!;

  const placeholders = statusList.map((_, i) => `?${i + 2}`).join(",");
  const rows = await db
    .prepare(
      `SELECT * FROM inner_circle_round1
       WHERE cohort = ?1 AND status IN (${placeholders})
       ORDER BY invited_at ASC`
    )
    .bind(cohort, ...statusList)
    .all<Round1Row>();

  const header = [
    "email",
    "name",
    "phone",
    "college",
    "status",
    "invite_url",
    "switch_to_tech_url",
    "invited_at_iso",
  ].join(",");

  const body = (rows.results || [])
    .map((r) => {
      const inviteUrl = `${SITE}/inner-circle/sales/round-1/${encodeURIComponent(r.token)}`;
      const switchUrl = `${SITE}/inner-circle/sales/round-1/switch-to-tech/${encodeURIComponent(r.token)}`;
      return [
        csvEscape(r.email),
        csvEscape(r.name),
        csvEscape(r.phone),
        csvEscape(r.college),
        csvEscape(r.status),
        csvEscape(inviteUrl),
        csvEscape(switchUrl),
        csvEscape(new Date(r.invited_at * 1000).toISOString()),
      ].join(",");
    })
    .join("\n");

  const csv = header + "\n" + body + (body ? "\n" : "");
  const filename = `round1-${cohort}-${statusList.join("+")}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
