// Single source of truth for who can reach the admin desks.
//
// This list was previously copy-pasted into eight route handlers and the admin
// page, and separately into the is_admin() SQL function and the payout_queue
// RLS policies. Adding a person meant editing ten places, and forgetting one
// produced the worst kind of bug: an admin who can open a tab but gets a 403
// from the endpoint behind it — or worse, the reverse.
//
// SQL cannot import TypeScript, so the database keeps its own copy. It is now
// down to one definition, public.is_admin(), and the payout_queue policies call
// that rather than repeating a literal list. Keep this array and that function
// in step — supabase/migrations/20260902_admin_whitelist.sql is the migration
// that matches this file.
export const ADMIN_EMAILS = [
  "betala911@gmail.com",
  "doitforme.in@gmail.com",
  "gandhimouriyan1234@gmail.com",
] as const;

export type AdminEmail = (typeof ADMIN_EMAILS)[number];

/**
 * Whether an address belongs to an admin.
 *
 * Compares case-insensitively and ignores surrounding whitespace: Supabase
 * stores whatever casing the user typed at signup, so a strict === against a
 * lowercase literal locks out an admin who signed up as "Betala911@gmail.com".
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (ADMIN_EMAILS as readonly string[]).includes(normalized);
}
