'use server'

/**
 * app/(auth)/gate/facebook-action.ts
 *
 * Server action que arma la URL del flow OAuth de Facebook. El cliente
 * recibe la URL y hace window.location.assign(url). Facebook después
 * redirige a /auth/facebook-callback con code + state.
 */

import { cookies, headers } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { FACEBOOK_OAUTH_STATE_COOKIE } from './facebook-shared'

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.replace(/^/, 'https://') ||
    ''
  )
}

async function inferOriginFromHeaders(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function startFacebookOAuth(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const appId = process.env.FACEBOOK_APP_ID
  if (!appId) {
    return { ok: false, error: 'Facebook OAuth no está configurado.' }
  }

  const origin = siteOrigin() || (await inferOriginFromHeaders())
  const redirectUri = `${origin}/auth/facebook-callback`

  const state = randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(FACEBOOK_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 min
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'email,public_profile',
    state,
  })
  return {
    ok: true,
    url: `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`,
  }
}
