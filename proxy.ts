/**
 * middleware.ts
 *
 * Next.js middleware for:
 *   1. Refreshing the Supabase session cookie on every request (required by @supabase/ssr)
 *   2. Enforcing authentication and role-based access for protected routes
 *
 * Route protection rules:
 *   /portal/*  → requires any authenticated user
 *   /admin/*   → requires profile.role === 'admin'
 *   /login     → redirect to /portal if already authenticated
 *   /register  → redirect to /portal if already authenticated
 *
 * Public routes (no auth required): everything else.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication (any role)
const PORTAL_PATTERN = /^\/portal(\/.*)?$/
// Routes that require admin role
const ADMIN_PATTERN = /^\/admin(\/.*)?$/
// Auth pages — redirect away if already signed in
const AUTH_PAGES = ['/login', '/register']

export async function proxy(request: NextRequest) {
  // Skip auth entirely when Supabase is not configured (local dev without credentials)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const res = NextResponse.next({ request })
    res.headers.set('x-pathname', request.nextUrl.pathname)
    return res
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Do not run any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it hard to debug
  // issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Forward the pathname in a request header so Server Components (e.g. portal
  // layout) can read it without needing the next/headers `usePathname` workaround.
  supabaseResponse.headers.set('x-pathname', pathname)

  // ---- Admin routes: must be signed in and have admin role ------------------
  if (ADMIN_PATTERN.test(pathname)) {
    if (!user) {
      return redirectToLogin(request, pathname)
    }

    // Fetch role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      // Non-admin authenticated user: send to portal, not a 404
      return NextResponse.redirect(new URL('/portal', request.url))
    }

    return supabaseResponse
  }

  // ---- Portal routes: must be signed in (any role) -------------------------
  if (PORTAL_PATTERN.test(pathname)) {
    if (!user) {
      return redirectToLogin(request, pathname)
    }
    return supabaseResponse
  }

  // ---- Auth pages: redirect away if already signed in ---------------------
  if (AUTH_PAGES.includes(pathname) && user) {
    return NextResponse.redirect(new URL('/portal', request.url))
  }

  return supabaseResponse
}

function redirectToLogin(request: NextRequest, returnTo: string): NextResponse {
  const loginUrl = new URL('/login', request.url)
  // Preserve the intended destination so the login page can redirect back
  loginUrl.searchParams.set('returnTo', returnTo)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *  - _next/static  (static files)
     *  - _next/image   (image optimization)
     *  - favicon.ico, sitemap.xml, robots.txt
     *  - Any file with an extension (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|otf)).*)',
  ],
}
