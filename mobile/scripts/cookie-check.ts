// Offline proof that lib/cookie.ts produces a cookie the server's @supabase/ssr accepts.
// Run from the repo root (uses the web app's @supabase/ssr):
//   npx tsx mobile/scripts/cookie-check.ts
import assert from 'node:assert/strict';
import { createServerClient } from '@supabase/ssr';
import { buildAuthCookie } from '../lib/cookie';

const url = 'https://abcdefghij.supabase.co';
const seg = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

function session(extra = '') {
  const jwt = `${seg({ alg: 'HS256' })}.${seg({ sub: 'user-1', role: 'authenticated', exp: 4102444800 })}.sig`;
  return {
    access_token: jwt,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'real-secret-refresh',
    user: { id: 'user-1', aud: 'authenticated', email: 'a@b.c', user_metadata: { name: 'Zoë 😀' + extra } },
  };
}

async function roundTrip(label: string, extra: string) {
  const cookieHeader = buildAuthCookie(url, session(extra));
  assert.ok(!cookieHeader.includes('real-secret-refresh'), 'real refresh token leaked into the cookie');
  const client = createServerClient(url, 'anon', {
    cookies: {
      getAll: () =>
        cookieHeader.split('; ').map((p) => {
          const i = p.indexOf('=');
          return { name: p.slice(0, i), value: p.slice(i + 1) };
        }),
      setAll: () => {},
    },
  });
  const { data } = await client.auth.getSession();
  assert.equal(data.session?.user.id, 'user-1', `${label}: user did not round-trip`);
  assert.equal(data.session?.user.user_metadata.name, 'Zoë 😀' + extra, `${label}: utf-8 mangled`);
  console.log(`ok  ${label} (${cookieHeader.length} chars, ${cookieHeader.split('; ').length} cookie(s))`);
}

(async () => {
  await roundTrip('single cookie', '');
  await roundTrip('chunked cookie', 'x'.repeat(5000));
})();
