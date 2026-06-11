/**
 * lib/email/lead.ts
 *
 * Envío de emails del lead "Quiero esta casa" — uno a la marca (lead in)
 * y uno al cliente como confirmación. Se llama desde el server action que
 * registra el lead, DESPUÉS del insert exitoso (así no perdemos el lead
 * aunque el mail falle — el reintento queda para un worker que escanea
 * `leads.notification_status = 'failed'`).
 *
 * Envs requeridas:
 *   RESEND_API_KEY        → de https://resend.com (free tier alcanza)
 *   RESEND_FROM_EMAIL     → "ConstruirFácil <noreply@construirfacil.com>"
 *                           Debe ser un dominio verificado en Resend.
 *                           Default: "onboarding@resend.dev" (sandbox).
 */

import { Resend } from 'resend'

const FROM_DEFAULT = 'ConstruirFácil <onboarding@resend.dev>'

export interface LeadEmailPayload {
  /** Tipo de lead — el copy de marca y cliente varía. Default mantiene compat
   *  con callers viejos que no pasen este campo. */
  leadType?: 'quiero_esta_casa' | 'waitlist_provincia'

  // Cliente
  clientName: string
  clientPhone: string
  clientEmail: string | null
  clientMessage: string | null

  // Casa
  marcaName: string
  modelDisplayName: string
  lineaName: string | null
  variante: string | null
  sistemaConstructivo: string | null

  // Precio (opcional — solo si la marca publica)
  precioDesdeUsd: number | null
  cuotaArs: number | null

  // Geo
  /** Texto libre del campo "Localidad" del form (ej. "Rincón de los Sauces").
   *  Crítico para ventas: el "dónde" granular dentro de la provincia. */
  localidad: string | null
  provinciaName: string | null

  // Calificación (migración 0071) — opcionales en el tipo para compat con
  // callers viejos; en el flujo "Quiero esta casa" son 'si'/'no', '3m'/'6m'/'1y',
  // y rango de ARS respectivamente.
  tieneLote?: 'si' | 'no' | null
  timeframe?: '3m' | '6m' | '1y' | null
  /** Código de rango: 'none' | 'lt_10m' | '10m_30m' | '30m_60m' | '60m_plus'. */
  ahorroArsRange?: string | null

  // Destinos
  toMarca: string | null   // marca.lead_notification_email
  toClient: string | null  // = clientEmail si se cargó
}

export type LeadEmailResult = {
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

function fmtUsd(n: number | null): string {
  if (n == null) return '—'
  return `USD ${Math.round(n).toLocaleString('es-AR')}`
}

function fmtArs(n: number | null): string {
  if (n == null) return '—'
  return `$ ${Math.round(n).toLocaleString('es-AR')} / mes`
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c] ?? c,
  )
}

/** Etiqueta humana para el rango de ahorro persistido como código. */
function ahorroLabel(code: string | null | undefined): string | null {
  switch (code) {
    case 'none': return 'Aún no'
    case 'lt_10m': return 'Menos de $10 millones'
    case '10m_30m': return 'Entre $10 y $30 millones'
    case '30m_60m': return 'Entre $30 y $60 millones'
    case '60m_plus': return 'Más de $60 millones'
    default: return null
  }
}

function timeframeLabel(code: '3m' | '6m' | '1y' | null | undefined): string | null {
  if (code === '3m') return '3 meses'
  if (code === '6m') return '6 meses'
  if (code === '1y') return '1 año'
  return null
}

function summaryRows(p: LeadEmailPayload): string {
  const rows: [string, string][] = [
    ['Marca', p.marcaName],
    ['Modelo', p.modelDisplayName],
  ]
  if (p.lineaName) rows.push(['Línea', p.lineaName])
  if (p.variante) rows.push(['Variante', p.variante])
  if (p.sistemaConstructivo)
    rows.push(['Sistema constructivo', p.sistemaConstructivo])
  if (p.provinciaName) rows.push(['Provincia', p.provinciaName])
  if (p.localidad) rows.push(['Localidad', p.localidad])
  if (p.tieneLote) rows.push(['Tiene terreno', p.tieneLote === 'si' ? 'Sí' : 'No'])
  const tf = timeframeLabel(p.timeframe)
  if (tf) rows.push(['Plazo deseado', tf])
  const ahorro = ahorroLabel(p.ahorroArsRange)
  if (ahorro) rows.push(['Ahorro disponible', ahorro])
  if (p.precioDesdeUsd != null)
    rows.push(['Precio desde', fmtUsd(p.precioDesdeUsd)])
  if (p.cuotaArs != null) rows.push(['Cuota estimada', fmtArs(p.cuotaArs)])
  return rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">${esc(k)}</td><td style="padding:6px 0;font-weight:600;font-size:14px;">${esc(v)}</td></tr>`,
    )
    .join('')
}

