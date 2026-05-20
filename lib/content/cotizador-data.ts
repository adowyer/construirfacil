/**
 * lib/content/cotizador-data.ts
 *
 * Resuelve, server-side, todo lo que el selector Uber necesita para mostrar
 * la cuota en vivo, en un bag SERIALIZABLE (sin filtrar la tabla de bancos):
 *
 *  - tiers: los 3 tramos (display, lectura pública).
 *  - fxRef / caveat: de pricing_config (sin T.C. → la cuota DEGRADA).
 *  - cuota: SÓLO los parámetros del producto ancla reducidos
 *    (monthlyRate, nMonths, capArs) — no se manda nombre de banco ni la
 *    tabla entera al cliente. El cálculo francés es puro y corre client-side.
 *  - baseSlotByMarca: qué columna de precio es el "base" de cada marca
 *    (el sugerido sobre el que aplica el tramo). Degrada a 'lista'.
 *
 * Resiliente: cualquier fallo → bag con cuota=null y tiers=[] (la UI cae al
 * CTA "Cotizar" de siempre, cero regresión).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPricingTiers, getPricingConfig } from '@/lib/supabase/queries/pricing_tiers'
import { getActiveBankProducts } from '@/lib/supabase/queries/bank_financing'
import type { CuotaProduct } from '@/lib/pricing/cuota'
import type { PriceSlotKey } from '@/lib/supabase/queries/marca_price_slot'

export interface CotizadorTier {
  key: string
  label: string
  lead_time_label: string | null
  price_modifier_pct: number
  highlighted: boolean
  sort_order: number
}

// Re-exporta el tipo (los consumers no importan de @/lib/pricing/cuota directo).
export type CuotaParams = CuotaProduct

export interface CotizadorData {
  tiers: CotizadorTier[]
  fxRef: number | null
  fxRefDate: string | null
  caveatHtml: string | null
  /** Set de productos candidatos (reducidos: tasa/plazo/cap, sin nombre de
   *  banco). El cliente elige el mejor POR PRECIO así el delta del tramo
   *  Uber se diferencia aunque el cap del ancla bindee. */
  cuotaProducts: CuotaProduct[]
  baseSlotByMarca: Record<string, PriceSlotKey>
}

export const EMPTY_COTIZADOR: CotizadorData = {
  tiers: [],
  fxRef: null,
  fxRefDate: null,
  caveatHtml: null,
  cuotaProducts: [],
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

    // Set de candidatos: productos 100% financiables (fallback: todos los
    // activos). Mandamos sólo tasa/plazo/cap — sin nombre de banco — para
    // que el cliente elija el mejor POR PRECIO (rompe el cap-binding que
    // hace que todos los tramos den la misma cuota).
    let cuotaProducts: CuotaProduct[] = []
    try {
      const products = await getActiveBankProducts(createAdminClient())
      const full = products.filter((p) => p.max_financing_pct >= 100)
      const pool = full.length > 0 ? full : products
      cuotaProducts = pool.map((p) => ({
        monthlyRate: p.interest_rate / 100 / 12,
        nMonths: p.max_term_months,
        capArs: p.max_loan_amount_ars ?? null,
      }))
    } catch (e) {
      console.error('[loadCotizadorData] bank products:', (e as Error).message)
    }

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
      fxRef: config?.usd_ars_ref ?? null,
      fxRefDate: config?.fx_ref_date ?? null,
      caveatHtml: config?.caveat_html ?? null,
      cuotaProducts,
      baseSlotByMarca,
    }
  } catch (e) {
    console.error('[loadCotizadorData]', (e as Error).message)
    return EMPTY_COTIZADOR
  }
}
