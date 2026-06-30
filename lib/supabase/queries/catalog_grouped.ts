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
import {
  displayModelTitle,
  DEFAULT_NAMING_STRATEGY,
  type NamingStrategy,
} from '@/lib/content/model-naming'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ModelVariant = {
  id: string                              // uuid del row en house_catalog
  sku: string
  variante: string
  area_m2: number | null
  area_semicubierta_m2: number | null
  floors: number | null
  min_bedrooms: number | null
  max_bedrooms: number | null
  bedrooms_label: string | null
  bathrooms: number | null
  toilette: boolean | null
  parrilla: boolean | null
  lavadero: string | null
  sistema_constructivo: string
  precio_lista_usd: number | null
  precio_contado_usd: number | null
  precio_pozo_usd: number | null
  featured_rank: number | null
  /** Delta vs variante base ("+ baño + lavadero ext."). NULL para variante base. */
  feature_delta: string | null
  /** Oferta activa (resolución posterior a expiración): is_offer && (sin fecha o vigente). */
  is_offer: boolean
  offer_pct: number | null
  offer_label: string | null
}

export type CatalogModel = {
  // Identidad
  group_slug: string                     // bosque-ambay-t1
  linea: string                          // BOSQUE / ATLAS / TERRA
  segmento: string | null                // PREMIUM / ESTÁNDAR
  style_name: string                     // AMBAY
  display_name: string                   // "CASA NODO Estilo PAMPA" (post-0046) o "Casa Pampa" si la línea no tiene tipologia_code_new aún
  estilo: string                         // Moderno / Campestre / etc
  tipologia_code: string                 // legacy: 1 / 2 / TU / TO / TZ
  tipologia_code_new: string | null      // canónico legacy (0046): EJES/NODO/CUBO/ZETA/DECK como UN solo eje
  // 4 ejes nuevos (0090). NULL en líneas/marcas no backfilleadas.
  circulacion: string | null             // EJES | NODO
  morfologia:  string | null             // DECK | CUBO | ZETA
  acceso:      string | null             // Frontal | Lateral | Flip
  area_social: string | null             // Anterior | Posterior | Lateral
  /** Estrategia de naming heredada de la línea (default si la línea no la tiene). */
  naming_strategy: NamingStrategy
  /** Mapping variante base → label, heredado de la línea. */
  variante_labels: Record<string, string> | null
  /** Concepto de la línea (banner en la ficha). */
  concept_blurb: string | null

  // Rangos del grupo
  area_min: number | null
  area_max: number | null
  beds_min: number | null
  beds_max: number | null
  floors_options: string                 // "1" | "1 ó 2" | "2"
  /** Post-split por variante, constante por grupo. Usado para sufijar el hero
   *  con "II"/"III" cuando floors ≥ 2 (consumido por splitModelTitle). */
  floors: number | null
  price_from: number | null

  // Disponibilidad
  systems: string[]                      // ['WOOD PLUS', 'STEEL PLUS']
  variantes_count: number
  skus: ModelVariant[]                   // todos los SKUs del grupo

  // Imagen principal (del modelo_images con mejor specificity)
  cover_url: string | null
  lqip_color: string

  // Destaque (item 3d). Min de los featured_rank de los SKUs del grupo;
  // null = no destacado. Menor = más destacado. Usado por el sort
  // "Más Relevante" y el helper getFeaturedModels del footer.
  featured_rank: number | null

  // Flag de la marca dueña del grupo: si true, el catálogo público muestra
  // precios de los SKUs; si false, muestra "Cotizar". Default false.
  show_prices: boolean

  // Datos de la marca dueña del grupo (para mostrar en CTA flotante,
  // breadcrumbs cross-marca en /catalogo, etc.). null si el grupo no tiene
  // marca asociada en DB.
  marca_id: string | null
  marca_name: string | null
  marca_logo_url: string | null
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
  if (DISPLAY_NAMES[style_name]) return `Casa ${DISPLAY_NAMES[style_name]}`
  // Fallback: title-case (ANCHICO → Casa Anchico, AMBA'Y → Casa Amba'y).
  // El style_name ya viene con acentos correctos en la DB tras el rename.
  if (!style_name) return style_name
  return `Casa ${style_name[0].toUpperCase()}${style_name.slice(1).toLowerCase()}`
}

