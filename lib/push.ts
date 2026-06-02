// Server-side Web Push sender. Configured lazily from VAPID env vars so the
// module can be imported even when keys are absent (push just no-ops locally).
import webpush from "web-push";

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:doitforme.in@gmail.com",
    publicKey,
    privateKey
  );
  configured = true;
  return true;
}

export type PushSub = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url?: string; tag?: string };

// Returns { ok } on success, { gone: true } when the subscription is dead
// (404/410) so the caller can prune it from the table.
export async function sendPush(
  sub: PushSub,
  payload: PushPayload
): Promise<{ ok: boolean; gone?: boolean }> {
  if (!ensureConfigured()) return { ok: false };
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return { ok: true };
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode;
    if (code === 404 || code === 410) return { ok: false, gone: true };
    return { ok: false };
  }
}

export function isPushConfigured(): boolean {
  return ensureConfigured();
}
