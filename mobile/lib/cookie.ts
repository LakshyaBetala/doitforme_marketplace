// Builds the Cookie header the website's API routes already understand.
// Those routes read the session through @supabase/ssr (cookies only), and a native
// app has no cookies, so we send the same cookie by hand. No server change needed.
// Format mirrors node_modules/@supabase/ssr/dist/main/cookies.js: name
// "sb-<projectRef>-auth-token", value "base64-" + base64url(JSON), split into
// ".0", ".1" ... chunks past 3180 characters.
const MAX_CHUNK = 3180;

function toBase64Url(text: string) {
  const bytes = encodeURIComponent(text).replace(/%([0-9A-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
  return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function authCookieName(supabaseUrl: string) {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

export function buildAuthCookie(supabaseUrl: string, session: Record<string, unknown>) {
  const name = authCookieName(supabaseUrl);
  // The refresh token never leaves the device: if the server refreshed it, the rotation
  // would invalidate the copy stored in the app and log the user out at random.
  const value = 'base64-' + toBase64Url(JSON.stringify({ ...session, refresh_token: 'app' }));
  if (value.length <= MAX_CHUNK) return `${name}=${value}`;
  const parts: string[] = [];
  for (let i = 0, n = 0; i < value.length; i += MAX_CHUNK, n++) {
    parts.push(`${name}.${n}=${value.slice(i, i + MAX_CHUNK)}`);
  }
  return parts.join('; ');
}