/** Prefijo "Línea " + capitalización: "BOSQUE" → "Línea Bosque". Para tags y
 *  eyebrows del catálogo público. Si necesitás solo el nombre (en sentencias
 *  narrativas tipo "de la línea X"), usar `lineaTitleCase`. */
export function displayLinea(linea: string | null | undefined): string {
  if (!linea) return ''
  return `Línea ${lineaTitleCase(linea)}`
}

/** Solo title-case del nombre, sin prefijo "Línea". "BOSQUE" → "Bosque". */
export function lineaTitleCase(linea: string | null | undefined): string {
  if (!linea) return ''
  const bare = linea.replace(/^\s*L[ÍI]NEA\s+/i, '').trim()
  return bare ? bare[0].toUpperCase() + bare.slice(1).toLowerCase() : ''
}

// ─────────────────────────────────────────────────────────────────────────────
// Slug del grupo
// ─────────────────────────────────────────────────────────────────────────────

// Resuelve la oferta efectiva de un SKU: respeta `is_offer` + expiración por
// `offer_until` (si la fecha pasó, deactivamos sin tocar el flag).
//
// Comparación de fechas: usamos la fecha del calendario (YYYY-MM-DD) en lugar
// de timestamps. `offer_until` representa el ÚLTIMO día válido de la promo
// inclusive. Comparamos contra la fecha de "hoy" en zona Argentina (UTC-3)
// para evitar el bug del UTC midnight (una promo que "expira el 27/05" no
// debe apagarse a las 21:00 AR del 26/05 cuando UTC ya cruzó al 27).
function todayYYYYMMDDInAR(): string {
  // Intl con timezone resuelve el día actual en AR sin depender del server TZ.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // 'en-CA' devuelve 2026-05-26 (formato ISO). Si por alguna razón el ICU
  // no devuelve eso, parseamos las parts.
  const parts = fmt.formatToParts(new Date())
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function resolveOffer(row: {
  is_offer?: boolean | null
  offer_pct?: number | null
  offer_label?: string | null
  offer_until?: string | null
}): { is_offer: boolean; offer_pct: number | null; offer_label: string | null } {
  if (!row.is_offer) return { is_offer: false, offer_pct: null, offer_label: null }
  if (row.offer_until) {
    // offer_until viene como "YYYY-MM-DD". Comparación lexicográfica = comparación
    // de fechas (ISO format). Activa si offer_until >= hoy_AR.
    const todayAR = todayYYYYMMDDInAR()
    const until = String(row.offer_until).slice(0, 10)
    if (until < todayAR) {
      return { is_offer: false, offer_pct: null, offer_label: null }
    }
  }
  return {
    is_offer: true,
    offer_pct: row.offer_pct ?? null,
    offer_label: row.offer_label ?? null,
  }
}

function lineaToken(linea: string): string {
  // Quita prefijo 'LÍNEA '/'LINEA ' y strip-ea diacríticos para que el slug
  // sobreviva al cambio de canónico 'BOSQUE' → 'LÍNEA BOSQUE'.
  const bare = (linea ?? '').replace(/^\s*L[ÍI]NEA\s+/i, '')
  return bare.normalize('NFD').replace(/[̀-ͯ]/g, '')
}
function styleToken(style_name: string): string {
  return (style_name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’`´]/g, '')
}
function groupSlug(
  linea: string,
  style_name: string,
  tipologia_code: string,
  variante: string | null | undefined,
): string {
  const base = [lineaToken(linea), styleToken(style_name), `t${tipologia_code}`]
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
  // Variante 1 (o sin variante) NO sufija — preserva los slugs históricos.
  // Variante ≥2 sufija `-v{N}` para que cada planta tenga su card y URL propia.
  const varBase = (variante ?? '').split('.')[0]
  if (!varBase || varBase === '1' || varBase === '0') return base
  return `${base}-v${varBase}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Query principal
// ─────────────────────────────────────────────────────────────────────────────

export async function getGroupedCatalog(
  supabase: SupabaseClient,
  opts: { linea?: string; marcaId?: string } = {}
): Promise<CatalogModel[]> {

  // 1) Traer todos los SKUs activos
  let query = supabase
    .from('house_catalog')
    .select('*')
    .eq('status', 'active')
    .order('linea').order('style_name').order('tipologia_code').order('variante')

  if (opts.linea) query = query.eq('linea', opts.linea)
  if (opts.marcaId) query = query.eq('marca_id', opts.marcaId)

  const { data: rows, error } = await query
  if (error) {
    console.error('[getGroupedCatalog]', error.message)
    return []
  }

  // 2) Agrupar por (linea, style_name, tipologia_code)
  const groupMap = new Map<string, ModelVariant[]>()
  const groupMeta = new Map<string, {
    linea: string
    segmento: string | null
    style_name: string
    estilo: string
    tipologia_code: string
    tipologia_code_new: string | null
    circulacion: string | null
    morfologia: string | null
    acceso: string | null
    area_social: string | null
    marca_id: string | null
  }>()

  for (const row of (rows ?? [])) {
    const key = groupSlug(row.linea, row.style_name, row.tipologia_code, row.variante)
    if (!groupMap.has(key)) {
      groupMap.set(key, [])
      groupMeta.set(key, {
        linea: row.linea,
        segmento: row.segmento,
        style_name: row.style_name,
        estilo: row.estilo,
        tipologia_code: row.tipologia_code,
        tipologia_code_new: row.tipologia_code_new ?? null,
        circulacion: row.circulacion ?? null,
        morfologia: row.morfologia ?? null,
        acceso: row.acceso ?? null,
        area_social: row.area_social ?? null,
        marca_id: row.marca_id ?? null,
      })
    }
    groupMap.get(key)!.push({
      id: row.id,
      sku: row.sku,
      variante: row.variante,
      area_m2: row.area_m2,
      area_semicubierta_m2: row.area_semicubierta_m2 ?? null,
      floors: row.floors,
      min_bedrooms: row.min_bedrooms,
      max_bedrooms: row.max_bedrooms,
      bedrooms_label: row.bedrooms_label,
      bathrooms: row.bathrooms,
      toilette: row.toilette ?? null,
      parrilla: row.parrilla ?? null,
      lavadero: row.lavadero ?? null,
      sistema_constructivo: row.sistema_constructivo,
      precio_lista_usd: row.precio_lista_usd,
      precio_contado_usd: row.precio_contado_usd,
      precio_pozo_usd: row.precio_pozo_usd,
      featured_rank: row.featured_rank ?? null,
      feature_delta: row.feature_delta ?? null,
      ...resolveOffer(row),
    })
  }

  // 2.5) Traer naming_strategy / variante_labels / concept_blurb por línea.
  // Index por nombre normalizado de la línea (sin "LÍNEA " prefix).
  function normLineaName(s: string): string {
    return (s ?? '').replace(/^\s*L[ÍI]NEA\s+/i, '').toUpperCase().trim()
  }
  const lineaMetaByName = new Map<string, {
    naming_strategy: NamingStrategy
    variante_labels: Record<string, string> | null
    concept_blurb: string | null
  }>()
  {
    const { data: lineasRows, error: lineasErr } = await supabase
      .from('lineas')
      .select('name, concept_blurb, naming_strategy, variante_labels')
    if (lineasErr) {
      console.error('[getGroupedCatalog] lineas:', lineasErr.message)
    }
    for (const l of (lineasRows ?? []) as Array<{
      name: string
      concept_blurb: string | null
      naming_strategy: unknown
      variante_labels: unknown
    }>) {
      const strategy = (l.naming_strategy && typeof l.naming_strategy === 'object'
        ? (l.naming_strategy as NamingStrategy)
        : DEFAULT_NAMING_STRATEGY)
      const labels = (l.variante_labels && typeof l.variante_labels === 'object'
        ? (l.variante_labels as Record<string, string>)
        : null)
      lineaMetaByName.set(normLineaName(l.name), {
        naming_strategy: strategy,
        variante_labels: labels,
        concept_blurb: l.concept_blurb ?? null,
      })
    }
  }

  // 3) Cover por grupo: linkear via model_image_skus → model_images.
  // (Antes usaba la vista house_images_resolved que joinea por columnas
  // denormalizadas style_name/linea/tipologia_code/variante. Eso falla para
  // imágenes con scope tipología — sin Casa X — y por mismatchs de acentos.
  // El nuevo flow consulta model_image_skus directamente y resuelve por
  // house_catalog_id, igual que el resto del catálogo público.)
  const coversByGroup = new Map<string, { url: string; lqip: string }>()

  // Paginar manualmente la query de links: PostgREST tiene cap server-side
  // (~1000) que `.range()` no siempre pasa.
  async function loadAllLinks() {
    const out: { image_id: string; house_catalog_id: string }[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('model_image_skus')
        .select('image_id, house_catalog_id')
        .range(from, from + PAGE - 1)
      if (error) {
        console.error('[getGroupedCatalog] links page error:', error.message)
        break
      }
      if (!data || data.length === 0) break
      out.push(...(data as { image_id: string; house_catalog_id: string }[]))
      if (data.length < PAGE) break
      from += PAGE
    }
    return out
  }

  const [allLinks, imgsRes] = await Promise.all([
    loadAllLinks(),
    supabase
      .from('model_images')
      .select('id, storage_url, thumb_url, webp_url, lqip_color, sort_order, view_label')
      .neq('status', 'archived')
      .eq('is_exterior', true)
      .eq('image_type', 'render')
      .order('sort_order', { ascending: true }),
  ])

  if (imgsRes.error) console.error('[getGroupedCatalog] imgs:', imgsRes.error.message)

  // Index image_id → image (solo exteriores tipo render).
  // El cover del catálogo se usa en cards/listados → preferimos thumb_url
  // (~400px WebP). Fallback a webp_url (full) y por último al original.
  // `isFrente`: el cover SIEMPRE debe ser una foto de frente — una imagen
  // "Frente" (view_label) le gana a cualquier contrafrente/lateral aunque
  // tenga sort_order mayor.
  const imgById = new Map<
    string,
    { url: string; lqip: string; sort_order: number; isFrente: boolean }
  >()
  for (const img of imgsRes.data ?? []) {
    imgById.set(img.id, {
      url: img.thumb_url ?? img.webp_url ?? img.storage_url,
      lqip: img.lqip_color ?? '#d4d4cc',
      sort_order: img.sort_order,
      isFrente: (img.view_label ?? '')
        .trim()
        .toLowerCase()
        .startsWith('frente'),
    })
  }

  // Para cada SKU (house_catalog_id), la mejor foto de cover: frente le gana
  // a no-frente; a igualdad, menor sort_order. Una imagen puede aplicar a
  // múltiples SKUs vía model_image_skus.
  const coverByHouseCatalogId = new Map<
    string,
    { url: string; lqip: string; sort_order: number; isFrente: boolean }
  >()
  for (const link of allLinks) {
    const img = imgById.get(link.image_id)
    if (!img) continue
    const existing = coverByHouseCatalogId.get(link.house_catalog_id)
    const better =
      !existing ||
      (img.isFrente && !existing.isFrente) ||
      (img.isFrente === existing.isFrente &&
        img.sort_order < existing.sort_order)
    if (better) {
      coverByHouseCatalogId.set(link.house_catalog_id, img)
    }
  }

  // Para cada grupo, usar la foto del primer SKU del grupo que tenga cover.
  for (const [key, skus] of groupMap) {
    for (const s of skus) {
      const cover = coverByHouseCatalogId.get(s.id)
      if (cover) {
        coversByGroup.set(key, { url: cover.url, lqip: cover.lqip })
        break
      }
    }
  }

  // 3.5) Para cada marca presente en los grupos, traer su flag show_prices.
  const marcaIds = [
    ...new Set(
      [...groupMeta.values()]
        .map((m) => m.marca_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const showPricesByMarca = new Map<string, boolean>()
  const nameByMarca = new Map<string, string>()
  if (marcaIds.length > 0) {
    const { data: marcasData, error: marcasErr } = await supabase
      .from('marcas')
      .select('id, name, show_prices')
      .in('id', marcaIds)
    if (marcasErr) {
      console.error('[getGroupedCatalog] marcas:', marcasErr.message)
    }
    for (const m of (marcasData ?? []) as { id: string; name: string; show_prices: boolean }[]) {
      showPricesByMarca.set(m.id, m.show_prices ?? false)
      nameByMarca.set(m.id, m.name)
    }
  }

  // Isotipo (iso_url) por marca — va en la ficha del listado EN LUGAR del
  // isologo (decisión del dueño, al menos por ahora). Query separada y
  // resiliente: si la columna iso_url todavía no existe (migración 0026 sin
  // aplicar) degrada a vacío SIN romper el resto del catálogo (precios,
  // nombres, etc. quedan intactos). Sin fallback al isologo: "ahí va solo iso".
  const isoByMarca = new Map<string, string | null>()
  if (marcaIds.length > 0) {
    const { data: isoData, error: isoErr } = await supabase
      .from('marcas')
      .select('id, iso_url')
      .in('id', marcaIds)
    if (isoErr) {
      console.error('[getGroupedCatalog] iso_url (¿migración 0026?):', isoErr.message)
    }
    for (const m of (isoData ?? []) as { id: string; iso_url: string | null }[]) {
      isoByMarca.set(m.id, m.iso_url ?? null)
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
    const ranks = skus.map(s => s.featured_rank).filter(v => v != null) as number[]

    const lineaMeta = lineaMetaByName.get(normLineaName(meta.linea))
    const strategy = lineaMeta?.naming_strategy ?? DEFAULT_NAMING_STRATEGY
    // Display name: si el modelo está backfilleado con los 4 ejes (post-0090),
    // el helper compone "Casa EJES CUBO Pampa" (modo nuevo). Si no, fallback
    // al legacy basado en tipologia_code_new ("CASA NODO PAMPA"). Y si la
    // línea ni siquiera tiene tipologia_code_new, fallback duro a "Casa Pampa".
    const hasNew = meta.circulacion && meta.morfologia
    // Post-split por variante, todos los SKUs del grupo comparten floors.
    // Tomamos el mayor por defensive (no debería diferir).
    const floorsForName = floors_all.length ? Math.max(...floors_all) : null
    const displayNameComposed = (hasNew || meta.tipologia_code_new)
      ? displayModelTitle({
          style_name: meta.style_name,
          tipologia_code_new: meta.tipologia_code_new,
          circulacion: meta.circulacion,
          morfologia: meta.morfologia,
          strategy,
          floors: floorsForName,
        })
      : floorsForName && floorsForName >= 2
        ? `${displayName(meta.style_name)} ${floorsForName === 3 ? 'III' : 'II'}`
        : displayName(meta.style_name)

    models.push({
      group_slug: key,
      linea: meta.linea,
      segmento: meta.segmento,
      style_name: meta.style_name,
      display_name: displayNameComposed,
      estilo: meta.estilo,
      tipologia_code: meta.tipologia_code,
      tipologia_code_new: meta.tipologia_code_new,
      circulacion: meta.circulacion,
      morfologia: meta.morfologia,
      acceso: meta.acceso,
      area_social: meta.area_social,
      naming_strategy: strategy,
      variante_labels: lineaMeta?.variante_labels ?? null,
      concept_blurb: lineaMeta?.concept_blurb ?? null,
      area_min: areas.length ? Math.min(...areas) : null,
      area_max: areas.length ? Math.max(...areas) : null,
      beds_min: beds_min_all.length ? Math.min(...beds_min_all) : null,
      beds_max: beds_max_all.length ? Math.max(...beds_max_all) : null,
      floors_options,
      floors: floorsForName,
      price_from: prices.length ? Math.min(...prices) : null,
      systems: uniqueSystems,
      variantes_count: uniqueVariantes.length,
      skus,
      cover_url: cover?.url ?? null,
      lqip_color: cover?.lqip ?? '#d4d4cc',
      featured_rank: ranks.length ? Math.min(...ranks) : null,
      show_prices: meta.marca_id
        ? showPricesByMarca.get(meta.marca_id) ?? false
        : false,
      marca_id: meta.marca_id,
      marca_name: meta.marca_id ? nameByMarca.get(meta.marca_id) ?? null : null,
      // Nota: el campo se sigue llamando marca_logo_url (lo consume ModelRow)
      // pero su fuente ahora es el isotipo (iso_url), no el isologo.
      marca_logo_url: meta.marca_id ? isoByMarca.get(meta.marca_id) ?? null : null,
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
  // Post-mig 0023, el slug ya no permite reconstruir linea/style canónicos
  // (LÍNEA BOSQUE → 'lneabosque', AMBA'Y → 'ambay'). Resolvemos via el catálogo
  // agrupado y tomamos los valores canónicos del CatalogModel.
  const catalogAll = await getGroupedCatalog(supabase)
  const target = catalogAll.find((m) => m.group_slug === group_slug)
  if (!target) return null

  const { data: rows } = await supabase
    .from('house_catalog')
    .select('*')
    .eq('linea', target.linea)
    .eq('style_name', target.style_name)
    .eq('tipologia_code', target.tipologia_code)
    .eq('status', 'active')
    .order('variante')

  if (!rows?.length) return null

  const skus = rows.map(r => r.sku)

  // Fotos exteriores (sin room_type) e interiores (con room_type)
  const { data: imgs } = await supabase
    .from('house_images_resolved')
    .select('sku, image_id, storage_url, lqip_color, is_exterior, room_type, sort_order, specificity')
    .in('sku', skus)
    .order('specificity', { ascending: false })
    .order('sort_order', { ascending: true })

  // La vista `house_images_resolved` no expone thumb_url/webp_url. Hacemos
  // un join post-fetch a model_images para traer las versiones optimizadas.
  // Galería expandida usa webp_url (~1920px); thumb_url no se usa aquí.
  const imageIds = [...new Set((imgs ?? []).map((i) => i.image_id).filter(Boolean))]
  const optimizedById = new Map<string, { webp_url: string | null }>()
  if (imageIds.length > 0) {
    const { data: optRows } = await supabase
      .from('model_images')
      .select('id, webp_url')
      .in('id', imageIds)
    for (const r of (optRows ?? []) as { id: string; webp_url: string | null }[]) {
      optimizedById.set(r.id, { webp_url: r.webp_url })
    }
  }

  const pickFull = (img: { image_id: string; storage_url: string }) =>
    optimizedById.get(img.image_id)?.webp_url ?? img.storage_url

  // Deduplicar por URL (misma foto puede aparecer en múltiples SKUs del grupo)
  const extUrls = new Set<string>()
  const intUrls = new Set<string>()
  const exterior_images: GroupDetail['exterior_images'] = []
  const interior_images: GroupDetail['interior_images'] = []

  for (const img of (imgs ?? [])) {
    const url = pickFull(img)
    if (img.is_exterior && !extUrls.has(url)) {
      extUrls.add(url)
      exterior_images.push({ url, lqip: img.lqip_color ?? '#d4d4cc', room_type: null, sort_order: img.sort_order })
    }
    if (!img.is_exterior && !intUrls.has(url)) {
      intUrls.add(url)
      interior_images.push({ url, lqip: img.lqip_color ?? '#d4d4cc', room_type: img.room_type ?? 'interior', sort_order: img.sort_order })
    }
  }

  // Construir el modelo del grupo: ya lo tenemos resuelto arriba (`target`),
  // que vino de `getGroupedCatalog(supabase)` con linea canónica. Reusamos.
  return { model: target, exterior_images, interior_images }
}
