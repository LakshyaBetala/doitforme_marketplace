import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that actually need a server-verified session. Everything else is
// public, and asking Supabase who the visitor is on a public page costs a
// round-trip that changes nothing.
const PROTECTED_ROUTES = [
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
]

// MAINTENANCE MODE.
//
// Supabase answers 402 on every endpoint (exceed_storage_size_quota), which
// takes Auth, REST, Storage and Realtime with it — so login, signup, the feed
// and every gig page are dead, not slow. Leaving them reachable means students
// meet a broken login form and write to support about "authentication errors",
// which is exactly what started happening.
//
// Everything is rewritten to /maintenance, which talks to Cloudflare D1 instead
// and so keeps working. Two things stay reachable: the page itself, and
// /api/waitlist, which is the only reason the page exists.
//
// Env-driven so the hold page can be lifted without a code change, and so dev
// can work on signed-in screens while production stays held. Default is ON:
// forgetting to set a variable must not accidentally expose a broken site.
//   MAINTENANCE_MODE=off   in .env.local  -> normal site (dev)
//   unset / anything else                 -> hold page (production today)
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE !== 'off' 

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
const MAINTENANCE_PUBLIC = [
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
]

const isMaintenancePublic = (pathname: string) =>
  pathname === '/' || MAINTENANCE_PUBLIC.some(p => pathname.startsWith(p))

/**
 * True only in a dev build with the preview flag on. See lib/devPreview.ts.
 *
 * `process.env.NODE_ENV` is a build-time literal, so a production build compiles
 * this to `return false` and drops the require() — which is what keeps the
 * fixtures, and this bypass, out of the deployed Worker entirely.
 */
function devPreviewEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./lib/devPreview') as typeof import('./lib/devPreview')).DEV_PREVIEW
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (MAINTENANCE_MODE && !isMaintenancePublic(pathname)) {
    // Rewrite, not redirect: the visitor keeps the URL they came for, so a
    // shared /gig/<id> link still works the moment the flag goes off.
    const url = request.nextUrl.clone()
    url.pathname = '/maintenance'
    return NextResponse.rewrite(url, { status: 503, headers: { 'Retry-After': '604800' } })
  }

  // DEV PREVIEW. Supabase Auth is 402, so auth.getUser() fails and every
  // protected route redirects to /login — which makes the whole signed-in
  // product impossible to look at. This lets it through with fixture data.
  //
  // DEV_PREVIEW is `process.env.NODE_ENV !== "production" && <opt-in flag>`, and
  // NODE_ENV is a compile-time constant, so in a production build this folds to
  // `if (false)` and the auth gate is exactly as it was. An env var cannot turn
  // it on in the deployed Worker. See lib/devPreview.ts.
  if (devPreviewEnabled()) return NextResponse.next()

  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route))

  // AUTH IS ONLY CHECKED WHERE IT CHANGES THE ANSWER.
  //
  // supabase.auth.getUser() is a network call to Supabase's auth server on every
  // request it runs in. Running it unconditionally meant the landing page, /about,
  // /talent and every public /u/<username> paid for a session lookup whose result
  // was then discarded — on Vercel that is a billed function invocation holding an
  // open socket, and it was the largest single contributor to Fluid Active CPU
  // (11h53m against a 4h Hobby allowance, which paused the whole project).
  //
  // Public paths now short-circuit before any Supabase client is constructed.
  // Sessions still refresh: the refresh token is long-lived, so the first
  // navigation to a protected path re-establishes it. Client components read the
  // session through the browser client, which refreshes on its own schedule and
  // never depended on this.
  if (!isProtected && pathname !== '/login') {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get User
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 2. REDIRECT LOGIC
  // If user is NOT logged in and tries to access a protected route -> Redirect to Login
  if (!user && isProtected) {
    const loginUrl = new URL('/login', request.url)
    // Optional: Save where they were trying to go to redirect back after login
    loginUrl.searchParams.set('redirect_to', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 3. OPTIONAL: PREVENT LOGGED-IN USERS FROM SEEING LOGIN PAGE
  // If user IS logged in and tries to visit /login or /verify (except for signup flow), send to dashboard
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image  (build output and the image optimizer)
     * - api/                       (route handlers authorize themselves)
     * - static file extensions
     *
     * Every path this matches is a billed function invocation, so the extension
     * list matters. It previously covered only images, which let public/sw.js
     * through — a service worker the browser re-fetches on its own schedule for
     * every installed user, each time waking the middleware for a file that has
     * nothing to do with auth. ico/webmanifest/txt/xml/js/css/fonts are listed
     * for the same reason.
     */
    '/((?!_next/static|_next/image|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|webmanifest|json|txt|xml|js|css|map|woff|woff2|ttf|otf|eot)$).*)',
  ],
}