import { buildAuthCookie } from './cookie';
import { isDemo, supabase } from './supabase';

export const SITE = 'https://www.doitforme.in';

export type ApiResult<T = any> = { ok: boolean; status: number; data: T; error?: string };

// Calls the website's API routes as the signed-in user (see lib/cookie.ts).
export async function api<T = any>(
  path: string,
  opts: { method?: 'POST' | 'GET' | 'DELETE'; body?: unknown; form?: FormData } = {},
): Promise<ApiResult<T>> {
  if (isDemo()) return { ok: false, status: 0, data: {} as T, error: 'Demo mode: actions are switched off.' };

  let { data } = await supabase.auth.getSession();
  // Refresh here, on the device, so the server never has to (it would rotate the token).
  if (data.session && (data.session.expires_at ?? 0) - Date.now() / 1000 < 300) {
    const r = await supabase.auth.refreshSession();
    data = { session: r.data.session } as typeof data;
  }
  if (!data.session) return { ok: false, status: 401, data: {} as T, error: 'Please sign in again.' };

  const headers: Record<string, string> = {
    Cookie: buildAuthCookie(process.env.EXPO_PUBLIC_SUPABASE_URL!, data.session as any),
  };
  let body: any;
  if (opts.form) body = opts.form; // let fetch set the multipart boundary
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }

  try {
    // credentials:'omit' keeps the native cookie jar from overwriting our Cookie header.
    const res = await fetch(SITE + path, { method: opts.method ?? 'POST', headers, body, credentials: 'omit' });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: json as T, error: res.ok ? undefined : json?.error ?? json?.message ?? `Request failed (${res.status})` };
  } catch {
    return { ok: false, status: 0, data: {} as T, error: 'No connection. Check your internet and try again.' };
  }
}
