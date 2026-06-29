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

type LeadRow = {
  id: string
  name: string | null
  email: string | null
  email_verified_at: string | null
  welcome_sent_at: string | null
  unsubscribed: boolean | null
}

/** Marca verificado + dispara bienvenida (una sola vez). Devuelve si todo OK. */
async function verifyLead(leadId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('leads')
    .select('id, name, email, email_verified_at, welcome_sent_at, unsubscribed')
    .eq('id', leadId)
    .maybeSingle()
  if (error || !data) return false
  const lead = data as LeadRow

  const now = new Date().toISOString()

  // Marca la verificación (idempotente: solo la primera vez fija el timestamp).
  if (!lead.email_verified_at) {
    await admin.from('leads').update({ email_verified_at: now }).eq('id', leadId)
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
  const ok = leadId ? await verifyLead(leadId) : false
  return new NextResponse(page(ok), {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
