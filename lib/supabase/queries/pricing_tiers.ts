/**
 * lib/supabase/queries/pricing_tiers.ts
 *
 * Tramos del cotizador + config (T.C. de referencia + caveat). DISPLAY data
 * con lectura pública (anon) — schema: 0040_pricing_tiers.sql. Resiliente:
 * error → [] / null (el cotizador degrada, no rompe el catálogo).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PricingTier {
  id: string
  key: string
  label: string
  lead_time_label: string | null
  lead_time_months: number | null
  price_modifier_pct: number
  highlighted: boolean
  sort_order: number
  active: boolean
}

export interface PricingConfig {
  usd_ars_ref: number | null
  fx_ref_date: string | null
  caveat_html: string | null
}

export async function getPricingTiers(
  client: SupabaseClient,
): Promise<PricingTier[]> {
  const { data, error } = await client
    .from('pricing_tiers')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('[getPricingTiers]', error.message)
    return []
  }
  return (data ?? []) as PricingTier[]
}

/** Todos los tramos (incl. inactivos), para el admin. */
export async function getAllPricingTiers(
  client: SupabaseClient,
): Promise<PricingTier[]> {
  const { data, error } = await client
    .from('pricing_tiers')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('[getAllPricingTiers]', error.message)
    return []
  }
  return (data ?? []) as PricingTier[]
}

export async function getPricingConfig(
  client: SupabaseClient,
): Promise<PricingConfig | null> {
  const { data, error } = await client
    .from('pricing_config')
    .select('usd_ars_ref, fx_ref_date, caveat_html')
    .eq('id', 1)
    .maybeSingle()
  if (error) {
    console.error('[getPricingConfig]', error.message)
    return null
  }
  return (data as PricingConfig) ?? null
}
