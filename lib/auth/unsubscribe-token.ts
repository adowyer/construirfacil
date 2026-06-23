/**
 * lib/auth/unsubscribe-token.ts
 *
 * Token firmado para el link de baja (one-click) de los emails comerciales.
 * Mismo patrón HMAC que `session-cookie.ts`, con domain tag propio
 * ('unsubscribe') para que las firmas NO sean intercambiables entre features.
 *
 * El token va en el link: /unsubscribe?u=<leadId>.<hmac>. Sin firma válida no
 * se da de baja a nadie (no se puede dar de baja a otro adivinando el id).
 *
 * El secret se resuelve igual que session-cookie (CF_GATE_SECRET ||
 * SUPABASE_SERVICE_ROLE_KEY) — el script Python de envío firma con el MISMO
 * secret para generar el mismo token.
 */
import { createHmac } from 'node:crypto'

function secret(): string {
  const s = process.env.CF_GATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!s) throw new Error('CF_GATE_SECRET / SUPABASE_SERVICE_ROLE_KEY no configurado')
  return s
}

const DOMAIN = 'unsubscribe'

function sign(leadId: string): string {
  return createHmac('sha256', secret())
    .update(`${DOMAIN}:${leadId}`)
    .digest('hex')
    .slice(0, 32)
}

/** Token para el link de baja. leadId = uuid del lead (sin puntos). */
export function unsubscribeToken(leadId: string): string {
  return `${leadId}.${sign(leadId)}`
}

/** Verifica el token. Devuelve el leadId si la firma es válida, null si no. */
export function verifyUnsubscribeToken(raw: string | null | undefined): string | null {
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [leadId, hmac] = parts
  if (!leadId || !hmac) return null
  if (sign(leadId) !== hmac) return null
  return leadId
}
