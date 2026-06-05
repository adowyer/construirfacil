/**
 * lib/auth/gate-cookie.ts
 *
 * Helpers de cookie del auth gate del catálogo. Cookie HTTP-only firmada
 * con HMAC para evitar tampering (el cliente no puede inventar un email).
 * El secret se deriva del SUPABASE_SERVICE_ROLE_KEY (server-only) — para
 * un proyecto productivo, definir CF_GATE_SECRET aparte.
 */

import { createHmac } from 'node:crypto'

const COOKIE_NAME = 'cf_client'
const MAX_AGE_DAYS = 60
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

/** Encode: "email|hmac" */
export function encodeGateCookie(email: string): string {
  const e = email.trim().toLowerCase()
  return `${e}${SEPARATOR}${sign(e)}`
}

/** Decode + verify. Returns email if signature is valid, null otherwise. */
export function decodeGateCookie(raw: string | undefined | null): string | null {
  if (!raw) return null
  const parts = raw.split(SEPARATOR)
  if (parts.length !== 2) return null
  const [email, hmac] = parts
  if (!email || !hmac) return null
  const expected = sign(email)
  if (expected !== hmac) return null
  return email
}

export const GATE_COOKIE_CONFIG = {
  name: COOKIE_NAME,
  maxAgeSeconds: 60 * 60 * 24 * MAX_AGE_DAYS,
}
