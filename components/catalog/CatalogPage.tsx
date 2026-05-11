'use client'

/**
 * components/catalog/CatalogPage.tsx
 *
 * Orquesta:
 *   1. HeroSlider arriba (5 slides educativos)
 *   2. Filtros sticky
 *   3. Grilla de modelos agrupados (por línea, alternando lado)
 *   4. Detail slider overlay (abre al clickear una tarjeta)
 *
 * El detail slider tiene 5 estaciones:
 *   Portada / Exteriores / Interiores / Comparador / Datos
 *
 * Se cierra con el botón X (top-right, siempre visible) o al scrollear hacia abajo.
 */
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { BrandContent, LineContent } from './HeroSlider'
import SiteHeader from '@/components/SiteHeader'
import HeroRow, { type GrowthPair, type LineaModelo } from './HeroRow'
import StickyFilters from './StickyFilters'
import ModelRow from './ModelRow'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import { displayLinea } from '@/lib/supabase/queries/catalog_grouped'
import type { LineaRow } from '@/lib/supabase/queries/lineas'
import type { Marca } from '@/types/database'
import type { FooterCardRow } from '@/lib/supabase/queries/footer'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import type {
  CatalogImage,
  CatalogAttributeRow,
} from '@/lib/supabase/queries/catalog_panels'
import { buildCotizarMailto } from '@/lib/cta/mailto'
import CatalogFooter from './CatalogFooter'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  models: CatalogModel[]
  brandContent?: BrandContent[]
  lineContent?: LineContent[]
  lineas?: LineaRow[]
  /** Marcas aprobadas — usadas en las cards del marquee del footer. */
  marcas?: Marca[]
  /** Map indexado por `${linea}::${style_name}` → fila de model_content. */
  modelContentMap?: Record<string, ModelContentRow>
  /** Todas las imágenes del catálogo. ModelRow filtra las que aplican al modelo. */
  catalogImages?: CatalogImage[]
  /** Todos los pairs (catalog × attribute_value). ModelRow filtra por house_catalog_id de sus SKUs. */
  catalogAttributes?: CatalogAttributeRow[]
  /** Modelos featured (ordenados por featured_rank asc) para el mini marquee del footer. */
  featuredModels?: CatalogModel[]
  /** Footer cards editables por marca, indexadas por marca_id. Si una marca
   *  no tiene cards, el CatalogFooter usa el fallback hardcoded. */
  footerCardsByMarca?: Record<string, FooterCardRow[]>
}

type Station = 'portada' | 'exteriores' | 'interiores' | 'comparador' | 'datos'

const STATIONS: { id: Station; label: string }[] = [
  { id: 'portada', label: 'Portada' },
  { id: 'exteriores', label: 'Exteriores' },
  { id: 'interiores', label: 'Interiores' },
  { id: 'comparador', label: 'Comparador' },
  { id: 'datos', label: 'Datos' },
]

