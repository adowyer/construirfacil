/**
 * lib/supabase/queries/models.ts
 * Queries against the real `house_catalog` table in Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type HouseCatalogRow = {
  id: string
  model_id: string
  variant_code: string
  name: string
  variant_style: string | null
  area_m2: number | null
  floors: number | null
  min_bedrooms: number | null
  max_bedrooms: number | null
  recommended_family_size_min: number | null
  recommended_family_size_max: number | null
  recommended_use: string | null
  construction_cost_usd: number | null
  public_price_usd: number | null
  construction_system: string | null
  brochure_url: string | null
  status: string
  construction_cost_pct: number | null
  presale_discount_pct: number | null
  created_at: string | null
}

export type CatalogFilters = {
  construction_system?: string
  min_bedrooms?: number
  price_max_usd?: number
  price_min_usd?: number
}

export async function getPublishedModels(
  supabase: SupabaseClient,
  filters: CatalogFilters = {},
): Promise<HouseCatalogRow[]> {
  let query = supabase
    .from('house_catalog')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (filters.construction_system) {
    query = query.eq('construction_system', filters.construction_system)
  }

  if (filters.min_bedrooms !== undefined) {
    query = query.gte('min_bedrooms', filters.min_bedrooms)
  }

  if (filters.price_max_usd !== undefined) {
    query = query.lte('public_price_usd', filters.price_max_usd)
  }

  if (filters.price_min_usd !== undefined) {
    query = query.gte('public_price_usd', filters.price_min_usd)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getPublishedModels]', error.message)
    return []
  }

  return data ?? []
}

export async function getModelByVariantCode(
  supabase: SupabaseClient,
  variantCode: string,
): Promise<HouseCatalogRow | null> {
  const { data, error } = await supabase
    .from('house_catalog')
    .select('*')
    .eq('variant_code', variantCode)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('[getModelByVariantCode]', error?.message)
    }
    return null
  }

  return data
}

export async function getAllVariantCodes(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('house_catalog')
    .select('variant_code')
    .eq('status', 'active')

  if (error) return []
  return (data ?? []).map((r: { variant_code: string }) => r.variant_code)
}

// Backward-compat aliases used by portal + admin pages
// (these pages target house_catalog until constructora multi-tenant tables are added)
export const getMyModels = getAllModelsAdmin
export const getModerationQueue = getAllModelsAdmin
export async function getModelById(
  supabase: SupabaseClient,
  id: string,
): Promise<HouseCatalogRow | null> {
  const { data, error } = await supabase
    .from('house_catalog')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return data
}

// Admin — all models regardless of status
export async function getAllModelsAdmin(
  supabase: SupabaseClient,
): Promise<HouseCatalogRow[]> {
  const { data, error } = await supabase
    .from('house_catalog')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[getAllModelsAdmin]', error.message)
    return []
  }

  return data ?? []
}
