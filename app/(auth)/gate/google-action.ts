'use server'

/**
 * app/(auth)/gate/google-action.ts
 *
 * Server action que arma la URL del flow OAuth de Google. El cliente
 * recibe la URL y hace window.location.assign(url). Google después
 * redirige a /auth/google-callback con code + state.
 *
 * State: random hex guardado en cookie HTTP-only (CSRF guard). El callback
 * lo valida contra la cookie y la borra.
 */

import { cookies, headers } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { GOOGLE_OAUTH_STATE_COOKIE } from './google-shared'

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

export async function startGoogleOAuth(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    return { ok: false, error: 'Google OAuth no está configurado.' }
  }

  const origin = siteOrigin() || (await inferOriginFromHeaders())
  const redirectUri = `${origin}/auth/google-callback`

  const state = randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 min
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
    state,
  })
  return {
    ok: true,
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  }
}
