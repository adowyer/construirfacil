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
import HeroRow, { type GrowthPair } from './HeroRow'
import StickyFilters from './StickyFilters'
import ModelRow from './ModelRow'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import type { LineaRow } from '@/lib/supabase/queries/lineas'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import type {
  CatalogImage,
  CatalogAttributeRow,
} from '@/lib/supabase/queries/catalog_panels'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  models: CatalogModel[]
  brandContent?: BrandContent[]
  lineContent?: LineContent[]
  lineas?: LineaRow[]
  /** Map indexado por `${linea}::${style_name}` → fila de model_content. */
  modelContentMap?: Record<string, ModelContentRow>
  /** Todas las imágenes del catálogo. ModelRow filtra las que aplican al modelo. */
  catalogImages?: CatalogImage[]
  /** Todos los pairs (catalog × attribute_value). ModelRow filtra por house_catalog_id de sus SKUs. */
  catalogAttributes?: CatalogAttributeRow[]
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

function fmtUSD(n: number | null) {
  if (!n) return '—'
  return 'USD ' + Math.round(n).toLocaleString('es-AR')
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function CatalogPage({
  models = [],
  brandContent = [],
  lineContent = [],
  lineas = [],
  modelContentMap = {},
  catalogImages = [],
  catalogAttributes = [],
}: PageProps) {
  const [activeModel, setActiveModel] = useState<CatalogModel | null>(null)
  const [station, setStation] = useState<Station>('portada')
  const [lineFilter, setLineFilter] = useState<string>('ALL')
  const [bedFilter, setBedFilter] = useState<string>('ALL')
  const [sizeFilter, setSizeFilter] = useState<string>('ALL')
  const [sortOrder, setSortOrder] = useState<string>('recommended')

  const detailRef = useRef<HTMLDivElement>(null)
  const detailTrackRef = useRef<HTMLDivElement>(null)

  // ── Filter models ──
  const filtered = models.filter(m => {
    if (lineFilter !== 'ALL' && m.linea !== lineFilter) return false
    if (bedFilter !== 'ALL') {
      if (bedFilter === '1-2' && (m.beds_min ?? 0) > 2) return false
      if (bedFilter === '3' && !((m.beds_min ?? 0) <= 3 && (m.beds_max ?? 0) >= 3)) return false
      if (bedFilter === '4+' && (m.beds_max ?? 0) < 4) return false
    }
    if (sizeFilter !== 'ALL') {
      if (sizeFilter === 'S' && (m.area_min ?? 0) > 80) return false
      if (sizeFilter === 'M' && ((m.area_max ?? 0) < 80 || (m.area_min ?? 0) > 160)) return false
      if (sizeFilter === 'L' && (m.area_max ?? 0) < 160) return false
    }
    return true
  }).sort((a, b) => {
    if (sortOrder === 'price-asc') return (a.price_from ?? 0) - (b.price_from ?? 0)
    if (sortOrder === 'price-desc') return (b.price_from ?? 0) - (a.price_from ?? 0)
    return 0
  })

  // ── Group by line ──
  const grouped = LINE_ORDER.reduce((acc, line) => {
    const items = filtered.filter(m => m.linea === line)
    if (items.length) acc[line] = items
    return acc
  }, {} as Record<string, CatalogModel[]>)

  // ── Map name → icon_url para resolver el ícono de cada modelo en el catálogo ──
  // El nombre de la línea en `lineas.name` está en MAYÚSCULAS (normalizado por
  // el action) y coincide con `house_catalog.linea` (poblada por el trigger).
  const iconByLineaName: Record<string, string | null> = lineas.reduce(
    (acc, l) => {
      acc[l.name] = l.icon_url
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

  // ── Pares 1 planta / 2 plantas para la animación "La Casa que Crece" ──
  // En Bosque cada modelo tiene una sola fila con floors_options "1 ó 2",
  // y las dos versiones viven como skus distintos (cada uno con su `floors`
  // y `variante`). Buscamos la foto exterior que matchee la variante de
  // cada sku para armar el par.
  const growthPairs: GrowthPair[] = (() => {
    const bosque = models.filter((m) => m.linea === 'BOSQUE')
    const pairs: GrowthPair[] = []

    const findExteriorForVariante = (
      modelLinea: string,
      modelStyle: string,
      variante: string,
    ): string | undefined => {
      // Match más específico → menos específico (mismo patrón que ModelRow).
      const candidates = catalogImages.filter(
        (img) =>
          img.linea === modelLinea &&
          img.is_exterior === true &&
          img.image_type !== 'plano' &&
          img.style_name === modelStyle &&
          (img.variante === variante || img.variante == null),
      )
      // Priorizar la que tenga variante exacta.
      const exact = candidates.find((img) => img.variante === variante)
      return (exact ?? candidates[0])?.storage_url
    }

    for (const model of bosque) {
      const sku1 = model.skus.find((s) => s.floors === 1)
      const sku2 = model.skus.find((s) => s.floors === 2)
      if (!sku1 || !sku2) continue

      const imgOfSku1 = findExteriorForVariante(model.linea, model.style_name, sku1.variante)
      const imgOfSku2 = findExteriorForVariante(model.linea, model.style_name, sku2.variante)

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
      />

      {/* ── Filtros sticky en color CF ── */}
      <StickyFilters
        lineFilter={lineFilter}
        bedFilter={bedFilter}
        sizeFilter={sizeFilter}
        sortOrder={sortOrder}
        resultCount={filtered.length}
        onLineChange={setLineFilter}
        onBedChange={setBedFilter}
        onSizeChange={setSizeFilter}
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

              // Imágenes que aplican a este modelo (todos los SKUs)
              const skuIds = new Set(model.skus.map((s) => s.id))
              const modelImages = catalogImages.filter(
                (img) =>
                  img.linea === model.linea &&
                  img.tipologia_code === model.tipologia_code &&
                  // El style match: específico del modelo o tipológico (style null)
                  (img.style_name === model.style_name || img.style_name == null),
              )

              // Attributes filtrados por house_catalog_id ∈ skus del modelo
              const modelAttributes = catalogAttributes.filter((a) =>
                skuIds.has(a.house_catalog_id),
              )

              // Otros modelos en la misma (linea, tipologia_code) — para panel 5
              const otherStyles = filtered.filter(
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
                  brandContent={brandContent}
                  lineContent={lineContent}
                  attributesForCatalogIds={modelAttributes}
                  otherStyles={otherStyles}
                  modelContentMap={modelContentMap}
                  lineaIconUrl={iconByLineaName[model.linea] ?? null}
                />
              )
            })}

            {/* CTA entre Atlas y Bosque */}
            {gi === 0 && (
              <div className="cf-mid-cta">
                <h3>¿Te ayudo a elegir?</h3>
                <p>Conversá con nuestro asistente y encontrá la casa que mejor se adapta a vos.</p>
                <button className="cf-mid-cta-btn">Hablar con asesor</button>
              </div>
            )}
          </div>
        ))}
      </div>

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
        <p className="cf-st-portada-eyebrow">{model.linea} · {model.estilo}</p>
        <h1 className="cf-st-portada-name">{model.display_name}</h1>
        <p className="cf-st-portada-meta">
          Desde {fmtUSD(model.price_from)} · {model.area_min && model.area_max ? `${Math.round(model.area_min)}–${Math.round(model.area_max)} m²` : '—'} · {model.variantes_count} variantes
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

      {/* Precios */}
      {currentSku && (
        <>
          <p className="cf-st-section-label" style={{ marginTop: 28 }}>Precio estimado</p>
          <div className="cf-price-block">
            <div className="cf-price-row">
              <span>Lista</span>
              <span>{fmtUSD(currentSku.precio_lista_usd)}</span>
            </div>
            <div className="cf-price-row">
              <span>Contado</span>
              <span>{fmtUSD(currentSku.precio_contado_usd)}</span>
            </div>
            <div className="cf-price-row cf-price-featured">
              <span>Al pozo</span>
              <span>{fmtUSD(currentSku.precio_pozo_usd)}</span>
            </div>
          </div>
        </>
      )}

      {/* CTA WhatsApp */}
      <button className="cf-wa-cta">
        Consultar por WhatsApp →
      </button>
    </div>
  )
}
