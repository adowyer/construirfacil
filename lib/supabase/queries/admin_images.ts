/**
 * lib/supabase/queries/admin_images.ts
 *
 * Query del admin de imágenes que reemplaza el filtro viejo por columnas
 * denormalizadas en `model_images` (linea/tipologia/style/variante) por una
 * lectura via `model_image_skus` — la fuente de verdad post-migración 0010.
 *
 * Una imagen "pertenece" al admin de un modelo cuando tiene al menos un
 * link en `model_image_skus` a algún SKU de la misma TIPOLOGÍA (linea +
 * tipologia_code). Eso incluye:
 *   - Fotos linkeadas al SKU exacto.
 *   - Fotos linkeadas a otras variantes del mismo style_name (compartidas
 *     a nivel modelo).
 *   - Fotos linkeadas a otros style_names de la misma tipología
 *     (compartidas a nivel tipología — ej. axonometrías de BOSQUE T2).
 *
 * El admin después decide qué mostrar / editar via tabs y filtros visuales.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type AdminGalleryImage = {
  id: string
  storage_url: string
  storage_path: string
  is_cover: boolean
  is_exterior: boolean
  image_type: string | null // 'render' | 'plano' | 'axo' | null
  sort_order: number
  status: string
  view_label: string | null
  drive_path: string | null
  /** SKUs (house_catalog.id) a los que está linkeada via model_image_skus. */
  linked_sku_ids: string[]
}

export type AdminTypologySku = {
  id: string // house_catalog.id (uuid)
  style_name: string
  variante: string
  sistema_constructivo: string
  area_m2: number | null
  bedrooms_label: string | null
}

export type AdminGalleryData = {
  images: AdminGalleryImage[]
  /** Todos los SKUs activos de la misma (linea, tipologia_code), incluido el actual. */
  typology_skus: AdminTypologySku[]
  /** Lista única de style_names dentro de la tipología, ordenada alfabéticamente. */
  typology_houses: string[]
  /** SKUs del style_name del modelo actual (para chips de variantes). */
  current_house_variants: AdminTypologySku[]
}

export async function getModelImagesForGroup(
  supabase: SupabaseClient,
  group: {
    linea: string
    tipologia_code: string
    style_name: string | null
  },
): Promise<AdminGalleryData> {
  // 1) Traer todos los SKUs de la tipología.
  const { data: skuRows, error: skuErr } = await supabase
    .from('house_catalog')
    .select('id, style_name, variante, sistema_constructivo, area_m2, bedrooms_label')
    .eq('linea', group.linea)
    .eq('tipologia_code', group.tipologia_code)
    .eq('status', 'active')
    .order('style_name', { ascending: true })
    .order('variante', { ascending: true })

  if (skuErr) {
    console.error('[getModelImagesForGroup] skus:', skuErr.message)
    return { images: [], typology_skus: [], typology_houses: [], current_house_variants: [] }
  }

  const typologySkus = (skuRows ?? []) as AdminTypologySku[]
  const skuIds = typologySkus.map((s) => s.id)

  if (skuIds.length === 0) {
    return { images: [], typology_skus: [], typology_houses: [], current_house_variants: [] }
  }

  // 2) Traer todos los links de esos SKUs.
  // Paginar por las dudas (PostgREST corta en ~1000).
  const links: { image_id: string; house_catalog_id: string }[] = []
  const PAGE = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('model_image_skus')
      .select('image_id, house_catalog_id')
      .in('house_catalog_id', skuIds)
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[getModelImagesForGroup] links:', error.message)
      break
    }
    if (!data || data.length === 0) break
    links.push(...(data as { image_id: string; house_catalog_id: string }[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  // 3) Indexar links por image_id.
  const linksByImage = new Map<string, string[]>()
  for (const l of links) {
    const arr = linksByImage.get(l.image_id) ?? []
    arr.push(l.house_catalog_id)
    linksByImage.set(l.image_id, arr)
  }

  const imageIds = Array.from(linksByImage.keys())

  // 4) Traer model_images de esos IDs (no archivadas).
  let images: AdminGalleryImage[] = []
  if (imageIds.length > 0) {
    const { data: imgRows, error: imgErr } = await supabase
      .from('model_images')
      .select(
        'id, storage_url, storage_path, is_cover, is_exterior, image_type, sort_order, status, view_label, drive_path',
      )
      .in('id', imageIds)
      .neq('status', 'archived')
      .order('is_cover', { ascending: false })
      .order('sort_order', { ascending: true })

    if (imgErr) {
      console.error('[getModelImagesForGroup] images:', imgErr.message)
    } else {
      images = (imgRows ?? []).map((img) => ({
        ...(img as Omit<AdminGalleryImage, 'linked_sku_ids'>),
        linked_sku_ids: linksByImage.get(img.id) ?? [],
      }))
    }
  }

  // 5) Derivados: lista única de style_names + variantes del style actual.
  const houseSet = new Set<string>()
  for (const s of typologySkus) houseSet.add(s.style_name)
  const typology_houses = Array.from(houseSet).sort((a, b) => a.localeCompare(b, 'es'))

  const current_house_variants = group.style_name
    ? typologySkus.filter((s) => s.style_name === group.style_name)
    : []

  return {
    images,
    typology_skus: typologySkus,
    typology_houses,
    current_house_variants,
  }
}
