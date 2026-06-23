/**
 * app/unsubscribe/route.ts
 *
 * Baja (unsubscribe) one-click de los emails comerciales.
 *   GET  /unsubscribe?u=<token>  → da de baja + muestra una página de confirmación
 *                                  (el link visible en el footer del mail).
 *   POST /unsubscribe?u=<token>  → da de baja + 200 (RFC 8058 one-click; el botón
 *                                  nativo de Gmail hace este POST, sin que el usuario
 *                                  abra nada).
 *
 * Sin token válido → no se da de baja a nadie. Marca leads.unsubscribed=true; el
 * script de envío excluye unsubscribed. Idempotente.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyUnsubscribeToken } from '@/lib/auth/unsubscribe-token'

async function unsubscribe(leadId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('leads')
    .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
    .eq('id', leadId)
  return !error
}

function page(ok: boolean): string {
  const title = ok ? 'Listo, te diste de baja' : 'No pudimos procesar la baja'
  const msg = ok
    ? 'No vas a recibir más correos comerciales de Construir Fácil. Si fue un error, escribinos a hola@construirfacil.com.'
    : 'El enlace no es válido o expiró. Si querés darte de baja, escribinos a hola@construirfacil.com.'
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;color:#1a1a1a;text-align:center">
<img src="https://www.construirfacil.com/cf_logo_gris.png" alt="Construir Fácil" width="150" style="max-width:150px;margin-bottom:24px">
<h1 style="font-size:20px">${title}</h1>
<p style="color:#666;line-height:1.6">${msg}</p>
</body></html>`
}

export async function GET(request: NextRequest) {
  const leadId = verifyUnsubscribeToken(request.nextUrl.searchParams.get('u'))
  const ok = leadId ? await unsubscribe(leadId) : false
  return new NextResponse(page(ok), {
    status: ok ? 200 : 400,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

// RFC 8058 one-click: el cliente de mail hace POST (token en query o en el body).
export async function POST(request: NextRequest) {
  let token = request.nextUrl.searchParams.get('u')
  if (!token) {
    try {
      const body = await request.text()
      token = new URLSearchParams(body).get('u')
    } catch {
      /* sin body → token queda null */
    }
  }
  const leadId = verifyUnsubscribeToken(token)
  if (leadId) await unsubscribe(leadId)
  return new NextResponse(null, { status: 200 })
}
