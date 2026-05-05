'use client'

/**
 * components/catalog/ModelRow.tsx
 *
 * Una casa por fila: 25% ficha / 75% foto
 * - Filas alternas: texto-izquierda / texto-derecha (flipped)
 * - Aire entre filas (margin-bottom)
 * - Hover: foto zoom suave + oscurecimiento + nombre flotante de abajo
 * - Click en foto o en "Ver detalle →" abre el detail slider
 */

import { useState, useRef, useEffect } from 'react'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import type {
  CatalogImage,
  CatalogAttributeRow,
} from '@/lib/supabase/queries/catalog_panels'
import ExpandedPanels from './ExpandedPanels'

interface BrandContentLite {
  key: string
  title: string | null
  body: string | null
}
interface LineContentLite {
  linea: string
  tipologia_code: string | null
  title: string | null
  subtitle: string | null
  body: string | null
}

interface ModelRowProps {
  model: CatalogModel
  index: number
  onOpen: (model: CatalogModel) => void
  // Datos para los paneles del expandido (opcional para compat retro)
  modelContent?: ModelContentRow | null
  images?: CatalogImage[]
  brandContent?: BrandContentLite[]
  lineContent?: LineContentLite[]
  attributesForCatalogIds?: CatalogAttributeRow[]
  otherStyles?: CatalogModel[]
  /** Map global de model_content; usado en el panel comparativa de estilos
      para mostrar el texto de OTROS modelos en la misma tipología. */
  modelContentMap?: Record<string, ModelContentRow>
  /** URL del ícono de la línea (mostrado arriba de la ficha colapsada). */
  lineaIconUrl?: string | null
}

const ZOOM_VIEWPORT_CENTER = 0.56
const ZOOM_CLOSE_DISTANCE = 0.8
const ZOOM_FOLLOW_CLOSE = 0.34
const ZOOM_FOLLOW_OPEN = 0.1

function fmtUSD(n: number | null) {
  if (!n) return '—'
  return 'USD ' + Math.round(n).toLocaleString('es-AR')
}

function fmtRange(a: number | null, b: number | null) {
  if (!a) return '—'
  if (!b || a === b) return String(Math.round(a))
  return `${Math.round(a)}–${Math.round(b)}`
}

