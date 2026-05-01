/**
 * lib/supabase/queries/catalog_grouped.ts
 *
 * Devuelve modelos comerciales agrupados:
 *   Una entrada = un nombre comercial (Alecrín, Pampa...) por tipología
 *   con rangos de m², dorm, lista de variantes y sistemas disponibles,
 *   foto principal, y precio "desde".
 *
 * El catálogo público muestra estos grupos, no SKUs individuales.
 * El detail slider abre con todos los SKUs del grupo para que el
 * cliente elija variante + sistema constructivo.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ModelVariant = {
  sku: string
  variante: string
  area_m2: number | null
  floors: number | null
  min_bedrooms: number | null
  max_bedrooms: number | null
  bedrooms_label: string | null
  bathrooms: number | null
  sistema_constructivo: string
  precio_lista_usd: number | null
  precio_contado_usd: number | null
  precio_pozo_usd: number | null
}

export type CatalogModel = {
  // Identidad
  group_slug: string                     // bosque-ambay-t1
  linea: string                          // BOSQUE / ATLAS / TERRA
  segmento: string | null                // PREMIUM / ESTÁNDAR
  style_name: string                     // AMBAY
  display_name: string                   // Amba'y (con tildes y apóstrofes)
  estilo: string                         // Moderno / Campestre / etc
  tipologia_code: string                 // 1 / 2 / TU / TO / TZ

  // Rangos del grupo
  area_min: number | null
  area_max: number | null
  beds_min: number | null
  beds_max: number | null
  floors_options: string                 // "1" | "1 ó 2" | "2"
  price_from: number | null

  // Disponibilidad
  systems: string[]                      // ['WOOD PLUS', 'STEEL PLUS']
  variantes_count: number
  skus: ModelVariant[]                   // todos los SKUs del grupo

  // Imagen principal (del modelo_images con mejor specificity)
  cover_url: string | null
  lqip_color: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Nombres de display (restaura tildes y apóstrofes)
// ─────────────────────────────────────────────────────────────────────────────

const DISPLAY_NAMES: Record<string, string> = {
  // Bosque
  AMBAY: "Amba'y",
  LAPACHO: "Lapacho",
  CAMBOATA: "Camboatá",
  ALECRIN: "Alecrín",
  GUAYUBIRA: "Guayubirá",
  TIMBO: "Timbó",
  CEDRO: "Cedro",
  INGA: "Ingá",
  ANCHICO: "Anchico",
  // Atlas
  PAMPA: "Pampa",
  CALIFORNIA: "California",
  ESCANDINAVIA: "Escandinavia",
  LANCASTER: "Lancaster",
  PATAGONIA: "Patagonia",
  // Terra
  LANIN: "Lanín",
  COPAHUE: "Copahue",
  DOMUYO: "Domuyo",
  MAHUIDA: "Mahuida",
  TROMEN: "Tromen",
}

function displayName(style_name: string): string {
  return DISPLAY_NAMES[style_name] ?? style_name
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug del grupo
// ─────────────────────────────────────────────────────────────────────────────

function groupSlug(linea: string, style_name: string, tipologia_code: string): string {
  return [linea, style_name, `t${tipologia_code}`]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// Query principal
// ─────────────────────────────────────────────────────────────────────────────

export async function getGroupedCatalog(
  supabase: SupabaseClient,
  opts: { linea?: string } = {}
): Promise<CatalogModel[]> {

  // 1) Traer todos los SKUs activos
  let query = supabase
    .from('house_catalog')
    .select('*')
    .eq('status', 'active')
    .order('linea').order('style_name').order('tipologia_code').order('variante')

  if (opts.linea) query = query.eq('linea', opts.linea)

  const { data: rows, error } = await query
  if (error) {
    console.error('[getGroupedCatalog]', error.message)
    return []
  }

  // 2) Agrupar por (linea, style_name, tipologia_code)
  const groupMap = new Map<string, ModelVariant[]>()
  const groupMeta = new Map<string, { linea: string; segmento: string | null; style_name: string; estilo: string; tipologia_code: string }>()

  for (const row of (rows ?? [])) {
    const key = groupSlug(row.linea, row.style_name, row.tipologia_code)
    if (!groupMap.has(key)) {
      groupMap.set(key, [])
      groupMeta.set(key, {
        linea: row.linea,
        segmento: row.segmento,
        style_name: row.style_name,
        estilo: row.estilo,
        tipologia_code: row.tipologia_code,
      })
    }
    groupMap.get(key)!.push({
      sku: row.sku,
      variante: row.variante,
      area_m2: row.area_m2,
      floors: row.floors,
      min_bedrooms: row.min_bedrooms,
      max_bedrooms: row.max_bedrooms,
      bedrooms_label: row.bedrooms_label,
      bathrooms: row.bathrooms,
      sistema_constructivo: row.sistema_constructivo,
      precio_lista_usd: row.precio_lista_usd,
      precio_contado_usd: row.precio_contado_usd,
      precio_pozo_usd: row.precio_pozo_usd,
    })
  }

  // 3) Traer fotos (cover) por grupo — best specificity por SKU usando la vista
  const allSkus = (rows ?? []).map(r => r.sku)
  const coversByGroup = new Map<string, { url: string; lqip: string }>()

  if (allSkus.length > 0) {
    // PostgREST tiene cap server-side (~1000 filas) que ignora .limit().
    // La vista hace fallback por specificity → varias filas por SKU.
    // Batcheamos en chunks para que cada query quede bajo el cap.
    const CHUNK = 50
    const coverBySku = new Map<string, { url: string; lqip: string }>()

    for (let i = 0; i < allSkus.length; i += CHUNK) {
      const chunk = allSkus.slice(i, i + CHUNK)
      const { data: imgs, error: imgsError } = await supabase
        .from('house_images_resolved')
        .select('sku, storage_url, lqip_color, specificity, is_exterior, sort_order, image_type')
        .in('sku', chunk)
        .eq('is_exterior', true)
        .eq('image_type', 'render')
        .order('specificity', { ascending: false })
        .order('sort_order', { ascending: true })

      if (imgsError) {
        console.error('[imgs ERROR]', imgsError.message, imgsError.details, imgsError.hint)
        continue
      }

      for (const img of (imgs ?? [])) {
        if (!coverBySku.has(img.sku)) {
          coverBySku.set(img.sku, { url: img.storage_url, lqip: img.lqip_color ?? '#d4d4cc' })
        }
      }
    }

    // Para cada grupo, usar la foto del primer SKU que tenga
    for (const [key, skus] of groupMap) {
      for (const s of skus) {
        const cover = coverBySku.get(s.sku)
        if (cover) {
          coversByGroup.set(key, cover)
          break
        }
      }
    }
  }

  // 4) Construir CatalogModel por grupo
  const models: CatalogModel[] = []

  for (const [key, skus] of groupMap) {
    const meta = groupMeta.get(key)!
    const areas = skus.map(s => s.area_m2).filter(Boolean) as number[]
    const beds_min_all = skus.map(s => s.min_bedrooms).filter(v => v != null) as number[]
    const beds_max_all = skus.map(s => s.max_bedrooms ?? s.min_bedrooms).filter(v => v != null) as number[]
    const floors_all = [...new Set(skus.map(s => s.floors).filter(Boolean))] as number[]
    const prices = skus.map(s => s.precio_lista_usd).filter(v => v != null && v > 0) as number[]
    const uniqueVariantes = [...new Set(skus.map(s => s.variante))]
    const uniqueSystems = [...new Set(skus.map(s => s.sistema_constructivo))]

    const floors_options =
      floors_all.length === 0 ? '1'
        : floors_all.length === 1 ? String(floors_all[0])
          : `${Math.min(...floors_all)} ó ${Math.max(...floors_all)}`

    const cover = coversByGroup.get(key)

    models.push({
      group_slug: key,
      linea: meta.linea,
      segmento: meta.segmento,
      style_name: meta.style_name,
      display_name: displayName(meta.style_name),
      estilo: meta.estilo,
      tipologia_code: meta.tipologia_code,
      area_min: areas.length ? Math.min(...areas) : null,
      area_max: areas.length ? Math.max(...areas) : null,
      beds_min: beds_min_all.length ? Math.min(...beds_min_all) : null,
      beds_max: beds_max_all.length ? Math.max(...beds_max_all) : null,
      floors_options,
      price_from: prices.length ? Math.min(...prices) : null,
      systems: uniqueSystems,
      variantes_count: uniqueVariantes.length,
      skus,
      cover_url: cover?.url ?? null,
      lqip_color: cover?.lqip ?? '#d4d4cc',
    })
  }

  return models
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper para el detail slider: trae todos los SKUs + fotos de un grupo
// ─────────────────────────────────────────────────────────────────────────────

export type GroupDetail = {
  model: CatalogModel
  exterior_images: { url: string; lqip: string; room_type: string | null; sort_order: number }[]
  interior_images: { url: string; lqip: string; room_type: string; sort_order: number }[]
}

export async function getGroupDetail(
  supabase: SupabaseClient,
  group_slug: string
): Promise<GroupDetail | null> {
  // Parsear el slug: bosque-ambay-t1 → linea=BOSQUE, style=AMBAY, tip=1
  const parts = group_slug.split('-')
  const tipCode = parts[parts.length - 1].replace('t', '').toUpperCase()
  const linea = parts[0].toUpperCase()
  const style = parts.slice(1, -1).join('').toUpperCase()

  const { data: rows } = await supabase
    .from('house_catalog')
    .select('*')
    .eq('linea', linea)
    .eq('style_name', style)
    .eq('tipologia_code', tipCode)
    .eq('status', 'active')
    .order('variante')

  if (!rows?.length) return null

  const skus = rows.map(r => r.sku)

  // Fotos exteriores (sin room_type) e interiores (con room_type)
  const { data: imgs } = await supabase
    .from('house_images_resolved')
    .select('sku, storage_url, lqip_color, is_exterior, room_type, sort_order, specificity')
    .in('sku', skus)
    .order('specificity', { ascending: false })
    .order('sort_order', { ascending: true })

  // Deduplicar por URL (misma foto puede aparecer en múltiples SKUs del grupo)
  const extUrls = new Set<string>()
  const intUrls = new Set<string>()
  const exterior_images: GroupDetail['exterior_images'] = []
  const interior_images: GroupDetail['interior_images'] = []

  for (const img of (imgs ?? [])) {
    if (img.is_exterior && !extUrls.has(img.storage_url)) {
      extUrls.add(img.storage_url)
      exterior_images.push({ url: img.storage_url, lqip: img.lqip_color ?? '#d4d4cc', room_type: null, sort_order: img.sort_order })
    }
    if (!img.is_exterior && !intUrls.has(img.storage_url)) {
      intUrls.add(img.storage_url)
      interior_images.push({ url: img.storage_url, lqip: img.lqip_color ?? '#d4d4cc', room_type: img.room_type ?? 'interior', sort_order: img.sort_order })
    }
  }

  // Construir el modelo del grupo (reutilizamos la lógica)
  const catalog = await getGroupedCatalog(supabase, { linea })
  const model = catalog.find(m => m.group_slug === group_slug)
  if (!model) return null

  return { model, exterior_images, interior_images }
}
