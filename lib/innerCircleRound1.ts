// Shared primitives for the Inner Circle · Sales · Round 1 flow.
//
// Candidates on this flow are NOT signed-up users: no auth.uid(), no Supabase
// session. They are the ~607 hold-page waitlist rows that ticked "Put me
// forward for the Inner Circle". So authentication is bespoke:
//
//   1. The invite URL carries a 32-byte random token that identifies them.
//   2. On first visit they set a DOB; we store sha256(dob || token || pepper).
//   3. For return visits (bookmarks, lost tabs) they can log in with
//      email + DOB — the DOB is checked by re-hashing against the stored row.
//   4. Both paths mint the same signed session cookie (HMAC-SHA256) which
//      authenticates subsequent API calls for ~24h.
//
// Why no bcrypt: DOB has ~7,000 realistic values (365 × ~20 years). Any work-
// factor on the hash function brute-forces in milliseconds against a dump that
// also carries the pepper. The pepper being a Worker secret is the real
// defence, so SHA-256 with a per-row salt (the token) is both sufficient and
// cheaper on the Worker budget than importing bcrypt.
//
// See supabase/d1/inner_circle_round1.sql for the matching table and
// docs/inner-circle-round1.md for the full plan.

// ────────────────────────────────────────────────────────────────────────────
// D1 shape — matches wrangler.jsonc's WAITLIST binding. @cloudflare/workers-
// types is installed but deliberately excluded from tsconfig "types" because
// it collides with the DOM lib the rest of the app compiles against; a
// structural type costs a few lines and avoids the collision.
// ────────────────────────────────────────────────────────────────────────────

export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  run(): Promise<unknown>;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface D1Database {
  prepare(query: string): D1Prepared;
  batch(stmts: D1Prepared[]): Promise<unknown>;
}

// Lifecycle statuses a candidate row can be in. Reused by Round1Row.status
// and anywhere else (admin filters, waitlist-pool annotations) that needs
// the same union. Keep this in sync with the CHECK constraint in
// supabase/d1/inner_circle_round1.sql — same seven values, same spellings.
export type Round1Status =
  | "invited"
  | "started"
  | "submitted"
  | "expired"
  | "advanced"
  | "rejected"
  | "switched_to_tech";

export interface Round1Row {
  id: number;
  cohort: string;
  email: string;
  name: string | null;
  phone: string | null;
  college: string | null;
  token: string;
  dob_hash: string | null;
  invited_at: number;
  started_at: number | null;
  deadline_at: number | null;
  campaign_closes_at: number;
  status: Round1Status;
  submission_url: string | null;
  submitted_at: number | null;
  next_reminder_at: number | null;
  reminders_sent: string;
  score: number | null;
  admin_note: string | null;
  decided_at: number | null;
  decided_by: string | null;
  login_fail_count: number;
  login_fail_window_start: number | null;
  created_at: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

export const CURRENT_COHORT = "sales-2026-10";
export const TASK_WINDOW_SECONDS = 24 * 3600;
export const CAMPAIGN_SECONDS = 7 * 24 * 3600;

export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_MAX_FAILS = 5;

export const SESSION_SECONDS = 24 * 3600;
export const SESSION_COOKIE = "round1_session";

/** Reminder cadence relative to the deadline. Order matters — earliest first. */
export const REMINDER_BUCKETS = [
  { key: "12h", before: 12 * 3600 },
  { key: "6h", before: 6 * 3600 },
  { key: "3h", before: 3 * 3600 },
  { key: "30m", before: 30 * 60 },
] as const;

export type ReminderKey = typeof REMINDER_BUCKETS[number]["key"];

// ────────────────────────────────────────────────────────────────────────────
// Event names — the shared vocabulary between the portal (which fires them)
// and the admin funnel (which reads them). Keep this list closed so a typo
// in a page can't silently create a new orphan event that nothing reports.
// ────────────────────────────────────────────────────────────────────────────

export const EVENT_NAMES = [
  // Entry page
  "invite_opened",          // the token URL rendered
  "brief_expanded",         // "I've read this" clicked
  "template_clicked_pre",   // template sheet link clicked on entry page
  "start_clicked",          // Start-24h button clicked (BEFORE claim resolves)
  "claim_success",          // DOB verified + timer started
  "claim_failed",           // claim returned non-2xx (e.g. wrong DOB on return)
  // Dashboard
  "dashboard_viewed",       // dashboard page rendered with started status
  "template_clicked_task",  // template sheet link clicked on dashboard
  "countdown_critical",     // <3h left seen for the first time
  "submit_attempted",       // Submit button clicked
  "submit_success",         // submission 200'd
  "submit_rejected",        // submission returned non-2xx (bad URL, expired)
  // Login
  "login_attempted",
  "login_success",
  "login_failed",
  // Switch-to-tech
  "switch_tech_viewed",
  "switch_tech_confirmed",
] as const;

export type EventName = typeof EVENT_NAMES[number];

export function isValidEventName(name: unknown): name is EventName {
  return typeof name === "string" && (EVENT_NAMES as readonly string[]).includes(name);
}

// ────────────────────────────────────────────────────────────────────────────
// Encoding helpers
// ────────────────────────────────────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const normal = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(normal);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 43-char URL-safe token backed by 32 random bytes (256 bits of entropy). */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64url(bytes);
}

