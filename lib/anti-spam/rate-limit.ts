/**
 * lib/anti-spam/rate-limit.ts
 *
 * Rate-limit para submitLead (Quiero esta casa + waitlist_provincia).
 * Usa `public.form_rate_limits` (migración 0098). Dos ventanas complementarias:
 *
 *   IP    → máx 5 submits / hora  (ataques de un solo origen)
 *   Email → máx 3 submits / día   (email spray hacia distintos leads)
 *
 * Fail-open: si la DB no responde, dejamos pasar. Nunca queremos que un
 * glitch de Supabase corte la captura de leads reales.
 *
 * Race: no atomizamos "check+bump" (no hay RPC dedicada); bajo alta
 * concurrencia legítima el contador puede quedar levemente subestimado.
 * Aceptable para un rate-limit — el objetivo es cortar spam en volumen,
 * no ser exacto.
 */

import { createAdminClient } from '@/lib/supabase/admin'

const IP_HOURLY_LIMIT = 5
const EMAIL_DAILY_LIMIT = 3

function ipHourBucket(ip: string, now = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  const h = String(now.getUTCHours()).padStart(2, '0')
  return `ip:${ip}:h:${y}${m}${d}${h}`
}

function emailDayBucket(email: string, now = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `email:${email.toLowerCase()}:d:${y}${m}${d}`
}

export type RateLimitReason = 'ip_hourly' | 'email_daily'

export interface RateLimitResult {
  allowed: boolean
  reason?: RateLimitReason
}

export async function checkAndBumpLeadRateLimit(args: {
  ip: string | null
  email: string
}): Promise<RateLimitResult> {
  const admin = createAdminClient()
  const buckets: Array<{ key: string; limit: number; reason: RateLimitReason }> = []
  if (args.ip) {
    buckets.push({ key: ipHourBucket(args.ip), limit: IP_HOURLY_LIMIT, reason: 'ip_hourly' })
  }
  buckets.push({
    key: emailDayBucket(args.email),
    limit: EMAIL_DAILY_LIMIT,
    reason: 'email_daily',
  })

  for (const b of buckets) {
    try {
      const { data: row } = await admin
        .from('form_rate_limits')
        .select('count')
        .eq('bucket_key', b.key)
        .maybeSingle()

      const current = row?.count ?? 0
      if (current >= b.limit) {
        return { allowed: false, reason: b.reason }
      }

      await admin
        .from('form_rate_limits')
        .upsert(
          {
            bucket_key: b.key,
            count: current + 1,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'bucket_key' },
        )
    } catch (err) {
      console.error('[rate-limit] fail-open:', err)
    }
  }

  return { allowed: true }
}
