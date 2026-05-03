/**
 * lib/supabase/queries/catalog_panels.ts
 *
 * Queries de bulk-fetch para alimentar los paneles del expandido del catálogo
 * público. Se ejecutan una sola vez en el server component (route catalog),
 * y los resultados se pasan a CatalogPage → ModelRow → paneles via props.
 *
 * Volumen esperado: ~19 modelos × pocas filas cada uno → tamaño total bajo.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ModelContentRow } from './models'

// ─────────────────────────────────────────────────────────────────────────────
// model_content — bulk
// ─────────────────────────────────────────────────────────────────────────────

/** Trae TODAS las filas de model_content. La key es `${linea}::${style_name}`. */
export async function getAllModelContentMap(
  supabase: SupabaseClient,
): Promise<Record<string, ModelContentRow>> {
  const { data, error } = await supabase.from('model_content').select('*')
  if (error) {
    console.error('[getAllModelContentMap]', error.message)
    return {}
  }
  const map: Record<string, ModelContentRow> = {}
  for (const row of (data ?? []) as ModelContentRow[]) {
    map[`${row.linea}::${row.style_name}`] = row
  }
  return map
}

// ─────────────────────────────────────────────────────────────────────────────
// model_images — bulk, indexado por modelo
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogImage {
  id: string
  storage_url: string
  is_exterior: boolean | null
  image_type: string | null
  view_label: string | null
  style_name: string | null
  variante: string | null
  linea: string | null
  tipologia_code: string | null
  sort_order: number
}

/**
 * Devuelve todas las imágenes activas del catálogo. La indexación por modelo
 * la hace el caller con un helper (matchImagesForModel) — el mismo set de
 * imágenes se reutiliza para varias estaciones por modelo (exteriores,
 * interiores, comparativo).
 */
export async function getAllCatalogImages(
  supabase: SupabaseClient,
): Promise<CatalogImage[]> {
  const { data, error } = await supabase
    .from('model_images')
    .select(
      'id, storage_url, is_exterior, image_type, view_label, style_name, variante, linea, tipologia_code, sort_order',
    )
    .neq('status', 'archived')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[getAllCatalogImages]', error.message)
    return []
  }
  return (data ?? []) as CatalogImage[]
}

/**
 * Filtra imágenes que aplican a un modelo específico. Match en 3 niveles
 * de scope: variante específica → modelo (variante NULL) → tipología (style NULL).
 */
export function matchImagesForModel(
  images: CatalogImage[],
  args: { linea: string; tipologia_code: string; style_name: string; variante?: string | null },
): CatalogImage[] {
  const { linea, tipologia_code, style_name, variante } = args
  return images.filter((img) => {
    if (img.linea !== linea) return false
    if (img.tipologia_code !== tipologia_code) return false
    // Variante específica: imágenes con (style, variante) exactos
    if (variante != null && img.style_name === style_name && img.variante === variante) return true
    // Modelo: (style, variante=null)
    if (img.style_name === style_name && img.variante == null) return true
    // Tipología: (style=null, variante=null)
    if (img.style_name == null && img.variante == null) return true
    return false
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// house_catalog_attributes — bulk, agrupado por catalog_id y por type
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogAttributeRow {
  house_catalog_id: string
  attribute_value_id: string
  value_name: string
  value_slug: string | null
  type_id: string
  type_name: string
  type_slug: string
  type_sort: number
}

/** Trae todos los pairs (catalog × attribute_value) con metadata. Pesado en
 *  filas pero filtrar por catalog en cliente es trivial. */
export async function getAllCatalogAttributes(
  supabase: SupabaseClient,
): Promise<CatalogAttributeRow[]> {
  const { data, error } = await supabase
    .from('house_catalog_attributes')
    .select(
      `house_catalog_id,
       attribute_value_id,
       value:attribute_values(name, slug, attribute_type:attribute_types(id, name, slug, sort_order))`,
    )

  if (error) {
    console.error('[getAllCatalogAttributes]', error.message)
    return []
  }
  // Aplanar — Supabase puede tipar `value` y `attribute_type` como array
  // aunque la relación sea N→1; normalizamos a objeto.
  const rows: CatalogAttributeRow[] = []
  type RawRow = {
    house_catalog_id: string
    attribute_value_id: string
    value:
      | {
          name: string
          slug: string | null
          attribute_type:
            | { id: string; name: string; slug: string; sort_order: number }
            | { id: string; name: string; slug: string; sort_order: number }[]
            | null
        }
      | { name: string; slug: string | null; attribute_type: any }[]
      | null
  }
  for (const raw of ((data ?? []) as unknown as RawRow[])) {
    const v = Array.isArray(raw.value) ? raw.value[0] : raw.value
    if (!v) continue
    const t = Array.isArray(v.attribute_type) ? v.attribute_type[0] : v.attribute_type
    if (!t) continue
    rows.push({
      house_catalog_id: raw.house_catalog_id,
      attribute_value_id: raw.attribute_value_id,
      value_name: v.name,
      value_slug: v.slug,
      type_id: t.id,
      type_name: t.name,
      type_slug: t.slug,
      type_sort: t.sort_order ?? 0,
    })
  }
  return rows
}

/** Agrupa los attributes de un modelo (todos los SKUs del grupo) por type. */
export function groupAttributesByType(rows: CatalogAttributeRow[]): Array<{
  type_id: string
  type_name: string
  type_slug: string
  type_sort: number
  values: { name: string; slug: string | null }[]
}> {
  const byType = new Map<string, ReturnType<typeof groupAttributesByType>[number]>()
  for (const r of rows) {
    if (!byType.has(r.type_id)) {
      byType.set(r.type_id, {
        type_id: r.type_id,
        type_name: r.type_name,
        type_slug: r.type_slug,
        type_sort: r.type_sort,
        values: [],
      })
    }
    const g = byType.get(r.type_id)!
    if (!g.values.find((v) => v.name === r.value_name)) {
      g.values.push({ name: r.value_name, slug: r.value_slug })
    }
  }
  return Array.from(byType.values()).sort((a, b) => a.type_sort - b.type_sort)
}
