/**
 * lib/content/cotizador-data.ts
 *
 * Resuelve, server-side, lo que el selector Uber necesita para mostrar el
 * precio total por tramo. La cuota mensual se retiró del flujo (era
 * engañosa: depende de bancos, anticipo y precalificación). El motor
 * francés y la tabla `banks_financing` quedan en el código (lib/pricing/cuota)
 * para el día que un proveedor con financiación 100% propia los necesite,
 * pero NO se cargan acá → request más liviano.
 *
 *  - tiers: los 3 tramos (display, lectura pública).
 *  - caveat: legalese (UVA / estimado / sujeto a precalificación) — saneado.
 *  - baseSlotByMarca: qué columna de precio es el "base" de cada marca
 *    (el sugerido sobre el que aplica el tramo). Degrada a 'lista'.
 *
 * Resiliente: cualquier fallo → bag con tiers=[] (la UI cae al CTA mailto
 * de siempre, cero regresión).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getPricingTiers, getPricingConfig } from '@/lib/supabase/queries/pricing_tiers'
import type { PriceSlotKey } from '@/lib/supabase/queries/marca_price_slot'

export interface CotizadorTier {
  key: string
  label: string
  lead_time_label: string | null
  price_modifier_pct: number
  highlighted: boolean
  sort_order: number
}

export interface CotizadorData {
  tiers: CotizadorTier[]
  caveatHtml: string | null
  baseSlotByMarca: Record<string, PriceSlotKey>
}

export const EMPTY_COTIZADOR: CotizadorData = {
  tiers: [],
  caveatHtml: null,
  baseSlotByMarca: {},
}

export async function loadCotizadorData(
  supabase: SupabaseClient,
): Promise<CotizadorData> {
  try {
    const [tiers, config] = await Promise.all([
      getPricingTiers(supabase),
      getPricingConfig(supabase),
    ])

    // Slot base por marca (is_base). Degrada a 'lista' en la UI si falta.
    const baseSlotByMarca: Record<string, PriceSlotKey> = {}
    const { data: slots, error: slotErr } = await supabase
      .from('marca_price_slot')
      .select('marca_id, slot_key')
      .eq('is_base', true)
    if (slotErr) {
      console.error('[loadCotizadorData] slots:', slotErr.message)
    }
    for (const s of (slots ?? []) as {
      marca_id: string
      slot_key: PriceSlotKey
    }[]) {
      baseSlotByMarca[s.marca_id] = s.slot_key
    }

    return {
      tiers: tiers.map((t) => ({
        key: t.key,
        label: t.label,
        lead_time_label: t.lead_time_label,
        price_modifier_pct: Number(t.price_modifier_pct),
        highlighted: t.highlighted,
        sort_order: t.sort_order,
      })),
      caveatHtml: config?.caveat_html ?? null,
      baseSlotByMarca,
    }
  } catch (e) {
    console.error('[loadCotizadorData]', (e as Error).message)
    return EMPTY_COTIZADOR
  }
}
