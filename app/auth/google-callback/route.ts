/**
 * app/auth/google-callback/route.ts
 *
 * Callback OAuth de Google. Recibe `code` + `state`, valida CSRF, intercambia
 * code por access_token, fetch del userinfo, upsert en public.users (mismo
 * patrón que el OTP flow → idempotente por email UNIQUE), setea la cookie
 * cf_client HMAC y redirige al catálogo.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { encodeGateCookie, GATE_COOKIE_CONFIG } from '@/lib/auth/gate-cookie'
import { GOOGLE_OAUTH_STATE_COOKIE } from '@/app/(auth)/gate/google-shared'

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || ''
}

async function inferOriginFromHeaders(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto =
    h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

function fail(url: URL, reason: string): NextResponse {
  url.pathname = '/catalogo'
  url.searchParams.set('auth_error', reason)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  const cookieStore = await cookies()
  const storedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE)

  if (!code || !state || state !== storedState) {
    return fail(url, 'invalid_state')
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return fail(url, 'not_configured')
  }

  const origin = siteOrigin() || (await inferOriginFromHeaders())
  const redirectUri = `${origin}/auth/google-callback`

  // 1) code → tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  if (!tokenRes.ok) {
    console.error('[google-callback] token exchange failed:', await tokenRes.text())
    return fail(url, 'token_exchange_failed')
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string
    id_token?: string
  }
  if (!tokenJson.access_token) {
    return fail(url, 'no_access_token')
  }

  // 2) access_token → userinfo
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  })
  if (!userRes.ok) {
    console.error('[google-callback] userinfo failed:', await userRes.text())
    return fail(url, 'userinfo_failed')
  }
  const ui = (await userRes.json()) as {
    email?: string
    email_verified?: boolean
    name?: string
    given_name?: string
    picture?: string
    locale?: string
  }
  const email = (ui.email ?? '').trim().toLowerCase()
  if (!email || ui.email_verified !== true) {
    return fail(url, 'email_unverified')
  }
  const name = (ui.name ?? ui.given_name ?? email.split('@')[0]).trim()

  // 3) Upsert public.users (mismo patrón que OTP).
  const sb = createAdminClient()
  const { error: upsertErr } = await sb.from('users').upsert(
    {
      email,
      name,
      source: 'catalog_google',
      lead_status: 'warm',
      email_verified_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  )
  if (upsertErr) {
    console.error('[google-callback] upsert users:', upsertErr.message)
    return fail(url, 'db_error')
  }

  // 4) Set cookie cf_client HMAC.
  cookieStore.set(GATE_COOKIE_CONFIG.name, encodeGateCookie(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GATE_COOKIE_CONFIG.maxAgeSeconds,
    path: '/',
  })

  // 5) Redirect al catálogo.
  url.pathname = '/catalogo'
  url.search = ''
  return NextResponse.redirect(url)
}