export default function ModelRow({
  model,
  index,
  onOpen,
  modelContent = null,
  images = [],
  brandContent = [],
  lineContent = [],
  attributesForCatalogIds = [],
  otherStyles = [],
  modelContentMap,
  lineaIconUrl = null,
}: ModelRowProps) {
  const [hovered, setHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  // Precarga de imágenes al expandir: evita el flash blanco al cambiar de pill.
  // Los PDFs (planos) no se precargan — solo se renderizan como link.
  useEffect(() => {
    if (!isExpanded || images.length === 0) return
    for (const img of images) {
      if (!/\.(png|jpe?g|webp)$/i.test(img.storage_url)) continue
      const preloader = new window.Image()
      preloader.src = img.storage_url
    }
  }, [isExpanded, images])

  // --- BIG-like focus physics: cierre por scroll ---
  // El RAF anima --expand-progress según la distancia al centro del viewport,
  // y dispara el cierre cuando la fila salió casi por completo del viewport.
  useEffect(() => {
    if (!isExpanded) {
      if (shellRef.current) shellRef.current.scrollLeft = 0
      if (rowRef.current) rowRef.current.style.removeProperty('--expand-progress')
      return
    }

    let rafId: number
    let isLooping = true
    const targetProgress = { current: 1.0 }
    const currentProgress = { current: 1.0 }
    let outOfViewSince: number | null = null

    const loop = () => {
      if (!isLooping) return

      const rowEl = rowRef.current
      if (!rowEl) return
      const rect = rowEl.getBoundingClientRect()
      const vh = window.innerHeight || 1
      const viewportCenter = vh * ZOOM_VIEWPORT_CENTER
      const rowCenter = rect.top + rect.height / 2
      const distToCenter = Math.abs(rowCenter - viewportCenter)
      const maxDist = vh * ZOOM_CLOSE_DISTANCE
      const ratio = Math.max(0, Math.min(1, distToCenter / maxDist))
      const normalized = 1 - ratio
      targetProgress.current = normalized

      const fullyOutOfView = rect.bottom < -vh * 0.02 || rect.top > vh * 1.02
      if (fullyOutOfView) {
        if (outOfViewSince === null) outOfViewSince = performance.now()
      } else {
        outOfViewSince = null
      }

      if (outOfViewSince !== null && performance.now() - outOfViewSince > 120) {
        setIsExpanded(false)
        isLooping = false
        return
      }

      const follow = targetProgress.current < currentProgress.current ? ZOOM_FOLLOW_CLOSE : ZOOM_FOLLOW_OPEN
      currentProgress.current += (targetProgress.current - currentProgress.current) * follow

      if (rowRef.current) {
        rowRef.current.style.setProperty('--expand-progress', Math.max(0, Math.min(1, currentProgress.current)).toFixed(4))
      }

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)

    return () => {
      isLooping = false
      cancelAnimationFrame(rafId)
    }
  }, [isExpanded])

  // Keep horizontal wheel scoped to the expanded shell only.
  useEffect(() => {
    const shell = shellRef.current
    if (!shell || !isExpanded) return

    const onWheel = (e: WheelEvent) => {
      const horizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey
      if (!horizontalIntent) return
      e.preventDefault()
      shell.scrollLeft += e.shiftKey ? e.deltaY : e.deltaX
    }

    shell.addEventListener('wheel', onWheel, { passive: false })
    return () => shell.removeEventListener('wheel', onWheel)
  }, [isExpanded])

  // --- 2. Click and Drag to Pan Horizontal (like BIG.dk) ---
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [startD, setStartD] = useState(0)

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isExpanded || !shellRef.current) return
    setIsDragging(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    setStartX(clientX)
    setStartD(shellRef.current.scrollLeft)
  }
  const onDragEnd = () => setIsDragging(false)
  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !isExpanded || !shellRef.current) return
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const walk = (clientX - startX) * 1.5
    shellRef.current.scrollLeft = startD - walk
  }

  // Al abrir: posicionar el TOP de la fila a ~7% del viewport (no centrar).
  // Centrar geométricamente dejaba el bottom cortado porque el row
  // expandido es ~85vh — más alto que medio viewport.
  useEffect(() => {
    if (isExpanded && rowRef.current) {
      setTimeout(() => {
        const rowEl = rowRef.current
        if (!rowEl) return
        const rowRect = rowEl.getBoundingClientRect()
        const targetY = rowRect.top + window.scrollY - window.innerHeight * 0.07
        window.scrollTo({ top: targetY, behavior: 'smooth' })
      }, 150)

      // Keep first slide visible after expansion (do not jump to middle).
      requestAnimationFrame(() => {
        const shell = shellRef.current
        if (!shell) return
        shell.scrollLeft = 0
      })
    } else if (!isExpanded && shellRef.current) {
      shellRef.current.scrollLeft = 0
    }
  }, [isExpanded])


  return (
    <div
      ref={shellRef}
      className={`cf-row-shell ${isExpanded ? 'cf-expanded' : ''} ${isDragging ? 'cf-dragging' : ''}`}
      onMouseDown={onDragStart}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
      onMouseMove={onDragMove}
      onTouchStart={onDragStart}
      onTouchEnd={onDragEnd}
      onTouchMove={onDragMove}
    >
      <div
        ref={rowRef}
        className={`cf-row ${isExpanded ? 'cf-expanded' : ''}`}
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
      {/* ── COL 1: Info (Left) ── */}
      <div className="cf-row-info" onClick={e => isExpanded && e.stopPropagation()}>
        {!isExpanded ? (
          /* Collapsed: ícono + línea + NOMBRE + dormitorios */
          <div className="cf-meta-collapsed">
            {lineaIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lineaIconUrl}
                alt=""
                aria-hidden="true"
                className="cf-row-icon"
              />
            )}
            <p className="cf-row-tag">{model.linea}</p>
            <h3 className="cf-row-name cf-row-name-collapsed">{model.display_name}</h3>
            <p className="cf-row-bedrooms">
              {fmtRange(model.beds_min, model.beds_max)} dormitorio
              {model.beds_max && model.beds_max > 1 ? 's' : ''}
            </p>
          </div>
        ) : (
          /* Expanded: detailed info panel (like cf-info-col in OLD) */
          <div className="cf-info-expanded" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', textAlign: 'right', width: '100%', animation: 'cfSlideFade 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            {lineaIconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lineaIconUrl}
                alt=""
                aria-hidden="true"
                className="cf-row-icon"
                style={{ marginBottom: 12 }}
              />
            )}
            <p className="cf-row-tag" style={{ marginBottom: 12 }}>{model.linea}</p>
            <h3 className="cf-row-name" style={{ fontSize: 22, marginBottom: 28, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{model.display_name}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 32, width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Superficie</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>{fmtRange(model.area_min, model.area_max)} m²</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Dormitorios</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>{fmtRange(model.beds_min, model.beds_max)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Sistema</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>{model.systems.join(' / ')}</span>
              </div>
            </div>

            <div style={{ width: '100%', marginBottom: 22, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Precio llave en mano</span>
              <span style={{ fontSize: 18, fontWeight: 500, color: '#0a0a0a' }}>{fmtUSD(model.price_from)}</span>
            </div>

            <a
              href={`/models/${model.group_slug}`}
              className="cf-row-cta"
              onClick={e => e.stopPropagation()}
              style={{ alignSelf: 'flex-end' }}
            >
              Ver más →
            </a>
          </div>
        )}
      </div>

      {/* ── COL 2: Gallery (Center Horizontal) ── */}
      <div
        className="cf-row-photo"
        ref={galleryRef}
        onMouseEnter={() => !isExpanded && setHovered(true)}
        onMouseLeave={() => !isExpanded && setHovered(false)}
      >
        <div className="cf-row-track">
          {/* Cover image + overlay hover viven adentro de un wrapper común
              para que el overlay tenga exactamente el tamaño de la foto. */}
          {model.cover_url && (
            <div className="cf-row-img-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={model.cover_url}
                alt={model.display_name}
                loading={index < 3 ? 'eager' : 'lazy'}
                className="cf-row-img"
              />

              {/* Overlay hover (solo cuando NO está expandido) */}
              {!isExpanded && (
                <div className="cf-row-overlay" style={{ opacity: hovered ? 1 : 0 }}>
                  <div className="cf-row-overlay-content">
                    <p className="cf-row-overlay-name">{model.display_name}</p>
                    <p className="cf-row-overlay-sub">{fmtRange(model.area_min, model.area_max)} m² · desde {fmtUSD(model.price_from)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 12 paneles del expandido (data real desde Supabase) */}
          {isExpanded && (
            <ExpandedPanels
              model={model}
              modelContent={modelContent}
              images={images}
              brandContent={brandContent}
              lineContent={lineContent}
              attributesForCatalogIds={attributesForCatalogIds}
              otherStyles={otherStyles}
              modelContentMap={modelContentMap}
            />
          )}
        </div>
      </div>

      {/* ── COL 3: Detail (Right, only visible when expanded) ── */}
      <div className="cf-row-detail" onClick={e => isExpanded && e.stopPropagation()}>
        {isExpanded && (
          <div style={{ animation: 'cfSlideFade 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: '#555', margin: 0 }}>
              {model.display_name} de la línea {model.linea}. Disponible en {model.variantes_count} variante{model.variantes_count !== 1 ? 's' : ''}, con superficies desde {fmtRange(model.area_min, model.area_max)} m² y sistema {model.systems.join(' / ')}.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
