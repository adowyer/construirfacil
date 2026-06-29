/**
 * lib/email/welcome.ts
 *
 * Mail de BIENVENIDA del proceso de postulación. Lo dispara la ruta /verify
 * (TS) cuando el lead confirma su registro pulsando "Verificar mi cuenta".
 * Una sola vez por lead (gateado por leads.welcome_sent_at).
 *
 * El mail de VERIFICACIÓN (primer touch, batch) NO vive acá: lo manda
 * scripts/send_engagement.py (Resend) — fuente única de esa copy.
 *
 * Misma config de Resend que lib/email/otp.ts (RESEND_API_KEY + RESEND_FROM_EMAIL).
 * Returns: { status: 'sent' | 'failed' | 'skipped', error: string | null }
 */

import { Resend } from 'resend'

const FROM_DEFAULT = 'ConstruirFácil <hola@construirfacil.com>'
const CONTACT_EMAIL = 'hola@construirfacil.com'
const WHATSAPP_URL = 'https://wa.me/5491166440000'
const LOGO_URL = 'https://www.construirfacil.com/cf_logo_gris.png'
const BRAND_RED = '#ff003d'

export type EmailResult = {
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

function greeting(name?: string | null): string {
  const n = name?.trim()
  return n ? `Hola ${n},` : 'Hola,'
}

/** Footer común: contacto + firma + (opcional) link de baja (Ley 25.326). */
function footer(unsubscribeUrl?: string): string {
  const unsub = unsubscribeUrl
    ? `<p style="font-size:11px;color:#9a9a9a;line-height:1.5;margin:18px 0 0;border-top:1px solid #ececec;padding-top:16px;">
         Si no querés seguir recibiendo correos, <a href="${unsubscribeUrl}" style="color:#9a9a9a;text-decoration:underline;">date de baja acá</a>.
       </p>`
    : ''
  return `<p style="font-size:14px;color:#555;line-height:1.6;margin:24px 0 0;">
      Por cualquier consulta o inconveniente también podés escribirnos a
      <a href="mailto:${CONTACT_EMAIL}" style="color:${BRAND_RED};">${CONTACT_EMAIL}</a>
      o por <a href="${WHATSAPP_URL}" style="color:${BRAND_RED};">WhatsApp</a>.
    </p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:16px 0 0;">Quedo atento.<br>Un saludo cordial,<br><strong>Construir Fácil</strong></p>
    ${unsub}`
}

/** Layout común: fondo gris, card blanca, logo arriba. */
function shell(inner: string): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f3;margin:0;padding:32px 0;color:#1a1a1a;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" align="center" style="background:#ffffff;border-radius:8px;padding:40px;">
    <tr><td>
      <img src="${LOGO_URL}" alt="Construir Fácil" width="150" style="max-width:150px;margin-bottom:28px;">
      ${inner}
    </td></tr>
  </table>
  <p style="font-size:11px;color:#bbb;text-align:center;margin:20px 0 0;">ConstruirFácil · La manera más fácil de construir</p>
</body></html>`
}

const P = 'font-size:15px;color:#222;line-height:1.6;margin:0 0 16px;'

function welcomeHtml(args: { name?: string | null; unsubscribeUrl?: string }): string {
  const steps = [
    'Firmar la RESERVA de tu nueva casa en una inmobiliaria o escribanía cercana.',
    'Abonar una SEÑA que se descontará del precio de la casa que compres.',
    'Reunir la documentación necesaria para tramitar el crédito.',
    'Buscar un terreno para construir tu casa, si aún no lo tenés.',
    'Definir las características de tu casa ideal.',
  ]
    .map((s) => `<li style="margin-bottom:8px;">${s}</li>`)
    .join('')

  const inner = `<p style="${P}">${greeting(args.name)} un gusto volver a conectar.</p>
    <p style="font-size:22px;color:#222;line-height:1.6;margin:0 0 16px;"><strong>¡Felicitaciones! Tu nueva casa ya está en marcha.</strong></p>
    <p style="${P}">Tu solicitud en <strong>Construir Fácil</strong> ya cuenta con los datos necesarios; ahora vamos a guiarte en los pasos siguientes:</p>
    <ol style="${P}padding-left:20px;">${steps}</ol>
    <p style="font-size:22px;color:#222;line-height:1.6;margin:0 0 16px;"><strong>A partir de mañana mismo, uno de nuestros asesores va a hacerte una breve llamada por WhatsApp.</strong></p>
    <p style="${P}">Si tenés un horario preferido, o un día en particular en que no puedas, avisanos por este medio. Si no, cuando recibas el contacto lo coordinás directamente con el asesor.</p>
    ${footer(args.unsubscribeUrl)}`

  return shell(inner)
}

export async function sendWelcomeEmail(args: {
  to: string
  name?: string | null
  unsubscribeUrl?: string
}): Promise<EmailResult> {
  const resend = resendClient()
  if (!resend) return { status: 'skipped', error: 'RESEND_API_KEY no configurada' }
  const n = args.name?.trim()
  const subject = `${n ? `${n}, ` : ''}Te damos la bienvenida a Construir Fácil`
  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: args.to,
      subject,
      html: welcomeHtml(args),
    })
    if (error) return { status: 'failed', error: error.message ?? 'unknown' }
    return { status: 'sent', error: null }
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) }
  }
}
