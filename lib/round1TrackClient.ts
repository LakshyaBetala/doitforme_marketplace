// Fire-and-forget event tracker for the Round 1 portal pages.
//
// Imported by the client components only. Deliberately decoupled from the
// server-side event name validator in lib/innerCircleRound1.ts because that
// file carries D1 typings and a bunch of crypto surface — a page component
// shouldn't drag any of that into the browser bundle for the sake of one
// POST.
//
// Pass the token for pre-auth events (invite_opened, start_clicked); it's a
// no-op for authenticated pages where the session cookie identifies the
// candidate automatically. Failures are swallowed — tracking must never
// prevent the real action from completing.

export type Round1Event =
  | "invite_opened"
  | "brief_expanded"
  | "template_clicked_pre"
  | "start_clicked"
  | "claim_success"
  | "claim_failed"
  | "dashboard_viewed"
  | "template_clicked_task"
  | "countdown_critical"
  | "submit_attempted"
  | "submit_success"
  | "submit_rejected"
  | "login_attempted"
  | "login_success"
  | "login_failed"
  | "switch_tech_viewed"
  | "switch_tech_confirmed";

export function track(
  event: Round1Event,
  options?: { token?: string; metadata?: Record<string, unknown> }
): void {
  // Only runs in the browser. SSR would hit the fetch stub Next ships, which
  // is harmless, but we skip it to keep server logs clean.
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/inner-circle/round1/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true, // let the POST finish even if the page unloads
      body: JSON.stringify({ event, token: options?.token, metadata: options?.metadata }),
    }).catch(() => {});
  } catch {
    // never throw from a tracker
  }
}
