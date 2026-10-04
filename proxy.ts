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
// Flip to false and redeploy to bring the site back — nothing else to undo.
const MAINTENANCE_MODE = true

const MAINTENANCE_ALLOWED = [
  '/maintenance',
  '/api/waitlist',
  // Keep the webhook reachable. Razorpay retries a 5xx for ~24h, so answering
  // it with a maintenance page would consume those retries and silently drop
  // payments that were actually captured.
  '/api/webhooks',
]

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (MAINTENANCE_MODE && !MAINTENANCE_ALLOWED.some(p => pathname.startsWith(p))) {
    // Rewrite, not redirect: the visitor keeps the URL they came for, so a
    // shared /gig/<id> link still works the moment the flag goes off.
    const url = request.nextUrl.clone()
    url.pathname = '/maintenance'
    return NextResponse.rewrite(url, { status: 503, headers: { 'Retry-After': '604800' } })
  }

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