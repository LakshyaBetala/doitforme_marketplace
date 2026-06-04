// Single source of truth for user-facing error messages.
//
// Goal: a student should instantly understand *whose problem it is* and whether
// they can fix it, instead of seeing raw "Failed to fetch" / Postgres codes.
//
// Three categories, each with its own icon:
//   📶 network — can't reach us (their connection or ours); just retry.
//   ✏️ you     — something the user can fix (bad input, signed out, duplicate).
//   ⚠️ us      — our bug/server error; we've been notified + a short Ref code.
//
// Usage:
//   import { friendlyError, friendlyHttpError } from "@/lib/errors";
//   catch (e) { toast.error(friendlyError(e)); }
//   if (!res.ok) setError(friendlyHttpError(res.status, data?.error));

export type ErrorSide = "network" | "you" | "us";

export interface FriendlyError {
  side: ErrorSide;
  icon: string;
  title: string;
  message: string;
  ref?: string; // only for "us" — lets the user quote it when reporting
}

const ICON: Record<ErrorSide, string> = {
  network: "📶",
  you: "✏️",
  us: "⚠️",
};

// Short, human reference code for server-side errors so users can report them.
function makeRef(): string {
  return "ERR-" + Math.random().toString(16).slice(2, 6).toUpperCase();
}

function netError(): FriendlyError {
  return {
    side: "network",
    icon: ICON.network,
    title: "Can't reach our servers",
    message: "Check your internet connection and try again.",
  };
}

function youError(title: string, message: string): FriendlyError {
  return { side: "you", icon: ICON.you, title, message };
}

function usError(message = "We've been notified — please try again in a moment."): FriendlyError {
  const ref = makeRef();
  return { side: "us", icon: ICON.us, title: "Something went wrong on our end", message, ref };
}

function looksOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function isNetworkMessage(msg: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|err_internet|err_network|fetch failed|connection (refused|reset)|timed? ?out/i.test(
    msg
  );
}

// Map well-known Supabase Auth / Postgres messages to friendly, user-fixable text.
function mapKnownMessage(raw: string): FriendlyError | null {
  const m = raw.toLowerCase();

  if (m.includes("invalid login credentials"))
    return youError("Wrong email or password", "Double-check them and try again.");
  if (m.includes("signups not allowed") || m.includes("user not found"))
    return youError("Account not found", "No account matches that email — try signing up instead.");
  if (m.includes("user already registered") || m.includes("already been registered"))
    return youError("Email already in use", "An account with this email exists — try logging in.");
  if (m.includes("email not confirmed"))
    return youError("Email not verified yet", "Check your inbox for the verification code first.");
  if (m.includes("token has expired") || m.includes("invalid otp") || m.includes("otp_expired") || m.includes("expired"))
    return youError("That code expired", "Request a fresh code and enter it within a few minutes.");
  if (m.includes("for security purposes") || m.includes("rate limit") || m.includes("too many requests"))
    return youError("Too many attempts", "Please wait a few seconds, then try again.");
  if (m.includes("duplicate") || m.includes("already applied"))
    return youError("Already done", "Looks like you've already done this.");
  if (m.includes("permission") || m.includes("not allowed") || m.includes("row-level security") || m.includes("rls"))
    return youError("Not allowed", "You don't have permission to do this.");

  return null;
}

// Map Postgres / PostgREST error codes.
function mapKnownCode(code: string): FriendlyError | null {
  switch (code) {
    case "23505": // unique_violation
      return youError("Already exists", "You may have already done this.");
    case "42501": // insufficient_privilege (RLS)
      return youError("Not allowed", "You don't have permission to do this.");
    case "PGRST116": // no rows
      return youError("Not found", "We couldn't find what you were looking for.");
    case "23503": // foreign_key_violation — almost always our bug
      return usError();
    case "429":
      return youError("Too many attempts", "Please wait a few seconds, then try again.");
    default:
      return null;
  }
}

/** Classify any thrown error / string / Supabase error into a friendly shape. */
export function classifyError(input: unknown): FriendlyError {
  if (looksOffline()) return netError();

  // String
  if (typeof input === "string") {
    if (isNetworkMessage(input)) return netError();
    return mapKnownMessage(input) || youError("Couldn't complete that", input);
  }

  // Error-like / Supabase error object
  if (input && typeof input === "object") {
    const anyErr = input as any;
    const msg: string = anyErr.message || anyErr.error_description || anyErr.error || "";
    const code: string | undefined = anyErr.code ? String(anyErr.code) : undefined;

    if (typeof msg === "string" && isNetworkMessage(msg)) return netError();
    if (input instanceof TypeError) return netError(); // fetch() throws TypeError on network failure

    if (code) {
      const byCode = mapKnownCode(code);
      if (byCode) return byCode;
    }
    if (msg) {
      const byMsg = mapKnownMessage(msg);
      if (byMsg) return byMsg;
    }

    // Unknown object error → treat as our problem (don't blame the user, don't leak internals)
    return usError();
  }

  return usError();
}

/** Classify a non-OK HTTP response by status code (+ optional server-provided message). */
export function classifyHttpError(status: number, serverMessage?: string): FriendlyError {
  // 4xx: the user can usually fix it. Trust our API's own message when it's friendly.
  if (status >= 400 && status < 500) {
    const fromMsg = serverMessage ? mapKnownMessage(serverMessage) : null;
    if (fromMsg) return fromMsg;

    switch (status) {
      case 400:
        return youError("Check your details", serverMessage || "Some information looks off — please review and try again.");
      case 401:
        return youError("You're signed out", "Please log in again to continue.");
      case 403:
        return youError("Not allowed", serverMessage || "You don't have permission to do this.");
      case 404:
        return youError("Not found", serverMessage || "We couldn't find what you were looking for.");
      case 409:
        return youError("Already done", serverMessage || "This was already done.");
      case 413:
        return youError("File too large", serverMessage || "That file is too big — try a smaller one.");
      case 422:
        return youError("Check your details", serverMessage || "Some information looks off — please review and try again.");
      case 429:
        return youError("Too many attempts", "You're doing that too fast — wait a moment and try again.");
      default:
        return youError("Couldn't complete that", serverMessage || "Please review and try again.");
    }
  }

  // 5xx (and anything else): our problem. Never surface the raw server message.
  return usError();
}

/** Format a FriendlyError into a single line for a toast or inline message. */
export function formatFriendly(f: FriendlyError): string {
  const ref = f.ref ? ` (Ref: ${f.ref})` : "";
  return `${f.icon} ${f.title} — ${f.message}${ref}`;
}

/** One-shot: classify a thrown error / string and return a ready-to-show line. */
export function friendlyError(input: unknown): string {
  const f = classifyError(input);
  // Keep the raw cause in the console (with the Ref) so server errors are traceable.
  if (f.side === "us") console.error(`[${f.ref}] error:`, input);
  return formatFriendly(f);
}

/** One-shot for a non-OK fetch Response. */
export function friendlyHttpError(status: number, serverMessage?: string): string {
  const f = classifyHttpError(status, serverMessage);
  if (f.side === "us") console.error(`[${f.ref}] http ${status}:`, serverMessage);
  return formatFriendly(f);
}
