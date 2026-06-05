/**
 * lib/email/otp.ts
 *
 * Envío del OTP de 4 dígitos para el auth gate del catálogo.
 * Usa la misma config de Resend que lib/email/lead.ts (RESEND_API_KEY +
 * RESEND_FROM_EMAIL). Template HTML minimalista: marca CF, código grande
 * centrado, validez explícita.
 *
 * Returns:
 *   { status: 'sent' | 'failed' | 'skipped', error: string | null }
 */

import { Resend } from 'resend'

const FROM_DEFAULT = 'ConstruirFácil <hola@construirfacil.com>'
const TTL_MIN = 10

export type OtpEmailResult = {
  status: 'sent' | 'failed' | 'skipped'
  error: string | null
}

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || FROM_DEFAULT
}

export async function sendOtpEmail(args: {
  to: string
  code: string
  name?: string | null
}): Promise<OtpEmailResult> {
  const resend = resendClient()
  if (!resend) return { status: 'skipped', error: 'RESEND_API_KEY no configurada' }

  const greeting = args.name?.trim() ? `Hola ${args.name.trim()},` : 'Hola,'

  const html = `<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; background:#f5f5f3; padding:32px;">
  <table width="480" cellpadding="0" cellspacing="0" align="center" style="background:#fff; padding:36px; border-radius:8px;">
    <tr><td>
      <p style="font-size:14px; color:#666; margin:0 0 24px;">${greeting}</p>
      <p style="font-size:14px; color:#222; line-height:1.5; margin:0 0 24px;">
        Para acceder al catálogo de ConstruirFácil, ingresá este código en la pantalla:
      </p>
      <p style="font-size:38px; font-weight:700; letter-spacing:0.3em; color:#ff003d; text-align:center; padding:24px 0; margin:0; font-family:monospace;">
        ${args.code}
      </p>
      <p style="font-size:12px; color:#999; text-align:center; margin:8px 0 24px;">
        Válido por ${TTL_MIN} minutos.
      </p>
      <p style="font-size:11px; color:#aaa; line-height:1.5; margin:0; border-top:1px solid #eee; padding-top:18px;">
        Si no fuiste vos, ignorá este mensaje. Tu email queda registrado en nuestra base solo si verificás el código.
      </p>
    </td></tr>
  </table>
  <p style="font-size:11px; color:#bbb; text-align:center; margin:20px 0 0;">
    ConstruirFácil · La manera más fácil de construir
  </p>
</body></html>`

  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: args.to,
      subject: `Tu código de acceso: ${args.code}`,
      html,
    })
    if (error) return { status: 'failed', error: error.message ?? 'unknown' }
    return { status: 'sent', error: null }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}
