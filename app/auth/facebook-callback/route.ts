/**
 * app/auth/facebook-callback/route.ts
 *
 * Callback OAuth de Facebook. Mismo patrón que google-callback: valida
 * CSRF state, intercambia code por access_token, fetch userinfo, upsert
 * en public.users (idempotente por email UNIQUE), setea cookie cf_client
 * HMAC y redirige al catálogo.
 *
 * Nota: Facebook NO siempre devuelve email — el user puede ocultarlo o
 * no tener uno público. Si no viene → fallamos a la pantalla del gate
 * con error, así el user puede usar Google o OTP.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { encodeGateCookie, GATE_COOKIE_CONFIG } from '@/lib/auth/gate-cookie'
import { FACEBOOK_OAUTH_STATE_COOKIE } from '@/app/(auth)/gate/facebook-shared'

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
  const storedState = cookieStore.get(FACEBOOK_OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(FACEBOOK_OAUTH_STATE_COOKIE)

  if (!code || !state || state !== storedState) {
    return fail(url, 'invalid_state')
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_APP_SECRET
  if (!appId || !appSecret) {
    return fail(url, 'not_configured')
  }

  const origin = siteOrigin() || (await inferOriginFromHeaders())
  const redirectUri = `${origin}/auth/facebook-callback`

  // 1) code → access_token
  const tokenParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  })
  const tokenRes = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${tokenParams.toString()}`,
  )
  if (!tokenRes.ok) {
    console.error('[fb-callback] token exchange failed:', await tokenRes.text())
    return fail(url, 'token_exchange_failed')
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string }
  if (!tokenJson.access_token) {
    return fail(url, 'no_access_token')
  }

  // 2) access_token → userinfo (email + name + id)
  const userRes = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokenJson.access_token)}`,
  )
  if (!userRes.ok) {
    console.error('[fb-callback] userinfo failed:', await userRes.text())
    return fail(url, 'userinfo_failed')
  }
  const ui = (await userRes.json()) as {
    id?: string
    name?: string
    email?: string
  }
  const email = (ui.email ?? '').trim().toLowerCase()
  if (!email) {
    // FB no devolvió email — user no lo tiene público o lo bloqueó.
    return fail(url, 'fb_no_email')
  }
  const name = (ui.name ?? email.split('@')[0]).trim()

  // 3) Upsert public.users.
  const sb = createAdminClient()
  const { error: upsertErr } = await sb.from('users').upsert(
    {
      email,
      name,
      source: 'catalog_facebook',
      lead_status: 'warm',
      email_verified_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'email' },
  )
  if (upsertErr) {
    console.error('[fb-callback] upsert users:', upsertErr.message)
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
