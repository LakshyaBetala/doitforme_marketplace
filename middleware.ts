import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  // 1. DEFINE PROTECTED ROUTES
  // These routes require the user to be logged in
  const protectedRoutes = [
    '/dashboard',
    '/profile',
    '/post',
    '/feed',
    '/gig',
    '/onboarding',
    '/verify-id' // KYC page should be protected
  ]

  // Check if current path is protected
  const isProtected = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

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
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/ (API routes)
     * - public images (svg, png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}