/**
 * lib/auth/get-current-client.ts
 *
 * Helper SSR para leer el email del cliente verificado por el gate.
 * Devuelve null si no hay cookie válida → CatalogPage muestra el gate.
 * Si devuelve email → ya pasó OTP, mostrar catálogo.
 *
 * Admin / marcas (usuarios con cuenta Supabase normal) NO usan este
 * cookie — pasan derecho al catálogo aunque no lo tengan. La función
 * `currentClientEmail` solo identifica clientes públicos.
 */

import { cookies } from 'next/headers'
import { decodeGateCookie, GATE_COOKIE_CONFIG } from './gate-cookie'

export async function currentClientEmail(): Promise<string | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(GATE_COOKIE_CONFIG.name)?.value
  return decodeGateCookie(raw)
}
