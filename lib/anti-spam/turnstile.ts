/**
 * lib/anti-spam/turnstile.ts
 *
 * Verificación de Cloudflare Turnstile server-side.
 *
 * Env-gated: si `TURNSTILE_SECRET_KEY` no está seteada, `verifyTurnstileToken`
 * devuelve `{ ok: true }` — el deploy es no-op hasta que se cargan las keys en
 * el dashboard de Cloudflare y se setean en Vercel (NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * + TURNSTILE_SECRET_KEY).
 *
 * Fail-open ante error de red hacia Cloudflare: si CF no responde no queremos
 * bloquear leads reales. El honeypot + rate-limit siguen actuando.
 */

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function isTurnstileEnabled(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim())
}

interface VerifyResult {
  ok: boolean
  error?: string
}

export async function verifyTurnstileToken(args: {
  token: string | null | undefined
  ip?: string | null
}): Promise<VerifyResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) return { ok: true }

  const token = args.token?.trim()
  if (!token) {
    return {
      ok: false,
      error: 'Falló la verificación anti-spam. Recargá la página y probá de nuevo.',
    }
  }

  try {
    const form = new URLSearchParams()
    form.set('secret', secret)
    form.set('response', token)
    if (args.ip) form.set('remoteip', args.ip)

    const res = await fetch(VERIFY_URL, { method: 'POST', body: form })
    const data = (await res.json()) as {
      success?: boolean
      'error-codes'?: string[]
    }
    if (data.success) return { ok: true }
    console.warn('[turnstile] verification failed:', data['error-codes'])
    return {
      ok: false,
      error: 'Falló la verificación anti-spam. Recargá la página y probá de nuevo.',
    }
  } catch (err) {
    console.error('[turnstile] verify network error, fail-open:', err)
    return { ok: true }
  }
}
