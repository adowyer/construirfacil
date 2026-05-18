/**
 * app/api/track/route.ts
 *
 * Beacon de primera-parte (Fase 3). Recibe señales del cliente
 * (lib/track/client.ts) y escribe el ledger `campaign_event` vía
 * service-role (RLS cerrada — tabla interna).
 *
 * Atribución resuelta server-side con lib/track/attribution.ts (la MISMA
 * lógica que el form de leads, para que no divergan):
 *   - campaign_slug: path /casa-financiada/<slug> o cookie cf_camp.
 *   - utm_*: query del primer hit; en landing_view se persiste en cf_utm
 *     (el catálogo abre in-place, sin recargar → el query no reaparece).
 *   - session_id: cookie cf_sid (anónima, httpOnly, no PII).
 *
 * Nunca rompe: cualquier error → 204 igual.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  parseUtm,
  hasUtm,
  resolveAttribution,
} from '@/lib/track/attribution'

const EVENTS = new Set([
  'landing_view',
  'model_open',
  'cotizar_open',
  'whatsapp_click',
  'lead',
])

const YEAR = 60 * 60 * 24 * 180 // cf_sid: 180 días
const MONTH = 60 * 60 * 24 * 30 // cf_camp / cf_utm: 30 días

export async function POST(request: NextRequest) {
  const res = new NextResponse(null, { status: 204 })

  try {
    const body = await request.json()
    const event = String(body?.event ?? '')
    if (!EVENTS.has(event)) return res

    const path = typeof body?.path === 'string' ? body.path : ''
    const search = typeof body?.search === 'string' ? body.search : ''
    const referrer =
      typeof body?.referrer === 'string' ? body.referrer.slice(0, 500) : null
    const meta =
      body?.meta && typeof body.meta === 'object' ? body.meta : null

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    }

    // ── session id ──────────────────────────────────────────────────
    let sid = request.cookies.get('cf_sid')?.value ?? ''
    if (!sid) {
      sid = crypto.randomUUID()
      res.cookies.set('cf_sid', sid, { ...cookieOpts, maxAge: YEAR })
    }

    // ── atribución (compartida con el form de leads) ────────────────
    const { campaign_slug, utm } = resolveAttribution({
      path,
      search,
      getCookie: (n) => request.cookies.get(n)?.value,
    })

    // En el primer hit persistimos slug + utm para los eventos siguientes.
    if (event === 'landing_view') {
      if (campaign_slug) {
        res.cookies.set('cf_camp', campaign_slug, {
          ...cookieOpts,
          maxAge: MONTH,
        })
      }
      const fresh = parseUtm(search)
      if (hasUtm(fresh)) {
        res.cookies.set('cf_utm', JSON.stringify(fresh), {
          ...cookieOpts,
          maxAge: MONTH,
        })
      }
    }

    const admin = createAdminClient()
    await admin.from('campaign_event').insert({
      campaign_slug,
      session_id: sid,
      event_type: event,
      ...utm,
      referrer,
      path: path || null,
      meta,
    })
  } catch {
    /* tragamos todo: el beacon nunca devuelve error al cliente */
  }

  return res
}
