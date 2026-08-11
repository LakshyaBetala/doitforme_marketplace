// Signup attribution — how a user actually found doitforme.
//
// Two independent signals, because neither alone is trustworthy:
//   1. Self-report ("How did you hear about us?") — catches dark social, which
//      is invisible to referrers. A WhatsApp forward arrives as direct traffic.
//   2. First-touch referrer + UTM — objective, but blind to exactly that.
//
// The Aug 2026 spike arrived almost entirely as direct traffic, so the
// self-report is the load-bearing one. Keep the option list SHORT and worded
// the way a student would say it, not the way an analyst would.

export const SIGNUP_SOURCES = [
  { value: "friend_whatsapp", label: "A friend / college WhatsApp group" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "google", label: "Google search" },
  { value: "reddit_quora", label: "Reddit / Quora" },
  { value: "youtube", label: "YouTube" },
  { value: "other", label: "Somewhere else" },
] as const;

export type SignupSource = (typeof SIGNUP_SOURCES)[number]["value"];

const VALID = new Set<string>(SIGNUP_SOURCES.map((s) => s.value));

export function isValidSource(v: unknown): v is SignupSource {
  return typeof v === "string" && VALID.has(v);
}

const KEY = "difm_attr_v1";

export interface FirstTouch {
  referrer?: string;
  landing?: string;
}

/**
 * Record the first page the user ever landed on and where they came from.
 * Write-once per browser: a later visit must not overwrite the original touch,
 * otherwise everyone ends up attributed to whatever page they last refreshed.
 * Safe to call on every page load.
 */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(KEY)) return;

    const url = new URL(window.location.href);
    const utm = ["utm_source", "utm_medium", "utm_campaign", "ref"]
      .map((k) => {
        const v = url.searchParams.get(k);
        return v ? `${k}=${v}` : null;
      })
      .filter(Boolean)
      .join("&");

    const payload: FirstTouch = {
      // Strip our own domain — a same-site referrer tells us nothing.
      referrer:
        document.referrer && !document.referrer.includes(window.location.host)
          ? document.referrer.slice(0, 300)
          : "(direct)",
      landing: `${url.pathname}${utm ? `?${utm}` : ""}`.slice(0, 300),
    };

    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Private mode / storage disabled — attribution is nice-to-have, never fatal.
  }
}

export function readFirstTouch(): FirstTouch {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FirstTouch) : {};
  } catch {
    return {};
  }
}
