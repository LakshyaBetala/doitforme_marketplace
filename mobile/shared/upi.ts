// UPI VPA validation and normalisation — single source of truth.
//
// This is a money-destination field: a typo does not bounce, it pays a
// stranger. The old regex (/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/) was wrong
// in both directions — it accepted "..@a" and ".name.@upi" while the 256-char
// local part is far beyond anything NPCI issues.
//
// Rules encoded here follow the NPCI VPA format:
//   <local>@<psp>
//   local: 2-50 chars, alphanumeric plus . _ - , must start AND end
//          alphanumeric, no consecutive separators.
//   psp:   2-30 letters (handles are alphabetic: ybl, okaxis, paytm, upi...).
// VPAs are case-insensitive and are stored lowercase so the same destination
// never appears as two different strings.

export const UPI_MAX_LOCAL = 50;

// Local part is 2-50: first and last must be alphanumeric, separators only in
// between. Making the tail optional would allow a 1-character local part.
const VPA = /^[a-z0-9][a-z0-9._-]{0,48}[a-z0-9]@[a-z]{2,30}$/;
const CONSECUTIVE_SEPARATORS = /[._-]{2,}/;

/** PSP handles seen in the wild. Used for a soft warning only — never a block,
 *  because new handles appear and blocking an unknown one strands a real user. */
export const KNOWN_PSP_HANDLES = new Set([
  "ybl", "okaxis", "okhdfcbank", "okicici", "oksbi", "paytm", "upi", "apl",
  "axl", "ibl", "yapl", "abfspay", "freecharge", "jupiteraxis", "fam",
  "airtel", "axisbank", "hdfcbank", "icici", "sbi", "kotak", "idfcbank",
  "pnb", "barodampay", "unionbank", "indus", "cnrb", "rbl", "yesbank",
  "superyes", "waaxis", "waicici", "wasbi", "wahdfcbank", "naviaxis", "slc",
]);

export interface UpiCheck {
  valid: boolean;
  /** Lowercased, trimmed value that should be persisted. */
  normalized: string;
  /** User-facing reason when invalid. */
  error?: string;
  /** Valid format but an unrecognised PSP handle — worth confirming, not blocking. */
  unknownHandle?: boolean;
}

export function normalizeUpi(raw: string): string {
  // Strip zero-width and non-breaking spaces too: pasting from WhatsApp and
  // banking apps routinely carries them and they are invisible in the input.
  return String(raw ?? "")
    .replace(/[​-‍﻿ ]/g, "")
    .trim()
    .toLowerCase();
}

export function checkUpi(raw: string): UpiCheck {
  const normalized = normalizeUpi(raw);

  if (!normalized) {
    return { valid: false, normalized, error: "Enter your UPI ID." };
  }
  if (!normalized.includes("@")) {
    return { valid: false, normalized, error: "A UPI ID looks like name@bank — yours is missing the @." };
  }
  if ((normalized.match(/@/g) || []).length > 1) {
    return { valid: false, normalized, error: "A UPI ID can only contain one @." };
  }

  const [local, psp] = normalized.split("@");

  if (local.length > UPI_MAX_LOCAL) {
    return { valid: false, normalized, error: "That UPI ID is too long." };
  }
  if (CONSECUTIVE_SEPARATORS.test(local)) {
    return { valid: false, normalized, error: "Remove the repeated dots or dashes from your UPI ID." };
  }

  // Checked BEFORE the format test: an email fails the VPA regex on the dot in
  // its domain, which would return the generic "doesn't look valid" message.
  // Entering an email here is the most common mistake in this field and it
  // deserves to be named, so the user knows what to do instead of guessing.
  if (/^(gmail|yahoo|outlook|hotmail|protonmail|rediffmail|icloud|live|aol)(\.|$)/.test(psp)) {
    return { valid: false, normalized, error: "That's an email address, not a UPI ID. Example: name@okhdfcbank" };
  }

  if (!VPA.test(normalized)) {
    return { valid: false, normalized, error: "That doesn't look like a valid UPI ID. Example: name@okhdfcbank" };
  }

  return { valid: true, normalized, unknownHandle: !KNOWN_PSP_HANDLES.has(psp) };
}

/** Convenience for server routes that only need a boolean gate. */
export function isValidUpi(raw: string): boolean {
  return checkUpi(raw).valid;
}