// ────────────────────────────────────────────────────────────────────────────
// DOB hashing
// ────────────────────────────────────────────────────────────────────────────

/** Normalises YYYY-MM-DD / DD-MM-YYYY / DD/MM/YYYY to YYYY-MM-DD, or null. */
export function normaliseDob(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    const [, y, m, d] = iso;
    return isRealDate(+y, +m, +d) ? `${y}-${m}-${d}` : null;
  }
  const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return isRealDate(+y, +m, +d) ? `${y}-${m}-${d}` : null;
  }
  return null;
}

function isRealDate(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export async function hashDob(dob: string, token: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`${dob}.${token}.${pepper}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two equal-length hex strings. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Deadline math
// ────────────────────────────────────────────────────────────────────────────

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/** Deadline = started_at + 24h. */
export function computeDeadline(startedAt: number): number {
  return startedAt + TASK_WINDOW_SECONDS;
}

/** Campaign hard close = invited_at + 7d. New starts refused after this. */
export function computeCampaignClose(invitedAt: number): number {
  return invitedAt + CAMPAIGN_SECONDS;
}

export function parseRemindersSent(raw: string | null | undefined): ReminderKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is ReminderKey =>
      REMINDER_BUCKETS.some((b) => b.key === k)
    );
  } catch {
    return [];
  }
}

/**
 * The next reminder time strictly after `since` for a candidate whose task
 * ends at `deadline`. Null when all buckets are either already sent or in the
 * past (so the cron can clear next_reminder_at and stop scanning this row).
 */
export function nextReminderAt(
  deadline: number,
  sent: ReminderKey[],
  since: number
): number | null {
  for (const b of REMINDER_BUCKETS) {
    if (sent.includes(b.key)) continue;
    const at = deadline - b.before;
    if (at > since) return at;
  }
  return null;
}

/**
 * The reminder bucket that is DUE given current time, if any. Used by the
 * cron to decide what to actually send. Returns null when no bucket is due
 * (either already sent, not yet due, or deadline already passed).
 */
export function dueReminderBucket(
  deadline: number,
  now: number,
  sent: ReminderKey[]
): ReminderKey | null {
  for (const b of REMINDER_BUCKETS) {
    if (sent.includes(b.key)) continue;
    const at = deadline - b.before;
    // Due if we've crossed the trigger time and the deadline hasn't passed.
    // The expiry pass handles post-deadline rows separately.
    if (now >= at && now < deadline) return b.key;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Session cookie — HMAC-SHA256 signed, format: id.exp.sig (all base64url)
// ────────────────────────────────────────────────────────────────────────────

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(id: number, secret: string): Promise<string> {
  const exp = nowSeconds() + SESSION_SECONDS;
  const payload = `${id}.${exp}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(
  cookie: string | null | undefined,
  secret: string
): Promise<{ id: number; exp: number } | null> {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [idStr, expStr, sigB64] = parts;
  const id = Number(idStr);
  const exp = Number(expStr);
  if (!Number.isFinite(id) || !Number.isFinite(exp)) return null;
  if (exp < nowSeconds()) return null;
  try {
    const key = await hmacKey(secret);
    const sig = b64urlDecode(sigB64);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      sig as BufferSource,
      new TextEncoder().encode(`${id}.${exp}`)
    );
    return ok ? { id, exp } : null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Env access — gives route handlers a single typed point of entry
// ────────────────────────────────────────────────────────────────────────────

export interface Round1Env {
  WAITLIST?: D1Database;
  ROUND1_DOB_PEPPER?: string;
  ROUND1_SESSION_SECRET?: string;
  ROUND1_SALES_SHEET_TEMPLATE_URL?: string;
}

export function round1Env(env: unknown): Round1Env {
  return (env || {}) as Round1Env;
}

export function missingBindings(env: Round1Env): string[] {
  const missing: string[] = [];
  if (!env.WAITLIST) missing.push("WAITLIST");
  if (!env.ROUND1_DOB_PEPPER) missing.push("ROUND1_DOB_PEPPER");
  if (!env.ROUND1_SESSION_SECRET) missing.push("ROUND1_SESSION_SECRET");
  return missing;
}

// ────────────────────────────────────────────────────────────────────────────
// Public candidate view — what we send to the browser. No pepper, no hash, no
// login_fail columns — everything on this struct is safe for the dashboard.
// ────────────────────────────────────────────────────────────────────────────

export interface PublicCandidate {
  email: string;
  name: string | null;
  status: Round1Row["status"];
  invited_at: number;
  started_at: number | null;
  deadline_at: number | null;
  campaign_closes_at: number;
  submission_url: string | null;
  submitted_at: number | null;
  secondsLeft: number | null;
}

export function toPublicCandidate(row: Round1Row): PublicCandidate {
  const now = nowSeconds();
  const secondsLeft =
    row.deadline_at && row.status === "started"
      ? Math.max(0, row.deadline_at - now)
      : null;
  return {
    email: row.email,
    name: row.name,
    status: row.status,
    invited_at: row.invited_at,
    started_at: row.started_at,
    deadline_at: row.deadline_at,
    campaign_closes_at: row.campaign_closes_at,
    submission_url: row.submission_url,
    submitted_at: row.submitted_at,
    secondsLeft,
  };
}

/**
 * Only Google Sheets URLs are accepted as submissions. Admin reviews visually,
 * but we at least refuse links that aren't a sheet at all.
 */
export function isValidSubmissionUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (host !== "docs.google.com" && !host.endsWith(".docs.google.com")) return false;
    // Docs, Forms and Slides live on the same host, so the host alone recorded
    // a Google Doc as a finished Round 1. And /spreadsheets/ alone is the
    // Sheets HOME PAGE -- a link to it is not a submission. Require a real
    // document id, which sheetIdOf also normalises across URL shapes.
    return sheetIdOf(raw) !== null;
  } catch {
    return false;
  }
}

/**
 * The spreadsheet id in a Sheets URL, or null.
 *
 * The `/u/N/` segment is Google's multi-account form, and anyone signed in to
 * two Google accounts (personal plus college, which is the norm here) gets it
 * in their address bar. Without it, pasting the blank TEMPLATE as
 * /spreadsheets/u/1/d/<templateId>/edit read as null -- so the template check
 * was skipped and the candidate's round closed on our empty sheet.
 */
export function sheetIdOf(raw: string): string | null {
  return /\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/.exec(raw)?.[1] ?? null;
}
