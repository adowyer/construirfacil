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
  /** URL original (fallback). NO usarla en componentes públicos si hay
   *  thumb_url / webp_url — drena egress. */
  storage_url: string
  /** WebP ~400px wide. Usar en cards/listados. Null si aún no optimizada. */
  thumb_url: string | null
  /** WebP ~1920px max. Usar en galerías/expandido. Null si aún no optimizada. */
  webp_url: string | null
  is_exterior: boolean | null
  image_type: string | null
  view_label: string | null
  sort_order: number
  /** house_catalog_ids a los que aplica esta imagen (resuelto vía model_image_skus). */
  sku_ids: string[]
  // Columnas legacy denormalizadas — el sync las sigue populando como ayuda
  // de búsqueda para admin. Las queries del catálogo público ya no las usan
  // para resolver scope (eso ahora va vía sku_ids).
  style_name: string | null
  variante: string | null
  linea: string | null
  tipologia_code: string | null
}

/** Helper para componentes — pickea la mejor URL disponible.
 *  Cards/listados: `pickThumb`. Galerías/expandido: `pickFull`. */
export function pickThumb(img: { thumb_url: string | null; webp_url: string | null; storage_url: string }): string {
  return img.thumb_url ?? img.webp_url ?? img.storage_url
}
export function pickFull(img: { webp_url: string | null; storage_url: string }): string {
  return img.webp_url ?? img.storage_url
}

/**
 * Trae TODOS los links de model_image_skus paginando manualmente. PostgREST
 * tiene un cap server-side (típicamente 1000) que `.range(0, 49999)` no
 * supera porque depende del setting del proyecto. Paginar en chunks es la
 * forma robusta — funciona independientemente del cap configurado.
 */
async function loadAllImageSkuLinks(
  supabase: SupabaseClient,
): Promise<{ image_id: string; house_catalog_id: string }[]> {
  const all: { image_id: string; house_catalog_id: string }[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('model_image_skus')
      .select('image_id, house_catalog_id')
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[loadAllImageSkuLinks] page error:', error.message)
      break
    }
    if (!data || data.length === 0) break
    all.push(...(data as { image_id: string; house_catalog_id: string }[]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

/**
 * Devuelve todas las imágenes activas del catálogo, cada una con la lista
 * de `house_catalog_id` a los que aplica (vía model_image_skus). El caller
 * filtra usando `imagesForSkus(images, skuIds)`.
 *
 * Dos queries en paralelo + join en cliente. Antes usábamos un embed
 * `links:model_image_skus(...)` pero el cache de schema de PostgREST en prod
 * a veces no refleja FKs nuevas → devuelve `links: []` y el catálogo queda sin
 * imágenes. El join manual es robusto a ese problema y trivialmente más lento.
 */
export async function getAllCatalogImages(
  supabase: SupabaseClient,
): Promise<CatalogImage[]> {
  const [imagesRes, allLinks] = await Promise.all([
    supabase
      .from('model_images')
      .select(
        'id, storage_url, thumb_url, webp_url, is_exterior, image_type, view_label, sort_order, style_name, variante, linea, tipologia_code',
      )
      .neq('status', 'archived')
      .order('sort_order', { ascending: true }),
    loadAllImageSkuLinks(supabase),
  ])

  if (imagesRes.error) {
    console.error('[getAllCatalogImages] images:', imagesRes.error.message)
    return []
  }

  const linksByImage = new Map<string, string[]>()
  for (const link of allLinks) {
    const arr = linksByImage.get(link.image_id) ?? []
    arr.push(link.house_catalog_id)
    linksByImage.set(link.image_id, arr)
  }

  return (imagesRes.data ?? []).map((r) => ({
    ...(r as Omit<CatalogImage, 'sku_ids'>),
    sku_ids: linksByImage.get((r as { id: string }).id) ?? [],
  }))
}

/**
 * Devuelve las imágenes que aplican a alguno de los SKUs dados.
 *
 * Casos típicos:
 *   • Todas las imágenes de un modelo:  imagesForSkus(images, model.skus.map(s => s.id))
 *   • Imágenes específicas de UNA variante:  imagesForSkus(images, [variant.id])
 *
 * La specificity la decide el caller con qué SKUs pasa.
 */
export function imagesForSkus(
  images: CatalogImage[],
  skuIds: string[],
): CatalogImage[] {
  if (skuIds.length === 0) return []
  const wanted = new Set(skuIds)
  return images.filter((img) => img.sku_ids.some((id) => wanted.has(id)))
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
