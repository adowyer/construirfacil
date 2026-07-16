/**
 * lib/auth/click-token.ts
 *
 * Token firmado para el tracking de clics en links de mails (/api/track/click).
 * Mismo patrón HMAC que `verify-token.ts` / `unsubscribe-token.ts`, con domain tag
 * propio ('click') para que las firmas NO sean intercambiables entre features:
 * un token de click no puede verificar un registro ni dar de baja a nadie.
 *
 * El token va en el link: /api/track/click?u=<leadId>.<hmac>&to=<path>.
 * El script de envío (send_engagement.py) firma con el MISMO secret.
 */
import { createHmac } from 'node:crypto'

function secret(): string {
  const s = process.env.CF_GATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!s) throw new Error('CF_GATE_SECRET / SUPABASE_SERVICE_ROLE_KEY no configurado')
  return s
}

const DOMAIN = 'click'

function sign(leadId: string): string {
  return createHmac('sha256', secret())
    .update(`${DOMAIN}:${leadId}`)
    .digest('hex')
    .slice(0, 32)
}

/** Token para el link de tracking. leadId = uuid del lead. */
export function clickToken(leadId: string): string {
  return `${leadId}.${sign(leadId)}`
}

/** Verifica el token. Devuelve el leadId si la firma es válida, null si no. */
export function verifyClickToken(raw: string | null | undefined): string | null {
  if (!raw) return null
  const parts = raw.split('.')
  if (parts.length !== 2) return null
  const [leadId, hmac] = parts
  if (!leadId || !hmac) return null
  if (sign(leadId) !== hmac) return null
  return leadId
}