function emailToMarcaWaitlist(p: LeadEmailPayload): { subject: string; html: string } {
  const prov = p.provinciaName ?? 'una provincia sin programa activo'
  const subject = `Waitlist — ${esc(p.marcaName)} en ${esc(prov)}`
  const phoneRow = p.clientPhone
    ? `<tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">WhatsApp</td><td style="padding:6px 0;font-weight:600;font-size:14px;"><a href="https://wa.me/${esc(p.clientPhone.replace(/[^0-9]/g, ''))}" style="color:#0a0a0a;text-decoration:none;">${esc(p.clientPhone)}</a></td></tr>`
    : ''
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f6f6;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f6f6;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 16px;border-bottom:1px solid #eee;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#ff003d;font-weight:700;">Waitlist — ConstruirFácil</p>
          <h1 style="margin:0;font-size:22px;color:#0a0a0a;font-weight:700;">Interés en ${esc(p.marcaName)} desde ${esc(prov)}</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#555;line-height:1.5;">${esc(prov)} no tiene programa activo de ${esc(p.marcaName)} todavía. Esta persona dejó su contacto para ser notificada cuando abran cupo en su zona.</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#999;font-weight:600;">Contacto</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">Nombre</td><td style="padding:6px 0;font-weight:600;font-size:14px;">${esc(p.clientName)}</td></tr>
            ${p.clientEmail ? `<tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">Email</td><td style="padding:6px 0;font-weight:600;font-size:14px;"><a href="mailto:${esc(p.clientEmail)}" style="color:#0a0a0a;text-decoration:none;">${esc(p.clientEmail)}</a></td></tr>` : ''}
            ${phoneRow}
            ${p.provinciaName ? `<tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">Provincia</td><td style="padding:6px 0;font-weight:600;font-size:14px;">${esc(p.provinciaName)}</td></tr>` : ''}
            ${p.localidad ? `<tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">Localidad</td><td style="padding:6px 0;font-weight:600;font-size:14px;">${esc(p.localidad)}</td></tr>` : ''}
            ${p.modelDisplayName && p.modelDisplayName !== 'CASA' ? `<tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">Estaba viendo</td><td style="padding:6px 0;font-weight:600;font-size:14px;">${esc(p.modelDisplayName)}</td></tr>` : ''}
          </table>
          ${p.clientMessage ? `<p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#999;font-weight:600;">Mensaje</p><p style="margin:0;padding:14px 16px;background:#f5f5f5;border-radius:8px;font-size:14px;color:#0a0a0a;line-height:1.5;">${esc(p.clientMessage)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8f8f8;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#888;">Esto es un lead de WAITLIST, no compra inmediata. Cuando se acumulen suficientes interesados en la misma provincia podría justificarse abrir cupo.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html }
}

function emailToMarca(p: LeadEmailPayload): { subject: string; html: string } {
  if (p.leadType === 'waitlist_provincia') return emailToMarcaWaitlist(p)
  const subject = `Nuevo lead — Quiero esta casa · ${p.modelDisplayName}`
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f6f6;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f6f6;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 16px;border-bottom:1px solid #eee;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#ff003d;font-weight:700;">Nuevo lead — ConstruirFácil</p>
          <h1 style="margin:0;font-size:22px;color:#0a0a0a;font-weight:700;">Alguien quiere ${esc(p.modelDisplayName)}</h1>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#999;font-weight:600;">Contacto</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
            <tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">Nombre</td><td style="padding:6px 0;font-weight:600;font-size:14px;">${esc(p.clientName)}</td></tr>
            <tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">Teléfono</td><td style="padding:6px 0;font-weight:600;font-size:14px;"><a href="tel:${esc(p.clientPhone)}" style="color:#0a0a0a;text-decoration:none;">${esc(p.clientPhone)}</a></td></tr>
            ${p.clientEmail ? `<tr><td style="padding:6px 14px 6px 0;color:#666;font-size:13px;">Email</td><td style="padding:6px 0;font-weight:600;font-size:14px;"><a href="mailto:${esc(p.clientEmail)}" style="color:#0a0a0a;text-decoration:none;">${esc(p.clientEmail)}</a></td></tr>` : ''}
          </table>
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#999;font-weight:600;">La casa que pidió</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">${summaryRows(p)}</table>
          ${p.clientMessage ? `<p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#999;font-weight:600;">Mensaje</p><p style="margin:0;padding:14px 16px;background:#f5f5f5;border-radius:8px;font-size:14px;color:#0a0a0a;line-height:1.5;">${esc(p.clientMessage)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f8f8f8;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#888;">Recibido vía construirfacil.com — el cliente espera respuesta en las próximas horas.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html }
}

function emailToClientWaitlist(p: LeadEmailPayload): { subject: string; html: string } {
  const prov = p.provinciaName ?? 'tu provincia'
  const subject = `Te avisamos cuando ${p.marcaName} llegue a ${prov}`
  const firstName = esc(p.clientName.split(' ')[0])
  const phonePromise = p.clientPhone
    ? `<p style="margin:0 0 14px;font-size:14px;color:#555;line-height:1.6;">También te vamos a avisar por WhatsApp cuando haya <strong>promociones de lanzamiento</strong> en ${esc(prov)}.</p>`
    : ''
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f6f6;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f6f6;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#ff003d;font-weight:700;">ConstruirFácil</p>
          <h1 style="margin:0 0 10px;font-size:22px;color:#0a0a0a;font-weight:700;">¡Gracias ${firstName}!</h1>
          <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.55;">Anotamos tu interés en <strong>${esc(p.marcaName)}</strong>. Por ahora la marca no opera en ${esc(prov)}, pero <strong>te vamos a contactar apenas haya novedades</strong> sobre apertura de cupos en tu zona.</p>
          ${phonePromise}
        </td></tr>
        <tr><td style="padding:0 32px 16px;">
          <p style="margin:0;padding:14px 16px;background:#f5f5f5;border-radius:8px;font-size:13px;color:#555;line-height:1.5;">Mientras tanto, podés seguir explorando el catálogo y conversar con Ximia (nuestro asistente) por alternativas equivalentes en tu zona.</p>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;background:#f8f8f8;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">Si no fuiste vos, podés ignorar este mail. Para cualquier consulta respondé a este mensaje.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html }
}

function emailToClient(p: LeadEmailPayload): { subject: string; html: string } {
  if (p.leadType === 'waitlist_provincia') return emailToClientWaitlist(p)
  const subject = `Recibimos tu interés en ${p.modelDisplayName}`
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f6f6;font-family:system-ui,-apple-system,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f6f6f6;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="padding:28px 32px 8px;">
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#ff003d;font-weight:700;">ConstruirFácil</p>
          <h1 style="margin:0 0 10px;font-size:22px;color:#0a0a0a;font-weight:700;">¡Recibimos tu consulta, ${esc(p.clientName.split(' ')[0])}!</h1>
          <p style="margin:0 0 18px;font-size:15px;color:#444;line-height:1.55;">Le pasamos tus datos a <strong>${esc(p.marcaName)}</strong> — te van a contactar en las próximas horas para coordinar los próximos pasos.</p>
        </td></tr>
        <tr><td style="padding:0 32px 16px;">
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#999;font-weight:600;">Esto es lo que pediste</p>
          <table role="presentation" cellpadding="0" cellspacing="0">${summaryRows(p)}</table>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;background:#f8f8f8;border-top:1px solid #eee;margin-top:20px;">
          <p style="margin:0;font-size:12px;color:#888;line-height:1.5;">Si no fuiste vos, podés ignorar este mail. Para cualquier consulta respondé a este mensaje.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject, html }
}

