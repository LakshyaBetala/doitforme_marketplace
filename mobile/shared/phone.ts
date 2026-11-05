// Phone number helpers. The platform is India-only — students enter the 10
// digits after +91. Stored values have historically been messy (some saved with
// 91 prefixed, one row even as 1918610987200), which broke WhatsApp deep links
// because wa.me would read a stray leading digit as the country code (+1).
//
// Canonical rule everywhere: the real number is the LAST 10 digits; the country
// code is always +91. Building "91 + last 10 digits" is correct for every
// malformed case (10-digit, 91-prefixed 12-digit, the 13-digit row, etc.).

function digitsOnly(raw: string | number | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/** Canonical 10-digit Indian mobile for storage/display. "" if too few digits. */
export function normalizeIndianPhone(raw: string | number | null | undefined): string {
  const d = digitsOnly(raw);
  if (d.length < 10) return "";
  return d.slice(-10);
}

/** wa.me / WhatsApp number: 91 + last 10 digits, no "+". "" if invalid. */
export function toWhatsAppNumber(raw: string | number | null | undefined): string {
  const ten = normalizeIndianPhone(raw);
  return ten ? `91${ten}` : "";
}

/** Pretty display, e.g. "+91 86109 87200". Falls back to the raw value. */
export function displayIndianPhone(raw: string | number | null | undefined): string {
  const ten = normalizeIndianPhone(raw);
  if (!ten) return raw ? String(raw) : "";
  return `+91 ${ten.slice(0, 5)} ${ten.slice(5)}`;
}
