/**
 * lib/auth/get-current-client.ts
 *
 * Helper SSR para leer el email del cliente identificado. Acepta dos
 * cookies en orden de prioridad:
 *
 *   1) cf_client  → verificado por OTP o OAuth (alto)
 *   2) cf_session → emitida cuando el cliente envió un lead (medio)
 *
 * Devuelve null si no hay ninguna válida → CatalogPage muestra el gate.
 * Si devuelve un objeto → ya está identificado, no mostrar gate.
 *
 * Admin / marcas (usuarios con cuenta Supabase normal) NO usan este
 * cookie — pasan derecho al catálogo aunque no lo tengan.
 */

import { cookies } from 'next/headers'
import { decodeGateCookie, GATE_COOKIE_CONFIG } from './gate-cookie'
import { decodeSessionCookie, SESSION_COOKIE_CONFIG } from './session-cookie'

export type ClientSession = {
  email: string
  /** 'verified' = cookie cf_client (OTP/OAuth). 'lead' = cookie cf_session
   *  (form). Permite a features de alto valor exigir 'verified' si lo
   *  necesitan. */
  source: 'verified' | 'lead'
}

export async function currentClient(): Promise<ClientSession | null> {
  const cookieStore = await cookies()
  const gateRaw = cookieStore.get(GATE_COOKIE_CONFIG.name)?.value
  const verified = decodeGateCookie(gateRaw)
  if (verified) return { email: verified, source: 'verified' }
  const sessionRaw = cookieStore.get(SESSION_COOKIE_CONFIG.name)?.value
  const fromLead = decodeSessionCookie(sessionRaw)
  if (fromLead) return { email: fromLead, source: 'lead' }
  return null
}

/** Backward-compat: solo email, sin diferenciar source. Mantenemos para
 *  no romper callers existentes que no necesitan saber el origen. */
export async function currentClientEmail(): Promise<string | null> {
  return (await currentClient())?.email ?? null
}

/** Solo devuelve email si hay cookie cf_session (= envió un lead).
 *  Independiente del gate de OTP — un usuario verificado por OTP pero
 *  que NUNCA mandó un lead devuelve null acá. Sirve para que LeadForm /
 *  ReservarModal muestren success state ("ya tenemos tus datos") sin
 *  obligar al usuario a re-completar. */
export async function currentLeadEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE_CONFIG.name)?.value
  return decodeSessionCookie(raw)
}