/**
 * Envía los mails del lead. NO throwea: devuelve un status para que el caller
 * decida si actualizar `leads.notification_status` a 'sent' / 'failed' / 'skipped'.
 *
 *   skipped → RESEND_API_KEY no está seteado (caso dev/staging) o no hay
 *             destinatarios (ni marca ni cliente).
 *   failed  → Resend devolvió error en al menos uno; el otro pudo haberse
 *             enviado. Logueamos el detalle en `error`.
 *   sent    → todos los destinatarios resueltos recibieron OK.
 */
export async function sendLeadEmail(
  payload: LeadEmailPayload,
): Promise<LeadEmailResult> {
  const client = resendClient()
  if (!client) {
    return { status: 'skipped', error: 'RESEND_API_KEY no configurada' }
  }
  const destinations = [payload.toMarca, payload.toClient].filter(
    (x): x is string => !!x && x.length > 3,
  )
  if (destinations.length === 0) {
    return { status: 'skipped', error: 'Sin destinatarios (ni marca ni cliente)' }
  }

  const from = fromAddress()
  const errors: string[] = []

  // Mail a la marca
  if (payload.toMarca) {
    const { subject, html } = emailToMarca(payload)
    try {
      const { error } = await client.emails.send({
        from,
        to: [payload.toMarca],
        subject,
        html,
        replyTo: payload.clientEmail ?? undefined,
      })
      if (error) errors.push(`marca: ${error.message}`)
    } catch (e) {
      errors.push(`marca: ${(e as Error).message}`)
    }
  }

  // Mail al cliente (confirmación)
  if (payload.toClient) {
    const { subject, html } = emailToClient(payload)
    try {
      const { error } = await client.emails.send({
        from,
        to: [payload.toClient],
        subject,
        html,
      })
      if (error) errors.push(`cliente: ${error.message}`)
    } catch (e) {
      errors.push(`cliente: ${(e as Error).message}`)
    }
  }

  if (errors.length === 0) return { status: 'sent', error: null }
  return { status: 'failed', error: errors.join(' · ') }
}
