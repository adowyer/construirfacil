/**
 * lib/auth/verify-token.ts
 *
 * Token firmado para el link de verificación de registro (doble opt-in) de los
 * emails de postulación. Mismo patrón HMAC que `unsubscribe-token.ts`, con domain
 * tag propio ('verify') para que las firmas NO sean intercambiables entre features.
 *
 * El token va en el link: /verify?u=<leadId>.<hmac>. Sin firma válida no se
 * verifica a nadie (no se puede verificar a otro adivinando el id).
 *
 * El secret se resuelve igual que unsubscribe-token (CF_GATE_SECRET ||
 * SUPABASE_SERVICE_ROLE_KEY) — el script de envío firma con el MISMO secret para
 * generar el mismo token.
 */
import { createHmac } from 'node:crypto'
import { SITE_URL } from '@/lib/seo/site'

function secret(): string {
  const s = process.env.CF_GATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!s) throw new Error('CF_GATE_SECRET / SUPABASE_SERVICE_ROLE_KEY no configurado')
  return s
}

const DOMAIN = 'verify'

function sign(leadId: string): string {
  return createHmac('sha256', secret())
    .update(`${DOMAIN}:${leadId}`)
    .digest('hex')
    .slice(0, 32)
}

/** Token para el link de verificación. leadId = uuid del lead (sin puntos). */
export function verificationToken(leadId: string): string {
  return `${leadId}.${sign(leadId)}`
}

/** URL completa de verificación, lista para el botón del mail. */
export function verificationUrl(leadId: string): string {
  return `${SITE_URL}/verify?u=${verificationToken(leadId)}`
}

/** Verifica el token. Devuelve el leadId si la firma es válida, null si no. */
export function verifyVerificationToken(raw: string | null | undefined): string | null {
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [leadId, hmac] = parts
  if (!leadId || !hmac) return null
  if (sign(leadId) !== hmac) return null
  return leadId
}