const LINE_ORDER = ['ATLAS', 'BOSQUE', 'TERRA']

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function CatalogPage({
  models = [],
  brandContent = [],
  lineContent = [],
  lineas = [],
  marcas = [],
  modelContentMap = {},
  catalogImages = [],
  catalogAttributes = [],
  featuredModels = [],
  footerCardsByMarca = {},
}: PageProps) {
  const [activeModel, setActiveModel] = useState<CatalogModel | null>(null)
  const [station, setStation] = useState<Station>('portada')
  // '' significa "sin filtrar" (mostrar todos). Antes había un valor 'ALL'
  // explícito; lo eliminamos para que la barra no muestre la opción "todos".
  const [estiloFilter, setEstiloFilter] = useState<string>('')
  // Multi-select: arrays. '' inicial sería un valor inválido, así que arrays vacíos.
  const [bedFilters, setBedFilters] = useState<string[]>([])
  const [sizeFilters, setSizeFilters] = useState<string[]>([])
  const [sortOrder, setSortOrder] = useState<string>('recommended')

  // Helpers de toggle: agregan o quitan un valor del array.
  const toggleBed = (v: string) =>
    setBedFilters((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))
  const toggleSize = (v: string) =>
    setSizeFilters((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))


  const detailRef = useRef<HTMLDivElement>(null)
  const detailTrackRef = useRef<HTMLDivElement>(null)

  // ── Filter models ──
  // Convención: filtro vacío ('') = "sin filtrar". Se aceptan estos valores:
  //   estiloFilter: '' | <nombre exacto del estilo>
  //   bedFilter:    '' | '1' | '2' | '3' | '4+'
  //   sizeFilter:   '' | 'S' | 'SM' | 'M' | 'L' | 'XL' | 'XXL'

  // Predicados puros (reusables tanto en filter principal como en cálculo
  // de "qué opciones están enabled").
  const skuMatchesBed = (sku: CatalogModel['skus'][number], bf: string): boolean => {
    const bMin = sku.min_bedrooms ?? 0
    const bMax = sku.max_bedrooms ?? bMin
    if (bf === '4+') return bMax >= 4
    const n = Number(bf)
    return bMax >= n && bMin <= n
  }
  const skuMatchesSize = (sku: CatalogModel['skus'][number], sf: string): boolean => {
    const a = sku.area_m2 ?? 0
    // 5 buckets por perfil — labels en StickyFilters.SIZE_OPTIONS.
    if (sf === 'S') return a < 70                    // cabaña / individual
    if (sf === 'SM') return a >= 70 && a < 90        // pareja / familia chica
    if (sf === 'M') return a >= 90 && a < 120        // familiar
    if (sf === 'L') return a >= 120 && a < 200       // familia grande
    if (sf === 'XL') return a >= 200                 // premium
    return true
  }

  // Match contra los arrays de filtros activos. Lógica OR dentro del mismo
  // filtro (bedFilters=[2,3] → bed=2 OR bed=3), AND entre filtros distintos
  // (beds=[2] AND sizes=[M] → bed=2 Y size=M).
  const skuMatchesFilters = (sku: CatalogModel['skus'][number]): boolean => {
    if (bedFilters.length > 0 && !bedFilters.some((b) => skuMatchesBed(sku, b))) return false
    if (sizeFilters.length > 0 && !sizeFilters.some((s) => skuMatchesSize(sku, s))) return false
    return true
  }

  // Modelo visible si está pasa el estilo Y al menos un SKU pasa los filtros.
  // El sort por precio usa price_from interno (los precios no se muestran al
  // público pero la data sigue siendo válida para ordenar).
  const filtered = models.filter(m => {
    if (estiloFilter && m.estilo !== estiloFilter) return false
    if (bedFilters.length === 0 && sizeFilters.length === 0) return true
    return m.skus.some(skuMatchesFilters)
  }).sort((a, b) => {
    if (sortOrder === 'price-asc') return (a.price_from ?? 0) - (b.price_from ?? 0)
    if (sortOrder === 'price-desc') return (b.price_from ?? 0) - (a.price_from ?? 0)
    if (sortOrder === 'recommended') {
      // featured_rank asc, NULL al final.
      const ra = a.featured_rank
      const rb = b.featured_rank
      if (ra == null && rb == null) return 0
      if (ra == null) return 1
      if (rb == null) return -1
      return ra - rb
    }
    return 0
  })

  // Lista única de estilos disponibles, ordenada alfabéticamente. Alimenta
  // el dropdown de Estilo en la barra sticky.
  const availableEstilos = Array.from(new Set(models.map((m) => m.estilo).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'))

  // ── Filtros dinámicos: qué opciones tendrían al menos 1 modelo si se
  // combinaran con los OTROS filtros activos. Las que no, van disabled en
  // la barra sticky para evitar que el usuario llegue a un listado vacío.
  const BED_OPTIONS = ['1', '2', '3', '4+']
  const SIZE_OPTIONS = ['S', 'SM', 'M', 'L', 'XL']

  // ¿Hay al menos 1 modelo que pase (estilo, beds[], sizes[])?
  // Misma lógica OR-dentro/AND-entre que skuMatchesFilters, pero con arrays
  // que el caller controla.
  const hasResultsFor = (estilo: string, beds: string[], sizes: string[]): boolean =>
    models.some((m) => {
      if (estilo && m.estilo !== estilo) return false
      if (beds.length === 0 && sizes.length === 0) return true
      return m.skus.some((s) => {
        if (beds.length > 0 && !beds.some((b) => skuMatchesBed(s, b))) return false
        if (sizes.length > 0 && !sizes.some((sz) => skuMatchesSize(s, sz))) return false
        return true
      })
    })

  // Una opción está enabled si: ya está activa (para destildarla) O el
  // resultado de tener SOLO esa opción activa (junto con los filtros de
  // los otros ejes) tiene al menos 1 modelo. En multi-select basta con que
  // por sí sola haya match — se va a unir vía OR con las ya activas.
  const enabledBeds = new Set(
    BED_OPTIONS.filter(
      (b) => bedFilters.includes(b) || hasResultsFor(estiloFilter, [b], sizeFilters),
    ),
  )
  const enabledSizes = new Set(
    SIZE_OPTIONS.filter(
      (s) => sizeFilters.includes(s) || hasResultsFor(estiloFilter, bedFilters, [s]),
    ),
  )
  const enabledEstilos = new Set(
    availableEstilos.filter(
      (e) => estiloFilter === e || hasResultsFor(e, bedFilters, sizeFilters),
    ),
  )

  // ── Group by line ──
  const grouped = LINE_ORDER.reduce((acc, line) => {
    const items = filtered.filter(m => m.linea === line)
    if (items.length) acc[line] = items
    return acc
  }, {} as Record<string, CatalogModel[]>)

  // ── Map name → icon_url para resolver el ícono de cada modelo en el catálogo ──
  // El nombre de la línea en `lineas.name` está en MAYÚSCULAS (normalizado por
  // el action) y coincide con `house_catalog.linea` (poblada por el trigger).
  //
  // Prioridad: lo que esté cargado en el admin (`l.icon_url`) gana siempre.
  // Si una línea no tiene icon_url cargado, caemos a los archivos curados en
  // /public para las 3 líneas Hausind. Para otras líneas (Patagonia, futuras)
  // sin icon_url y sin fallback, queda null y no se muestra ícono.
  const LINEA_ICON_FALLBACK: Record<string, string> = {
    BOSQUE: '/bosque-icon.png',
    ATLAS: '/atlas-icon.png',
    TERRA: '/terra-icon.png',
  }
  const iconByLineaName: Record<string, string | null> = lineas.reduce(
    (acc, l) => {
      const key = l.name.toUpperCase()
      acc[l.name] = l.icon_url ?? LINEA_ICON_FALLBACK[key] ?? null
      return acc
    },
    {} as Record<string, string | null>,
  )

  // ── Map name → cover_url para usar como fondo del slide de cada línea
  // en el HeroRow. Si la línea no tiene hero_image_url cargado, fallback a
  // la primera cover_url de un modelo de esa línea.
  const coverByLineaName: Record<string, string | null> = lineas.reduce(
    (acc, l) => {
      const m = models.find((mod) => mod.linea === l.name && mod.cover_url)
      acc[l.name] = l.hero_image_url ?? m?.cover_url ?? null
      return acc
    },
    {} as Record<string, string | null>,
  )

  // ── Map linea (UPPERCASE) → array de URLs únicas para el marquee del
  // LineaModal. Priorizamos exteriores (más representativas) y filtramos
  // planos/axos. Dedupeamos por image id (algunas fotos aplican a múltiples SKUs).
  const lineaPhotosByName: Record<string, string[]> = (() => {
    const byLinea: Record<string, Map<string, string>> = {}
    for (const img of catalogImages) {
      if (!img.linea) continue
      if (img.image_type === 'plano' || img.image_type === 'axo') continue
      if (img.is_exterior !== true) continue
      const key = img.linea.toUpperCase()
      if (!byLinea[key]) byLinea[key] = new Map()
      byLinea[key].set(img.id, img.storage_url)
    }
    const out: Record<string, string[]> = {}
    for (const [k, m] of Object.entries(byLinea)) {
      out[k] = Array.from(m.values())
    }
    return out
  })()

  // ── Modelos únicos por linea (agrupados por style_name). Cada modelo
  // del catálogo es por (linea, style_name, tipologia_code); acá los
  // consolidamos por style_name y junteamos las tipologías disponibles.
  // Se usa en el grid de la LineaModal del HeroRow.
  const modelosByLineaName: Record<string, LineaModelo[]> = (() => {
    const byLinea: Record<string, Map<string, LineaModelo>> = {}
    for (const m of models) {
      const lineaKey = m.linea.toUpperCase()
      if (!byLinea[lineaKey]) byLinea[lineaKey] = new Map()
      const bucket = byLinea[lineaKey]
      const existing = bucket.get(m.style_name)
      if (!existing) {
        bucket.set(m.style_name, {
          style_name: m.style_name,
          display_name: m.display_name,
          cover_url: m.cover_url ?? null,
          lqip_color: m.lqip_color ?? '#d4d4cc',
          estilo: m.estilo ?? '',
          tipologias: m.tipologia_code ? [m.tipologia_code] : [],
          group_slugs: [m.group_slug],
        })
      } else {
        if (m.tipologia_code && !existing.tipologias.includes(m.tipologia_code)) {
          existing.tipologias.push(m.tipologia_code)
        }
        if (!existing.group_slugs.includes(m.group_slug)) {
          existing.group_slugs.push(m.group_slug)
        }
        // Preferimos la cover_url más rica (cualquiera con valor).
        if (!existing.cover_url && m.cover_url) existing.cover_url = m.cover_url
      }
    }
    const out: Record<string, LineaModelo[]> = {}
    for (const [k, m] of Object.entries(byLinea)) {
      const arr = Array.from(m.values())
      arr.forEach((x) => x.tipologias.sort())
      arr.sort((a, b) => a.display_name.localeCompare(b.display_name))
      out[k] = arr
    }
    return out
  })()

  // ── Pares 1 planta / 2 plantas para la animación "La Casa que Crece" ──
  // En Bosque cada modelo tiene una sola fila con floors_options "1 ó 2",
  // y las dos versiones viven como skus distintos (cada uno con su `floors`
  // y `variante`). Buscamos la foto exterior que matchee la variante de
  // cada sku para armar el par.
  const growthPairs: GrowthPair[] = (() => {
    const bosque = models.filter((m) => m.linea === 'BOSQUE')
    const pairs: GrowthPair[] = []

    const findExteriorForSku = (skuId: string): string | undefined => {
      // Imágenes exteriores (no planos) linkeadas a ese SKU vía model_image_skus.
      const candidates = catalogImages.filter(
        (img) =>
          img.is_exterior === true &&
          img.image_type !== 'plano' &&
          img.sku_ids.includes(skuId),
      )
      return candidates[0]?.storage_url
    }

    for (const model of bosque) {
      const sku1 = model.skus.find((s) => s.floors === 1)
      const sku2 = model.skus.find((s) => s.floors === 2)
      if (!sku1 || !sku2) continue

      const imgOfSku1 = findExteriorForSku(sku1.id)
      const imgOfSku2 = findExteriorForSku(sku2.id)

      if (imgOfSku1 && imgOfSku2 && imgOfSku1 !== imgOfSku2) {
        pairs.push({
          name: model.display_name,
          img1: imgOfSku1, // sku con floors=1 → foto de 1 planta
          img2: imgOfSku2, // sku con floors=2 → foto de 2 plantas
        })
      }
    }
    return pairs
  })()

  // ── Open / close detail ──
  const openDetail = useCallback((model: CatalogModel) => {
    setActiveModel(model)
    setStation('portada')
    document.body.style.overflow = 'hidden'
  }, [])

  const closeDetail = useCallback(() => {
    setActiveModel(null)
    document.body.style.overflow = ''
    if (detailRef.current) {
      detailRef.current.style.transform = 'translateX(100%)'
    }
  }, [])

  useEffect(() => {
    const el = detailTrackRef.current
    if (!el || !activeModel) return

    const firstStation = el.children[0] as HTMLElement
    if (!firstStation) return

    let startY = 0

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
    }

    const onTouchEnd = (e: TouchEvent) => {
      const dy = e.changedTouches[0].clientY - startY
      if (dy > 80 && station === 'portada' && firstStation.scrollTop < 10) {
        closeDetail()
      }
    }

    const onScroll = () => {
      if (station === 'portada' && firstStation.scrollTop > 60) {
        closeDetail()
      }
    }

    firstStation.addEventListener('scroll', onScroll)
    firstStation.addEventListener('touchstart', onTouchStart)
    firstStation.addEventListener('touchend', onTouchEnd)

    return () => {
      firstStation.removeEventListener('scroll', onScroll)
      firstStation.removeEventListener('touchstart', onTouchStart)
      firstStation.removeEventListener('touchend', onTouchEnd)
    }
  }, [activeModel, station, closeDetail])

  // ── Navigate stations ──
  const goToStation = useCallback((s: Station) => {
    setStation(s)
    const track = detailTrackRef.current
    if (!track) return
    const idx = STATIONS.findIndex(st => st.id === s)
    const slide = track.children[idx] as HTMLElement
    if (slide) slide.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
  }, [])

  // Sync station from scroll
  useEffect(() => {
    const track = detailTrackRef.current
    if (!track) return
    let timer: ReturnType<typeof setTimeout>
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const w = track.clientWidth || 1
        const idx = Math.round(track.scrollLeft / w)
        const s = STATIONS[idx]
        if (s) setStation(s.id)
      }, 80)
    }
    track.addEventListener('scroll', onScroll)
    return () => { track.removeEventListener('scroll', onScroll); clearTimeout(timer) }
  }, [activeModel])

  // Animate detail open/close
  useEffect(() => {
    const el = detailRef.current
    if (!el) return
    if (activeModel) {
      el.style.transform = 'translateX(0)'
    } else {
      el.style.transform = 'translateX(100%)'
    }
  }, [activeModel])

  return (
    <>
      {/* ── Header del sitio (NO sticky) ── */}
      <SiteHeader />

      {/* ── Hero row: primera fila siempre desplegada ── */}
      <HeroRow
        brandContent={brandContent}
        lineContent={lineContent}
        lineas={lineas}
        lineaCoverByName={coverByLineaName}
        growthPairs={growthPairs}
        lineaPhotosByName={lineaPhotosByName}
        modelosByLineaName={modelosByLineaName}
      />

      {/* ── Filtros sticky en color CF ── */}
      <StickyFilters
        estiloFilter={estiloFilter}
        bedFilters={bedFilters}
        sizeFilters={sizeFilters}
        sortOrder={sortOrder}
        availableEstilos={availableEstilos}
        enabledBeds={enabledBeds}
        enabledSizes={enabledSizes}
        enabledEstilos={enabledEstilos}
        onEstiloChange={setEstiloFilter}
        onBedToggle={toggleBed}
        onSizeToggle={toggleSize}
        onSortChange={setSortOrder}
      />

      {/* ── Grilla agrupada por línea (sin group-header) ── */}
      <div className="cf-grid">
        {Object.entries(grouped).map(([line, items], gi) => (
          <div key={line}>
            {/* Filas */}
            {items.map((model, i) => {
              const mcKey = `${model.linea}::${model.style_name}`
              const mc = modelContentMap[mcKey] ?? null

              // Si hay filtros de bed/size activos, filtramos los SKUs del
              // modelo a los que matchean. Las imágenes y atributos siguen
              // los SKUs filtrados, así el slider del expandido y el panel
              // de variantes solo muestran las que el usuario buscó.
              const hasSkuFilter = bedFilters.length > 0 || sizeFilters.length > 0
              const activeSkus = hasSkuFilter
                ? model.skus.filter(skuMatchesFilters)
                : model.skus
              const activeSkuIds = new Set(activeSkus.map((s) => s.id))

              const modelImages = catalogImages.filter((img) =>
                img.sku_ids.some((id) => activeSkuIds.has(id)),
              )
              const modelAttributes = catalogAttributes.filter((a) =>
                activeSkuIds.has(a.house_catalog_id),
              )

              // Foto del listado: si hay filtros activos, prioriza la
              // foto MÁS ESPECÍFICA de la variante (la que tiene menos
              // SKUs linkeados — idealmente solo el activeSku). Si todas
              // las fotos están linkeadas a todos los SKUs del grupo, cae
              // a la primera disponible (no hay foto distintiva en DB).
              const dynamicCoverImg = hasSkuFilter
                ? modelImages
                    .filter(
                      (img) =>
                        img.is_exterior === true &&
                        img.image_type === 'render',
                    )
                    .sort((a, b) => a.sku_ids.length - b.sku_ids.length)[0]
                : null
              const dynamicCoverUrl =
                dynamicCoverImg?.storage_url ?? model.cover_url

              // Otros modelos en la misma (linea, tipologia_code) — para panel 5.
              // Usa `models` raw (no `filtered`) porque el panel Estilos quiere
              // mostrar SIEMPRE toda la oferta de estilos de la tipología, sin
              // que el filtro de estilo activo lo deje vacío.
              const otherStyles = models.filter(
                (m) =>
                  m.linea === model.linea &&
                  m.tipologia_code === model.tipologia_code &&
                  m.group_slug !== model.group_slug,
              )

              return (
                <ModelRow
                  key={model.group_slug}
                  model={model}
                  index={i}
                  onOpen={openDetail}
                  modelContent={mc}
                  images={modelImages}
                  activeSkus={activeSkus}
                  coverUrl={dynamicCoverUrl}
                  brandContent={brandContent}
                  lineContent={lineContent}
                  attributesForCatalogIds={modelAttributes}
                  otherStyles={otherStyles}
                  modelContentMap={modelContentMap}
                  allModels={filtered}
                  lineaIconUrl={iconByLineaName[model.linea] ?? null}
                />
              )
            })}

            {/* CTA entre Atlas y Bosque */}
            {gi === 0 && (
              <div className="cf-mid-cta">
                <h3>¿Te ayudo a elegir?</h3>
                <p>Pedí una cotización y te ayudamos a encontrar la casa que mejor se adapta a vos.</p>
                <a
                  className="cf-mid-cta-btn"
                  href={buildCotizarMailto()}
                >
                  Cotizar
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Footer del catálogo (cierre + marquee + base) ── */}
      <CatalogFooter
        featuredModels={featuredModels}
        marcas={marcas}
        footerCardsByMarca={footerCardsByMarca}
        onOpenModel={openDetail}
      />

      {/* ── Detail slider overlay ── */}
      <div
        ref={detailRef}
        className="cf-detail"
        style={{ transform: 'translateX(100%)' }}
        aria-hidden={!activeModel}
      >
        {activeModel && (
          <>
            {/* Detail nav */}
            <div className="cf-detail-nav">
              <button className="cf-detail-back" onClick={closeDetail}>← Volver</button>
              <div className="cf-detail-stations">
                {STATIONS.map(s => (
                  <button
                    key={s.id}
                    className={`cf-station-btn ${station === s.id ? 'active' : ''}`}
                    onClick={() => goToStation(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {/* Botón X siempre visible */}
              <button className="cf-detail-close" onClick={closeDetail} aria-label="Cerrar">✕</button>
            </div>

            {/* Detail track horizontal */}
            <div ref={detailTrackRef} className="cf-detail-track">

              {/* PORTADA */}
              <div className="cf-station">
                <StationPortada model={activeModel} />
              </div>

              {/* EXTERIORES */}
              <div className="cf-station">
                <StationCamera
                  label="Exteriores"
                  model={activeModel}
                  isExterior
                />
              </div>

              {/* INTERIORES */}
              <div className="cf-station">
                <StationCamera
                  label="Interiores"
                  model={activeModel}
                  isExterior={false}
                />
              </div>

              {/* COMPARADOR */}
              <div className="cf-station">
                <StationCompare model={activeModel} />
              </div>

              {/* DATOS */}
              <div className="cf-station">
                <StationDatos model={activeModel} />
              </div>

            </div>
          </>
        )}
      </div>

    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Estación: Portada
// ─────────────────────────────────────────────────────────────────────────────

export function StationPortada({ model }: { model: CatalogModel }) {
  return (
    <div className="cf-st-portada" style={{
      backgroundImage: model.cover_url
        ? `linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.7)), url('${model.cover_url}')`
        : undefined,
      backgroundColor: model.cover_url ? undefined : model.lqip_color,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div className="cf-st-portada-content">
        <p className="cf-st-portada-eyebrow">{displayLinea(model.linea)} · {model.estilo}</p>
        <h1 className="cf-st-portada-name">{model.display_name}</h1>
        <p className="cf-st-portada-meta">
          {model.area_min && model.area_max ? `${Math.round(model.area_min)}–${Math.round(model.area_max)} m²` : '—'} · {model.variantes_count} variantes
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Estación: Camera switcher (Exteriores / Interiores)
// ─────────────────────────────────────────────────────────────────────────────

const EXTERIOR_ROOMS = ['Frente', 'Lateral', 'Atrás', 'Vista aérea']
const INTERIOR_ROOMS = ['Living', 'Cocina', 'Dormitorio', 'Baño', 'Galería']

export function StationCamera({
  label,
  model,
  isExterior,
}: {
  label: string
  model: CatalogModel
  isExterior: boolean
}) {
  const rooms = isExterior ? EXTERIOR_ROOMS : INTERIOR_ROOMS
  const [active, setActive] = useState(0)

  // Placeholder: en producción vendría de model.exterior_images / interior_images
  const coverUrl = model.cover_url ?? ''

  return (
    <div
      className="cf-st-camera"
      style={{
        backgroundImage: coverUrl ? `url('${coverUrl}')` : undefined,
        backgroundColor: coverUrl ? undefined : model.lqip_color,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <span className="cf-camera-label">{label}</span>

      {/* Pills sobre la foto */}
      <div className="cf-camera-pills">
        {rooms.map((room, i) => (
          <button
            key={room}
            className={`cf-camera-pill ${i === active ? 'active' : ''}`}
            onClick={() => setActive(i)}
          >
            {room}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Estación: Comparador (clip-path)
// ─────────────────────────────────────────────────────────────────────────────

export function StationCompare({ model }: { model: CatalogModel }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [mode, setMode] = useState<'variantes' | 'sistemas'>('variantes')

  // Variantes del modelo (V1 y V2 si existen)
  const v1 = model.skus.find(s => s.variante === '1' || s.variante === '2')
  const v2 = model.skus.find(s => s.variante === '2' || s.variante === '3')

  const moveTo = useCallback((clientX: number) => {
    const stage = stageRef.current
    const overlay = overlayRef.current
    const handle = handleRef.current
    const line = lineRef.current
    if (!stage || !overlay || !handle || !line) return
    const rect = stage.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const pct = (x / rect.width) * 100
    overlay.style.clipPath = `inset(0 0 0 ${pct}%)`
    handle.style.left = `${pct}%`
    line.style.left = `${pct}%`
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (draggingRef.current) moveTo(e.clientX) }
    const onUp = () => { draggingRef.current = false }
    const onTouchMove = (e: TouchEvent) => { if (draggingRef.current && e.touches[0]) moveTo(e.touches[0].clientX) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onTouchMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [moveTo])

  const basePhoto = model.cover_url ?? ''
  // En producción, esto usaría fotos distintas por variante o por sistema
  const overlayPhoto = model.cover_url ?? ''

  const leftLabel = mode === 'variantes'
    ? `V${v1?.variante ?? '1'} · ${v1 ? Math.round(v1.area_m2 ?? 0) + ' m²' : '—'}`
    : 'Wood Plus'
  const rightLabel = mode === 'variantes'
    ? `V${v2?.variante ?? '2'} · ${v2 ? Math.round(v2.area_m2 ?? 0) + ' m²' : '—'}`
    : 'Steel Plus'

  return (
    <div className="cf-st-compare" ref={stageRef}>
      {/* Mode toggle */}
      <div className="cf-cmp-modes">
        <button
          className={`cf-cmp-mode ${mode === 'variantes' ? 'active' : ''}`}
          onClick={() => setMode('variantes')}
        >
          V1 vs V2
        </button>
        <button
          className={`cf-cmp-mode ${mode === 'sistemas' ? 'active' : ''}`}
          onClick={() => setMode('sistemas')}
        >
          Wood vs Steel
        </button>
      </div>

      {/* Base (V1 / Wood) */}
      <div
        className="cf-cmp-base"
        style={{ backgroundImage: `url('${basePhoto}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />

      {/* Overlay (V2 / Steel) — se revela con clip-path */}
      <div
        ref={overlayRef}
        className="cf-cmp-overlay"
        style={{
          backgroundImage: `url('${overlayPhoto}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          clipPath: 'inset(0 0 0 50%)',
        }}
      />

      {/* Línea separadora */}
      <div ref={lineRef} className="cf-cmp-line" style={{ left: '50%' }} />

      {/* Handle arrastrable */}
      <div
        ref={handleRef}
        className="cf-cmp-handle"
        style={{ left: '50%' }}
        onMouseDown={e => { draggingRef.current = true; e.preventDefault() }}
        onTouchStart={e => { draggingRef.current = true; e.preventDefault() }}
      >
        ⟷
      </div>

      {/* Labels */}
      <div className="cf-cmp-tags">
        <span className="cf-cmp-tag">{leftLabel}</span>
        <span className="cf-cmp-tag">{rightLabel}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Estación: Datos
// ─────────────────────────────────────────────────────────────────────────────

export function StationDatos({ model }: { model: CatalogModel }) {
  const [selectedVariante, setSelectedVariante] = useState(0)
  const [selectedSystem, setSelectedSystem] = useState(0)

  // Variantes únicas (sin repetir sistema)
  const uniqueVariantes = model.skus.reduce((acc, s) => {
    if (!acc.find(v => v.variante === s.variante)) acc.push(s)
    return acc
  }, [] as typeof model.skus)

  const currentSku = model.skus.find(
    s => s.variante === uniqueVariantes[selectedVariante]?.variante
      && s.sistema_constructivo === model.systems[selectedSystem]
  ) ?? model.skus[0]

  return (
    <div className="cf-st-datos">
      {/* Selector variante */}
      <p className="cf-st-section-label">Elegí tu variante</p>
      <div className="cf-variant-grid">
        {uniqueVariantes.map((v, i) => (
          <button
            key={v.variante}
            className={`cf-variant-card ${i === selectedVariante ? 'selected' : ''}`}
            onClick={() => setSelectedVariante(i)}
          >
            <p className="cf-variant-name">V{v.variante}</p>
            <p className="cf-variant-meta">
              {v.area_m2 ? Math.round(v.area_m2) + ' m²' : '—'}
              {v.bedrooms_label ? ` · ${v.bedrooms_label} dorm.` : ''}
              {v.floors ? ` · ${v.floors} planta${v.floors > 1 ? 's' : ''}` : ''}
            </p>
          </button>
        ))}
      </div>

      {/* Selector sistema */}
      <p className="cf-st-section-label" style={{ marginTop: 28 }}>Sistema constructivo</p>
      <div className="cf-system-pills">
        {model.systems.map((s, i) => (
          <button
            key={s}
            className={`cf-system-pill ${i === selectedSystem ? 'selected' : ''}`}
            onClick={() => setSelectedSystem(i)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* CTA cotización */}
      <button className="cf-wa-cta">
        Pedir Cotización →
      </button>
    </div>
  )
}
