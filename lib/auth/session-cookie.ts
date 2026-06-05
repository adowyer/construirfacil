/**
 * lib/auth/session-cookie.ts
 *
 * Cookie HTTP-only firmada que se emite cuando un visitante envía un lead
 * (form "Quiero esta casa", "Quiero casa + lote", contacto, waitlist).
 *
 * Paralela a `cf_client` (la del OTP/OAuth verified). Para el gate, ambas
 * cuentan como "identificado". La diferencia es la fuerza de la prueba:
 *
 *   cf_client   → email verificado por OTP o Google (alto)
 *   cf_session  → email enviado en un lead form (medio — no verificado
 *                 pero el visitante voluntariamente dio sus datos)
 *
 * Para features de alto valor (descarga de planos PDF, datos exactos de
 * financiación) podemos exigir cf_client puntualmente. Para el catálogo
 * libre, ambas alcanzan.
 */

import { createHmac } from 'node:crypto'

const COOKIE_NAME = 'cf_session'
const MAX_AGE_DAYS = 30
const SEPARATOR = '|'

function secret(): string {
  const s =
    process.env.CF_GATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  if (!s) throw new Error('CF_GATE_SECRET / SUPABASE_SERVICE_ROLE_KEY no configurado')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex').slice(0, 32)
}

/** Encode: "email|hmac" — misma estructura que la cookie del gate. */
export function encodeSessionCookie(email: string): string {
  const e = email.trim().toLowerCase()
  return `${e}${SEPARATOR}${sign(e)}`
}

/** Decode + verify. Returns email if signature is valid, null otherwise. */
export function decodeSessionCookie(raw: string | undefined | null): string | null {
  if (!raw) return null
  const parts = raw.split(SEPARATOR)
  if (parts.length !== 2) return null
  const [email, hmac] = parts
  if (!email || !hmac) return null
  const expected = sign(email)
  if (expected !== hmac) return null
  return email
}

export const SESSION_COOKIE_CONFIG = {
  name: COOKIE_NAME,
  maxAgeSeconds: 60 * 60 * 24 * MAX_AGE_DAYS,
}
