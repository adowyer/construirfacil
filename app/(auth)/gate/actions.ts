'use server'

/**
 * app/(auth)/gate/actions.ts
 *
 * Server Actions del auth gate del catálogo. Compartidas con el flow de
 * Ximia (n8n) via tabla `users` (FK email UNIQUE).
 *
 * Flow:
 *   1) requestOTP({ email, name })  → upsert users + genera código de 4
 *      dígitos + lo guarda en email_verifications con TTL 10 min + manda
 *      mail via Resend.
 *   2) verifyOTP({ email, code })   → valida code + TTL + rate limit;
 *      si VALID: marca users.email_verified_at, setea cookie HTTP-only
 *      firmada con HMAC y devuelve { ok: true }.
 */

import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOtpEmail } from '@/lib/email/otp'
import { encodeGateCookie, GATE_COOKIE_CONFIG } from '@/lib/auth/gate-cookie'
import { emitEngagementEvent } from '@/lib/engagement/emit-event'

const OTP_TTL_MIN = 10
const OTP_MAX_ATTEMPTS = 3

export type OtpResult =
  | { ok: true }
  | { ok: false; error: string; code?: 'rate_limited' }

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function generateCode(): string {
  // 4 dígitos, 0000-9999. Math.random alcanza para anti-bruteforce porque
  // hay rate limit en otp_attempts.
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0')
}

export async function requestOTP(args: {
  email: string
  name: string
}): Promise<OtpResult> {
  const email = args.email.trim().toLowerCase()
  const name = args.name.trim()

  if (!isValidEmail(email)) {
    return { ok: false, error: 'Ese email no parece válido. Revisalo y probá de nuevo.' }
  }
  if (!name) {
    return { ok: false, error: 'Decinos tu nombre para identificarte.' }
  }

  const sb = createAdminClient()

  // 1) Resolver la identidad canónica (mismo resolvedor que usan Ximia y el OCR
  //    UOCRA). Crea/encuentra UNA fila en users y colapsa duplicados si un
  //    identificador los cruza. Acá sólo hay email (el DNI llega más tarde, en
  //    el cálculo financiero) → crea/encuentra por email.
  const { error: resolveErr } = await sb.rpc('resolve_user', {
    p_email: email,
    p_name: name,
    p_source: 'catalog',
  })
  if (resolveErr) {
    console.error('[requestOTP] resolve_user:', resolveErr.message)
    return { ok: false, error: 'No pudimos guardar tu registro. Probá de nuevo.' }
  }
  // Marca intención (warm) — igual que antes.
  await sb.from('users').update({ lead_status: 'warm' }).eq('email', email)

  // 2) Generar código + guardar en email_verifications con TTL.
  const code = generateCode()
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60 * 1000).toISOString()
  const h = await headers()
  const ip = h.get('x-forwarded-for') || h.get('x-real-ip') || null
  const ua = h.get('user-agent') || null

  const { error: insErr } = await sb.from('email_verifications').insert({
    email,
    code,
    expires_at: expiresAt,
    ip,
    user_agent: ua,
  })
  if (insErr) {
    console.error('[requestOTP] insert email_verifications:', insErr.message)
    return { ok: false, error: 'No pudimos generar tu código. Probá de nuevo.' }
  }

  // 3) Enviar mail.
  const mail = await sendOtpEmail({ to: email, code, name })
  if (mail.status === 'failed') {
    console.error('[requestOTP] mail send failed:', mail.error)
    return { ok: false, error: 'No pudimos enviar el código a tu email. Revisalo y probá de nuevo.' }
  }
  // status 'skipped' = RESEND_API_KEY no configurada. En dev: ok igual,
  // la user puede leer el code de la DB. Loggeamos warning.
  if (mail.status === 'skipped') {
    console.warn('[requestOTP] RESEND_API_KEY no configurada — code:', code)
  }

  return { ok: true }
}

export async function verifyOTP(args: {
  email: string
  code: string
}): Promise<OtpResult> {
  const email = args.email.trim().toLowerCase()
  const code = args.code.trim()

  if (!isValidEmail(email)) {
    return { ok: false, error: 'Ese email no parece válido. Revisalo y probá de nuevo.' }
  }
  if (!/^\d{4}$/.test(code)) {
    return { ok: false, error: 'El código debe ser de 4 dígitos.' }
  }

  const sb = createAdminClient()

  // Último OTP activo (no usado, no expirado) para ese email.
  const { data: rows, error: selErr } = await sb
    .from('email_verifications')
    .select('id, code, expires_at, attempts, used_at')
    .eq('email', email)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (selErr) {
    console.error('[verifyOTP] select:', selErr.message)
    return { ok: false, error: 'Error verificando código.' }
  }
  const row = rows?.[0]
  if (!row) {
    return { ok: false, error: 'No hay un código activo. Pedí uno nuevo.' }
  }

  // Expiry check.
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, error: 'El código venció. Pedí uno nuevo.' }
  }

  // Rate limit. `code: 'rate_limited'` permite al cliente reaccionar (habilitar
  // el botón "Pedir un código nuevo" bypaseando el cooldown del Reenviar).
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      error: 'Llegaste al máximo de intentos. Pedí un código nuevo abajo.',
      code: 'rate_limited',
    }
  }

  const matches = row.code === code

  // Bump attempts SIEMPRE (también en intento correcto, da igual; ayuda a
  // detectar abuso si después se mira la tabla).
  await sb
    .from('email_verifications')
    .update({
      attempts: row.attempts + 1,
      used_at: matches ? new Date().toISOString() : null,
    })
    .eq('id', row.id)

  if (!matches) {
    const remaining = OTP_MAX_ATTEMPTS - (row.attempts + 1)
    if (remaining > 0) {
      return {
        ok: false,
        error: `Código incorrecto. Te ${remaining === 1 ? 'queda 1 intento' : `quedan ${remaining} intentos`}.`,
      }
    }
    return {
      ok: false,
      error: 'Llegaste al máximo de intentos. Pedí un código nuevo abajo.',
      code: 'rate_limited',
    }
  }

  // 1) Marcar users.email_verified_at + last_seen_at.
  await sb
    .from('users')
    .update({
      email_verified_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq('email', email)

  // 2) Cookie HTTP-only con el email firmado.
  const cookieStore = await cookies()
  cookieStore.set(GATE_COOKIE_CONFIG.name, encodeGateCookie(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GATE_COOKIE_CONFIG.maxAgeSeconds,
    path: '/',
  })

  // Segmento A: un curioso se registró (verificó OTP) → avisamos a n8n para
  // arrancar bienvenida/nurture. Best-effort: nunca rompe el verify.
  await emitEngagementEvent({ event: 'otp_verified', email, source: 'catalog' })

  return { ok: true }
}
