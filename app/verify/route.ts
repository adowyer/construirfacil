/**
 * app/verify/route.ts
 *
 * Verificación de registro (doble opt-in) del proceso de postulación.
 *   GET /verify?u=<token>  → valida el token firmado, marca el lead como
 *                            verificado y dispara el mail de bienvenida (una vez).
 *
 * Sin token válido → no se verifica a nadie. Idempotente: re-clickear no
 * reenvía la bienvenida (gateada por welcome_sent_at).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyVerificationToken } from '@/lib/auth/verify-token'
import { unsubscribeToken } from '@/lib/auth/unsubscribe-token'
import { SITE_URL } from '@/lib/seo/site'
import { sendWelcomeEmail } from '@/lib/email/welcome'
import { emitEngagementEvent } from '@/lib/engagement/emit-event'

type LeadRow = {
  id: string
  name: string | null
  email: string | null
  source: string | null
  email_verified_at: string | null
  welcome_sent_at: string | null
  unsubscribed: boolean | null
}

type VerifiedChannel = 'email' | 'whatsapp'

/** Marca verificado + dispara bienvenida (una sola vez). Devuelve si todo OK. */
async function verifyLead(leadId: string, channel: VerifiedChannel): Promise<boolean> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('leads')
    .select('id, name, email, source, email_verified_at, welcome_sent_at, unsubscribed')
    .eq('id', leadId)
    .maybeSingle()
  if (error || !data) return false
  const lead = data as LeadRow

  const now = new Date().toISOString()

  // Marca la verificación (idempotente: solo la primera vez fija el timestamp).
  // El evento se emite DENTRO del if: re-clickear el link no vuelve a disparar
  // n8n (n8n se paga por ejecución — ver CLAUDE.md, regla de créditos).
  if (!lead.email_verified_at) {
    // `verified_channel` se fija en el MISMO update que el timestamp: los dos
    // describen el mismo hecho y no pueden quedar desfasados (migración 0109).
    await admin
      .from('leads')
      .update({ email_verified_at: now, verified_channel: channel })
      .eq('id', leadId)
    await emitEngagementEvent({
      event: 'lead_verified',
      lead_id: leadId,
      email: lead.email,
      source: lead.source ?? 'unknown',
      verified_at: now,
      channel,
    })
  }

  // Dispara la bienvenida una sola vez, si hay email y no se dio de baja.
  if (!lead.welcome_sent_at && lead.email && !lead.unsubscribed) {
    const res = await sendWelcomeEmail({
      to: lead.email,
      name: lead.name?.split(' ')[0] ?? null, // primer nombre, igual que el mail de verificación
      unsubscribeUrl: `${SITE_URL}/unsubscribe?u=${unsubscribeToken(leadId)}`,
    })
    if (res.status === 'sent') {
      await admin.from('leads').update({ welcome_sent_at: now }).eq('id', leadId)
    }
  }

  return true
}

function page(ok: boolean): string {
  const title = ok ? '¡Listo! Verificamos tu registro' : 'No pudimos verificar tu registro'
  const msg = ok
    ? 'Tu postulación ya está confirmada. En breve te llega un correo de bienvenida con los próximos pasos, y un asesor te va a contactar por WhatsApp. ¡Gracias por elegir Construir Fácil!'
    : 'El enlace no es válido o expiró. Si necesitás ayuda, escribinos a hola@construirfacil.com.'
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#1a1a1a;text-align:center">
<img src="https://www.construirfacil.com/cf_logo_gris.png" alt="Construir Fácil" width="150" style="max-width:150px;margin-bottom:24px">
<h1 style="font-size:20px">${title}</h1>
<p style="color:#666;line-height:1.6">${msg}</p>
</body></html>`
}

export async function GET(request: NextRequest) {
  const leadId = verifyVerificationToken(request.nextUrl.searchParams.get('u'))
  // ?c=wa lo pone el botón de la plantilla de WhatsApp. Va ANTES de ?u= porque
  // Meta exige que la variable del botón quede al final de la URL.
  // Cualquier otro valor (o ninguno) = el link del mail, que es el caso histórico.
  const channel: VerifiedChannel =
    request.nextUrl.searchParams.get('c') === 'wa' ? 'whatsapp' : 'email'
  const ok = leadId ? await verifyLead(leadId, channel) : false
  return new NextResponse(page(ok), {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
