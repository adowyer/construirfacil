/**
 * app/api/track/click/route.ts
 *
 * Tracking de clics en links de mails.
 *   GET /api/track/click?u=<token>&to=<path>  → valida el token firmado (dominio 'click'),
 *   registra el clic en lead_link_clicks y redirige al destino. La persona no nota nada.
 *
 * Guarantees (en código, no en promesas):
 *   - Sin firma válida NO se registra nada (pero se redirige igual: el link nunca "se rompe").
 *   - `to` solo acepta paths INTERNOS ('/…', nunca '//' ni esquemas) → sin open-redirect.
 *   - El log jamás bloquea la redirección: si el insert falla, la persona llega igual.
 *
 * Los mails de engagement (send_engagement.py) firman con el MISMO secret (ver click-token.ts).
 * Migración de la tabla: supabase/migrations/0096_lead_link_clicks.sql
 */
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyClickToken } from '@/lib/auth/click-token'
import { SITE_URL } from '@/lib/seo/site'

/** Solo paths internos: empieza con '/' único y sin backslashes (evita open-redirect). */
function safePath(raw: string | null): string {
  if (!raw) return '/'
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/'
  return raw
}

const MODEL_RE = /^\/modelos\/([a-z0-9-]+)/

export async function GET(request: NextRequest) {
  const to = safePath(request.nextUrl.searchParams.get('to'))
  const leadId = verifyClickToken(request.nextUrl.searchParams.get('u'))

  if (leadId) {
    try {
      const admin = createAdminClient()
      await admin.from('lead_link_clicks').insert({
        lead_id: leadId,
        target: to,
        model_slug: MODEL_RE.exec(to)?.[1] ?? null,
        channel: 'email',
      })
    } catch {
      /* el log nunca bloquea la redirección */
    }
  }

  return NextResponse.redirect(new URL(to, SITE_URL), 302)
}
