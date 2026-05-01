/**
 * lib/supabase/queries/models.ts
 *
 * Queries against the new house_catalog schema.
 *
 * IMPORTANTE: este archivo mantiene la misma SHAPE de retorno que el código viejo
 * (HouseCatalogRow con campos `name`, `variant_code`, `public_price_usd`, etc.)
 * para no romper el UI. Por dentro, lee del schema nuevo y mapea al vuelo.
 *
 * Mapeo conceptual:
 *   variant_code        ← sku
 *   name                ← derivado de "{style_name} (V{variante})"
 *   variant_style       ← estilo
 *   recommended_use     ← description
 *   construction_system ← sistema_constructivo
 *   public_price_usd    ← precio_lista_usd
 *   construction_cost_usd ← costo_plano_usd
 *   presale_discount_pct  ← derivado: ((lista − pozo) / lista) × 100
 *   linea               ← linea (nuevo, agregado al type)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Type compatible con el código viejo + campos nuevos opcionales
// ─────────────────────────────────────────────────────────────────────────────

export type HouseCatalogRow = {
  // Compatibilidad con el código viejo
  id: string
  model_id: string                   // alias de id (compat)
  variant_code: string               // = sku
  name: string                       // = derivado de style_name + variante
  variant_style: string | null       // = estilo
  area_m2: number | null
  floors: number | null
  min_bedrooms: number | null
  max_bedrooms: number | null
  recommended_family_size_min: number | null
  recommended_family_size_max: number | null
  recommended_use: string | null     // = description
  construction_cost_usd: number | null  // = costo_plano_usd
  public_price_usd: number | null    // = precio_lista_usd
  construction_system: string | null // = sistema_constructivo
  brochure_url: string | null
  status: string
  construction_cost_pct: number | null
  presale_discount_pct: number | null   // derivado
  created_at: string | null

  // Campos nuevos del schema
  sku: string
  linea: string | null
  segmento: string | null
  tipologia_code: string | null
  variante: string | null
  style_name: string | null
  estilo: string | null
  sistema_constructivo: string | null
  bedrooms_label: string | null
  bathrooms: number | null
  toilette: boolean | null
  parrilla: boolean | null
  precio_lista_usd: number | null
  precio_contado_usd: number | null
  precio_pozo_usd: number | null
  costo_plano_usd: number | null
  pdf_url: string | null
}

export type CatalogFilters = {
  construction_system?: string
  min_bedrooms?: number
  price_max_usd?: number
  price_min_usd?: number
  linea?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeo schema nuevo → shape viejo
// ─────────────────────────────────────────────────────────────────────────────

/** Construye nombre comercial mostrable: "AMBAY" + variante "1" → "Amba'y" */
function buildDisplayName(styleName: string | null, variante: string | null): string {
  if (!styleName) return 'Modelo sin nombre'
  // Capitalizar (AMBAY → Ambay) y devolver. La variante se muestra aparte en el UI.
  const cap = styleName.charAt(0).toUpperCase() + styleName.slice(1).toLowerCase()
  // Restaurar apóstrofe en nombres conocidos
  const restored = cap.replace(/^Ambay$/i, "Amba'y")
  if (variante) return `${restored} ${variante}`
  return restored
}

/** Calcula descuento del pozo respecto a lista */
function calcPresaleDiscount(lista: number | null, pozo: number | null): number | null {
  if (!lista || !pozo || lista <= 0) return null
  const pct = ((lista - pozo) / lista) * 100
  return Math.round(pct * 10) / 10
}

/** Convierte una fila del schema nuevo al shape viejo (compatible con el UI) */
function mapRow(r: any): HouseCatalogRow {
  return {
    // Aliases viejos
    id: r.id,
    model_id: r.id,
    variant_code: r.sku,
    name: buildDisplayName(r.style_name, r.variante),
    variant_style: r.estilo,
    area_m2: r.area_m2,
    floors: r.floors,
    min_bedrooms: r.min_bedrooms,
    max_bedrooms: r.max_bedrooms,
    recommended_family_size_min: null,
    recommended_family_size_max: null,
    recommended_use: r.description,
    construction_cost_usd: r.costo_plano_usd,
    public_price_usd: r.precio_lista_usd,
    construction_system: r.sistema_constructivo,
    brochure_url: r.brochure_url,
    status: r.status,
    construction_cost_pct: null,
    presale_discount_pct: calcPresaleDiscount(r.precio_lista_usd, r.precio_pozo_usd),
    created_at: r.created_at,

    // Campos nuevos completos
    sku: r.sku,
    linea: r.linea,
    segmento: r.segmento,
    tipologia_code: r.tipologia_code,
    variante: r.variante,
    style_name: r.style_name,
    estilo: r.estilo,
    sistema_constructivo: r.sistema_constructivo,
    bedrooms_label: r.bedrooms_label,
    bathrooms: r.bathrooms,
    toilette: r.toilette,
    parrilla: r.parrilla,
    precio_lista_usd: r.precio_lista_usd,
    precio_contado_usd: r.precio_contado_usd,
    precio_pozo_usd: r.precio_pozo_usd,
    costo_plano_usd: r.costo_plano_usd,
    pdf_url: r.pdf_url,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API (mantiene los nombres viejos)
// ─────────────────────────────────────────────────────────────────────────────

export async function getPublishedModels(
  supabase: SupabaseClient,
  filters: CatalogFilters = {},
): Promise<HouseCatalogRow[]> {
  let query = supabase
    .from('house_catalog')
    .select('*')
    .eq('status', 'active')
    .order('linea', { ascending: true })
    .order('style_name', { ascending: true })
    .order('variante', { ascending: true })

  if (filters.linea) {
    query = query.eq('linea', filters.linea)
  }
  if (filters.construction_system) {
    query = query.eq('sistema_constructivo', filters.construction_system)
  }
  if (filters.min_bedrooms !== undefined) {
    query = query.gte('min_bedrooms', filters.min_bedrooms)
  }
  if (filters.price_max_usd !== undefined) {
    query = query.lte('precio_lista_usd', filters.price_max_usd)
  }
  if (filters.price_min_usd !== undefined) {
    query = query.gte('precio_lista_usd', filters.price_min_usd)
  }

  const { data, error } = await query
  if (error) {
    console.error('[getPublishedModels]', error.message)
    return []
  }
  return (data ?? []).map(mapRow)
}

/** Busca por SKU (variantCode = sku en el nuevo schema) */
export async function getModelByVariantCode(
  supabase: SupabaseClient,
  variantCode: string,
): Promise<HouseCatalogRow | null> {
  const { data, error } = await supabase
    .from('house_catalog')
    .select('*')
    .eq('sku', variantCode)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      console.error('[getModelByVariantCode]', error.message)
    }
    return null
  }
  return mapRow(data)
}

export async function getAllVariantCodes(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('house_catalog')
    .select('sku')
    .eq('status', 'active')

  if (error) return []
  return (data ?? []).map((r: { sku: string }) => r.sku)
}

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
  return mapRow(data)
}

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
  return (data ?? []).map(mapRow)
}

// Backward-compat aliases used by portal + admin pages
export const getMyModels = getAllModelsAdmin
export const getModerationQueue = getAllModelsAdmin
