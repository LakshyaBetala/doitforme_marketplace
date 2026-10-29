// Which paths the middleware guards, and which it lets through while the
// site is held. Pure data and pure functions, no Next imports, so the matching
// can be unit-tested -- proxy.ts itself cannot be, and the bug this file was
// split out for slipped through a merge for exactly that reason.
//
// proxy.ts is the only consumer. Keep it that way: a second reader of these
// lists is a second place for the rules to drift.

// Paths that actually need a server-verified session. Everything else is
// public, and asking Supabase who the visitor is on a public page costs a
// round-trip that changes nothing.
export const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/post',
  '/feed',
  '/gig',
  '/onboarding',
  '/verify-id', // KYC page should be protected
  // These render private data and were reachable while signed out. RLS kept
  // the rows safe, so nothing leaked, but an anonymous visitor landed on an
  // empty inbox/activity/payout screen with no explanation instead of a login.
  '/messages',
  '/activity',
  '/payouts',
  '/settings',
  '/admin',
  // Same reasoning: the Inner Circle surfaces and the program terms render
  // per-member data and a signed-out visitor got an empty shell rather than a
  // login. WorkspaceLayout gates them too; this is the cheaper first layer.
  '/inner-circle',
  '/program',
  // The app surface. Its own layout gates on membership, but keeping it in
  // this list means an unauthenticated request never reaches the layout at
  // all and lands on /login with a next= back to the app.
  '/app',
]

// SURFACES WITH THEIR OWN LOGIN, which the Supabase gate must never see.
//
// The Round 1 sales portal authenticates candidates with a signed D1 session
// (email + date of birth); none of them has a Supabase account, and that is the
// point -- they are waitlist rows, not users. It lives under /inner-circle only
// for the URL, so the prefix match on '/inner-circle' above would otherwise
// bounce every candidate to /login, a page they cannot pass. Found live, after
// a merge put '/inner-circle' into PROTECTED_ROUTES on one branch and the
// portal under it on the other.
export const SELF_AUTHENTICATING = ['/inner-circle/sales/round-1']

/**
 * Prefix match on SEGMENT boundaries, not raw characters.
 *
 * `pathname.startsWith(entry)` is what these lists used, and it matches far
 * more than it reads: '/auth' also opens '/auth-transfer' (which installs a
 * session from query-string tokens) and '/verify' also opens '/verify-id'
 * (the KYC upload). Both are real entries we wanted, and neither of those
 * extra routes is. An entry now matches the path itself or anything under
 * its slash, so '/verify' covers '/verify' and '/verify/x' but never
 * '/verify-id'.
 */
const matches = (pathname: string, list: readonly string[]) =>
  list.some(entry => pathname === entry || pathname.startsWith(entry.endsWith('/') ? entry : entry + '/'))

export const isProtectedPath = (pathname: string) =>
  !matches(pathname, SELF_AUTHENTICATING) && matches(pathname, PROTECTED_ROUTES)

// Pages that still work with no backend, so they stay up.
//
// The landing page touches Supabase only for an optional auth.getUser() to
// greet a signed-in visitor; supabase-js resolves that with an error object
// rather than throwing, so it renders exactly as normal. The legal pages are
// static text. Taking those down would cost SEO and tell a first-time visitor
// nothing about what we do — the maintenance page is for people trying to get
// INTO the product, not for everyone who hears the name.
//
// /talent and /u/[username] are deliberately NOT here: both read gigs and
// profiles from Supabase and would render an empty shell.
export const MAINTENANCE_PUBLIC = [
  '/pricing',
  '/terms',
  '/privacy-policy',
  '/refund-policy',
  '/shipping-policy',
  '/contact',
  '/maintenance',
  '/api/waitlist',
  // Keep the webhook reachable. Razorpay retries a 5xx for ~24h, so answering
  // it with a maintenance page would consume those retries and silently drop
  // payments that were actually captured.
  '/api/webhooks',
  // THE INNER CIRCLE APP RUNS WHILE THE PUBLIC SITE IS HELD.
  //
  // This is the one surface where the hold page is actively wrong. /app is the
  // Android app's entire content: it is invite-only, every route under it is
  // gated by app/app/layout.tsx and then again by RLS, and the people using it
  // are the team delivering client work — holding them out while the public
  // marketplace is paused stops the actual business rather than protecting it.
  // A non-member who finds the URL gets the invite-only screen, not the site.
  '/app',
  // Inner Circle · Round 1 portal runs DURING the maintenance window — that
  // is the whole point of the campaign. The portal uses its own D1-backed
  // auth (email + DOB), so Supabase being 402 doesn't affect it. If this
  // allowlist drops the path, candidates click the invite link and land on
  // the hold page instead of their task.
  '/inner-circle/sales/round-1',
  '/api/inner-circle',
  // Shorter branded path to the Round 1 return-login. The page itself just
  // redirects to /inner-circle/sales/round-1, but it needs to be reachable
  // through maintenance for the redirect to fire. Marketing / email signatures
  // can link to this instead of the longer /inner-circle/sales/round-1.
  '/login/inner-circle-sales',
  // Admin desk needs to be reachable so the operator can trigger invites,
  // download the mail-merge CSV and decide on submissions during the Round 1
  // campaign. The /admin page itself gates on isAdminEmail — a non-admin who
  // reaches it gets redirected straight to /dashboard, which is still blocked
  // and rewrites to /maintenance. So exposing /admin exposes nothing an
  // attacker can act on without a whitelisted Supabase session.
  '/admin',
  // ...which is useless if nobody can sign in to reach it. /admin redirects a
  // signed-out visitor to /login, and /login was held, so an admin on any
  // device without a live session could not open the desk and could not send
  // a single Round 1 invite. It was held because Supabase Auth was answering
  // 402 and students were meeting a broken form; Auth is healthy again
  // (GET /auth/v1/health -> 200, 2026-10-29). A student who signs in now just
  // lands on the hold page from /dashboard, so nothing new is exposed.
  // ...and /verify, or opening /login achieves nothing: Supabase here is
  // configured for email OTP only (CLAUDE.md), so EVERY sign-in and signup
  // goes /login -> code emailed -> /verify to type it in. With /verify held,
  // an admin got the code and then the hold page, and could not reach the
  // desk at all. Found by review after /login alone was shipped.
  //
  // /verify is only an OTP box; it needs no backend of ours. The sync call it
  // makes to /api/auth/create-user is wrapped in try/catch and non-fatal, and
  // an existing account (which every admin has) already has its row.
  //
  // '/verify' does NOT open '/verify-id' (the KYC upload): matches() is
  // segment-aware. '/auth' likewise no longer opens '/auth-transfer'.
  '/login',
  '/verify',
  '/auth',
  '/api/admin/inner-circle-round1',
  '/api/cron/inner-circle-round1-nudge',
]

export const isMaintenancePublic = (pathname: string) =>
  pathname === '/' || matches(pathname, MAINTENANCE_PUBLIC)
