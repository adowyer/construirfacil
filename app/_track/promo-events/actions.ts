'use server'

/**
 * app/_track/promo-events/actions.ts
 *
 * Server action minimal para escribir un evento de banner promo a
 * `promo_events`. Se llama desde el cliente al renderizar (impression) o
 * al clickear (click) un CatalogPromoBanner que tiene un promo_id real
 * (los hardcoded por cohorte no se trackean — no tienen id).
 *
 * NO throwea: el catálogo no debería romperse si el track falla.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export async function logPromoEvent(payload: {
  promo_id: string
  event: 'impression' | 'click'
  provincia_id: string | null
  tiene_lote: 'si' | 'no' | null
  user_agent: string | null
}): Promise<void> {
  if (!payload.promo_id) return
  try {
    const admin = createAdminClient()
    await admin.from('promo_events').insert({
      promo_id: payload.promo_id,
      event: payload.event,
      provincia_id: payload.provincia_id,
      tiene_lote: payload.tiene_lote,
      user_agent: payload.user_agent?.slice(0, 500) ?? null,
    })
  } catch (e) {
    // Telemetría debe ser silenciosa — no romper el catálogo por logging.
    console.error('[logPromoEvent] insert failed:', (e as Error).message)
  }
}
