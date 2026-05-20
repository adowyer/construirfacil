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
import { createPortal } from 'react-dom'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import { displayLinea } from '@/lib/supabase/queries/catalog_grouped'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import {
  type CatalogImage,
  type CatalogAttributeRow,
  pickFull,
} from '@/lib/supabase/queries/catalog_panels'
import ExpandedPanels from './ExpandedPanels'
import DeliveryConditionsModal from '@/components/catalog/DeliveryConditionsModal'
import { buildCotizarMailto } from '@/lib/cta/mailto'
import { track } from '@/lib/track/client'
import type { CotizadorData } from '@/lib/content/cotizador-data'

interface BrandContentLite {
  key: string
  title: string | null
  subtitle?: string | null
  body: string | null
}
interface LineContentLite {
  linea: string
  tipologia_code: string | null
  title: string | null
  subtitle: string | null
  body: string | null
}
interface ScContentLite {
  marca_id: string | null
  slug: string
  name: string
  tagline: string | null
  body: string | null
  hero_image_url: string | null
  sort_order: number
}

interface ModelRowProps {
  model: CatalogModel
  index: number
  onOpen: (model: CatalogModel) => void
  // Datos para los paneles del expandido (opcional para compat retro)
  modelContent?: ModelContentRow | null
  images?: CatalogImage[]
  /** SKUs del modelo que matchean los filtros activos (bed/size). El panel
   *  de variantes los usa en lugar de model.skus para no mostrar variantes
   *  que el usuario filtró fuera. Si no hay filtros activos, viene = model.skus. */
  activeSkus?: CatalogModel['skus']
  /** URL de la foto del listado. Si hay filtros activos, refleja la
   *  variante filtrada; si no, es model.cover_url default. */
  coverUrl?: string | null
  brandContent?: BrandContentLite[]
  lineContent?: LineContentLite[]
  scContent?: ScContentLite[]
  attributesForCatalogIds?: CatalogAttributeRow[]
  otherStyles?: CatalogModel[]
  /** Map global de model_content; usado en el panel comparativa de estilos
      para mostrar el texto de OTROS modelos en la misma tipología. */
  modelContentMap?: Record<string, ModelContentRow>
  /** Catálogo completo — pasado al panel "También podría interesarte"
   *  para sugerir modelos relacionados. */
  allModels?: CatalogModel[]
  /** URL del ícono de la línea (mostrado arriba de la ficha colapsada). */
  lineaIconUrl?: string | null
  /** "Condiciones de Entrega" (HTML saneado) → pill en el panel Exteriores. */
  deliveryConditionsHtml?: string | null
  /** Cotizador Uber resuelto (tramos + cuota + slot base). Lo consume el
   *  panel Comparativo (cuota por variante + selector). null → "Cotizar". */
  cotizador?: CotizadorData | null
}

const ZOOM_VIEWPORT_CENTER = 0.56
const ZOOM_CLOSE_DISTANCE = 0.8
const ZOOM_FOLLOW_CLOSE = 0.34
const ZOOM_FOLLOW_OPEN = 0.1

function fmtRange(a: number | null, b: number | null) {
  if (!a) return '—'
  if (!b || a === b) return String(Math.round(a))
  return `${Math.round(a)}–${Math.round(b)}`
}

// Set ordenado de cantidades de dormitorios entre los SKUs activos.
// Si un SKU tiene min_bedrooms=2/max_bedrooms=3, expande [2, 3].
function bedroomsFromSkus(skus: CatalogModel['skus']): number[] {
  const set = new Set<number>()
  for (const sku of skus) {
    const min = sku.min_bedrooms
    const max = sku.max_bedrooms ?? min
    if (min == null) continue
    for (let n = min; n <= (max ?? min); n++) set.add(n)
  }
  return [...set].sort((a, b) => a - b)
}

// "Variantes con 1, 2, 3 o 4 dormitorios" — el copy completo, listo para
// uso standalone (sin label "Dormitorios:" arriba).
function fmtBedroomsLabeled(skus: CatalogModel['skus']): string {
  const beds = bedroomsFromSkus(skus)
  if (beds.length === 0) return '—'
  if (beds.length === 1) return `${beds[0]} dormitorio${beds[0] > 1 ? 's' : ''}`
  const last = beds[beds.length - 1]
  const rest = beds.slice(0, -1).join(', ')
  return `Variantes con ${rest} o ${last} dormitorios`
}

// "1, 2, 3 o 4" — solo la lista, para usar debajo de un label "Dormitorios".
function fmtBedroomsList(skus: CatalogModel['skus']): string {
  const beds = bedroomsFromSkus(skus)
  if (beds.length === 0) return '—'
  if (beds.length === 1) return String(beds[0])
  const last = beds[beds.length - 1]
  const rest = beds.slice(0, -1).join(', ')
  return `${rest} o ${last}`
}

// Set de superficies discretas (cada SKU es un valor, no un rango).
function areasFromSkus(skus: CatalogModel['skus']): number[] {
  const set = new Set<number>()
  for (const sku of skus) {
    const a = sku.area_m2 ?? 0
    if (a > 0) set.add(Math.round(a))
  }
  return [...set].sort((a, b) => a - b)
}

// "40, 58 y 80 m²" debajo de un label "Superficie".
function fmtAreasList(skus: CatalogModel['skus']): string {
  const areas = areasFromSkus(skus)
  if (areas.length === 0) return '—'
  if (areas.length === 1) return `${areas[0]} m²`
  const last = areas[areas.length - 1]
  const rest = areas.slice(0, -1).join(', ')
  return `${rest} y ${last} m²`
}

// Precio mostrado en la ficha: si la marca no publica precios (Hausind),
// muestra "Cotizar". Si publica y hay min, muestra "desde USD X".
function fmtPrecioFicha(model: CatalogModel): string {
  if (!model.show_prices) return 'Cotizar'
  if (model.price_from && model.price_from > 0) {
    return `desde USD ${Math.round(model.price_from).toLocaleString('es-AR')}`
  }
  return 'Cotizar'
}

// Render del valor de precio en la ficha: cuando es "Cotizar", es un mailto
// clickeable; cuando es un precio real ("desde USD …"), span plano.
function PrecioOrCotizar({
  model,
  className,
  style,
}: {
  model: CatalogModel
  className?: string
  style?: React.CSSProperties
}) {
  const value = fmtPrecioFicha(model)
  if (value === 'Cotizar') {
    return (
      <a
        href={buildCotizarMailto({
          modelName: model.display_name,
          linea: displayLinea(model.linea),
        })}
        className={className}
        style={style}
        onClick={(e) => {
          e.stopPropagation()
          track('cotizar_open', { model: model.display_name })
        }}
      >
        Cotizar
      </a>
    )
  }
  return (
    <span className={className} style={style}>
      {value}
    </span>
  )
}

// Normaliza el nombre del SC para el rebrand vigente (Hormigón/Concrete → Stone).
function displaySCName(sc: string): string {
  const u = sc.toUpperCase().trim()
  if (u === 'HORMIGÓN PLUS' || u === 'HORMIGON PLUS' || u === 'CONCRETE PLUS')
    return 'Stone Plus'
  return sc.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

// Cada línea tiene su SC principal; las demás son alternativas.
const LINEA_TO_PRIMARY_SC: Record<string, string> = {
  BOSQUE: 'Wood Plus',
  ATLAS: 'Steel Plus',
  TERRA: 'Stone Plus',
}

function orderSystemsByLinea(
  systems: string[],
  linea: string | null | undefined,
): { primary: string | null; secondary: string[] } {
  const primary = LINEA_TO_PRIMARY_SC[(linea ?? '').toUpperCase()] ?? null
  const normalized = systems.map(displaySCName)
  if (!primary) return { primary: null, secondary: normalized }
  const primaryFound = normalized.find((s) => s === primary) ?? null
  const others = normalized.filter((s) => s !== primary)
  return { primary: primaryFound, secondary: others }
}

export default function ModelRow({
  model,
  index,
  onOpen,
  modelContent = null,
  images = [],
  activeSkus,
  coverUrl,
  brandContent = [],
  lineContent = [],
  scContent = [],
  attributesForCatalogIds = [],
  otherStyles = [],
  modelContentMap,
  allModels = [],
  lineaIconUrl = null,
  deliveryConditionsHtml = null,
  cotizador = null,
}: ModelRowProps) {
  // Foto a mostrar en la card del listado: prop dinámica si llegó, sino
  // fallback al cover default del modelo.
  const displayCoverUrl = coverUrl ?? model.cover_url
  const [hovered, setHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  // Hint de scroll horizontal al abrir el expandido (nudge + chevron). Se
  // descarta al primer gesto real del usuario o por timeout.
  const [scrollHint, setScrollHint] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  // Sticky CTA: mount/unmount con fade in/out manejado por dos states
  // (mounted + visible) y CSS transitions. Cuando isExpanded baja a false,
  // primero apagamos `visible` (dispara fade-out), luego unmounteamos
  // tras el delay de la transition.
  //
  // Además: el RAF de focus physics (más abajo) toggleea la clase
  // `.cf-sticky-cta-visible` directamente vía stickyRef cuando el progress
  // baja, así el sticky empieza a desvanecerse APENAS el row se aleja del
  // centro del viewport — sin esperar a que isExpanded baje a false.
  const [stickyMounted, setStickyMounted] = useState(false)
  const [stickyVisible, setStickyVisible] = useState(false)
  const stickyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isExpanded) {
      setStickyMounted(true)
      const f1 = requestAnimationFrame(() =>
        requestAnimationFrame(() => setStickyVisible(true)),
      )
      return () => cancelAnimationFrame(f1)
    }
    setStickyVisible(false)
    const t = window.setTimeout(() => setStickyMounted(false), 220)
    return () => window.clearTimeout(t)
  }, [isExpanded])

  // Orientation lock: al abrir el panel expandido en mobile intentamos
  // forzar landscape via Screen Orientation API.
  // - Funciona: Chrome Android, PWAs instaladas en cualquier plataforma.
  // - Falla silenciosamente: Safari iOS (restricción de Apple en browser),
  //   desktop (orientación no aplica). En esos casos el nudge "rotá el
  //   teléfono" (CSS portrait) actúa como fallback.
  // Al cerrar (isExpanded → false) liberamos el lock para devolver el
  // control de orientación al usuario.
  useEffect(() => {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>
    }
    if (!orientation?.lock) return

    if (isExpanded) {
      orientation.lock('landscape').catch(() => {
        // Safari iOS / desktop: falla silenciosamente — no hacemos nada.
      })
    } else {
      try { orientation.unlock() } catch { /* idem */ }
    }
  }, [isExpanded])

  // Fix de rotación: al girar el dispositivo con el panel expandido, la
  // `transition: height 2.5s` animaría la altura de 70svh → 90svh lentamente
  // y el RAF loop tiene medidas de viewport viejas durante esa transición.
  // Solución: agregar temporalmente `.cf-no-transition` al row para que el
  // reajuste de layout sea instantáneo, luego re-habilitamos las transitions.
  // El panel PERMANECE abierto — cerrarlo sería mala UX (el usuario rotó
  // precisamente para ver mejor el contenido).
  useEffect(() => {
    if (!isExpanded) return

    let timer: ReturnType<typeof setTimeout>

    const snapLayoutOnRotation = () => {
      const row = rowRef.current
      if (!row) return
      // Desactivar transitions para que el reajuste de altura sea inmediato.
      row.classList.add('cf-no-transition')
      // Breve timeout para que el browser termine de calcular las nuevas
      // dimensiones del viewport antes de re-habilitar las transitions.
      timer = setTimeout(() => {
        row.classList.remove('cf-no-transition')
      }, 350)
    }

    window.addEventListener('orientationchange', snapLayoutOnRotation)
    window.addEventListener('resize', snapLayoutOnRotation)
    return () => {
      window.removeEventListener('orientationchange', snapLayoutOnRotation)
      window.removeEventListener('resize', snapLayoutOnRotation)
      clearTimeout(timer)
    }
  }, [isExpanded])

  // Precarga de imágenes al expandir: evita el flash blanco al cambiar de pill.
  // Usa la versión WebP optimizada (egress-friendly).
  useEffect(() => {
    if (!isExpanded || images.length === 0) return
    for (const img of images) {
      const url = pickFull(img)
      if (!/\.(png|jpe?g|webp)$/i.test(url)) continue
      const preloader = new window.Image()
      preloader.src = url
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

      // Sticky CTA: cuando el progress baja por debajo de 0.55, el row ya
      // se está alejando del centro → empezamos el fade-out del sticky
      // SIN esperar a que isExpanded baje a false (que solo ocurre cuando
      // el row casi salió del viewport, demasiado tarde).
      if (stickyRef.current) {
        const shouldBeVisible = currentProgress.current >= 0.55
        const hasClass = stickyRef.current.classList.contains('cf-sticky-cta-visible')
        if (shouldBeVisible && !hasClass) {
          stickyRef.current.classList.add('cf-sticky-cta-visible')
        } else if (!shouldBeVisible && hasClass) {
          stickyRef.current.classList.remove('cf-sticky-cta-visible')
        }
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

  const onDragStart = (e: React.MouseEvent) => {
    if (!isExpanded || !shellRef.current) return
    setIsDragging(true)
    setStartX(e.clientX)
    setStartD(shellRef.current.scrollLeft)
  }
  const onDragEnd = () => setIsDragging(false)
  const onDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !isExpanded || !shellRef.current) return
    const walk = (e.clientX - startX) * 1.5
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
      // Backup timeouts for robust alignment on mobile rendering lags
      setTimeout(() => {
        if (shellRef.current) shellRef.current.scrollLeft = 0
      }, 100)
      setTimeout(() => {
        if (shellRef.current) shellRef.current.scrollLeft = 0
      }, 300)
    } else if (!isExpanded && shellRef.current) {
      shellRef.current.scrollLeft = 0
    }
  }, [isExpanded])

  // Hint de scroll horizontal al abrir: usuarios reales no descubrían que el
  // slider corre a la derecha. B = nudge del track con tween rAF PROPIO
  // (no scrollTo nativo — en Safari es seco/"flick"); va ~130px suave y
  // vuelve. C = chevron pulsante. Se descarta al primer gesto real de
  // navegación (wheel / scroll del usuario una vez terminado el nudge) o a
  // los ~8s. El nudge NO se autodescarta (se ignora el scroll programático).
  useEffect(() => {
    if (!isExpanded) {
      setScrollHint(false)
      return
    }
    const shell = shellRef.current
    if (!shell) return

    let cancelled = false
    let rafId = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    const NUDGE_DIST = 180
    const OUT_MS = 720
    const BACK_MS = 900
    // easeInOutCubic
    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const tween = (from: number, to: number, dur: number, done?: () => void) => {
      const t0 = performance.now()
      const step = (now: number) => {
        if (cancelled || !shellRef.current) return
        const p = Math.min(1, (now - t0) / dur)
        shellRef.current.scrollLeft = from + (to - from) * ease(p)
        if (p < 1) rafId = requestAnimationFrame(step)
        else done?.()
      }
      rafId = requestAnimationFrame(step)
    }

    // dismiss: SOLO oculta el chevron. El nudge ya terminó cuando se
    // engancha, así que no toca el tween.
    const dismiss = () => setScrollHint(false)

    // Aparece ~450ms tras abrir (ya asentó el scroll de apertura de 150ms).
    timers.push(
      setTimeout(() => {
        if (cancelled) return
        setScrollHint(true)
        // Visible ~2s y se va (pedido del user). El nudge (~1.6s) corre
        // dentro de esa ventana — el movimiento del chevron acompaña.
        timers.push(setTimeout(() => setScrollHint(false), 2000))
        tween(0, NUDGE_DIST, OUT_MS, () =>
          tween(NUDGE_DIST, 0, BACK_MS, () => {
            const s = shellRef.current
            if (cancelled || !s) return
            s.scrollLeft = 0
            // Si el user navega antes de los 2s, también lo descarta.
            s.addEventListener('wheel', dismiss, { once: true, passive: true })
            s.addEventListener('scroll', dismiss, { once: true, passive: true })
          }),
        )
      }, 450),
    )

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      timers.forEach(clearTimeout)
      shell.removeEventListener('wheel', dismiss)
      shell.removeEventListener('scroll', dismiss)
    }
  }, [isExpanded])


  return (
    <div
      ref={shellRef}
      id={`row-${model.group_slug}`}
      className={`cf-row-shell ${isExpanded ? 'cf-expanded' : ''} ${isDragging ? 'cf-dragging' : ''}`}
      onMouseDown={onDragStart}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
      onMouseMove={onDragMove}
    >
      <div
        ref={rowRef}
        className={`cf-row ${isExpanded ? 'cf-expanded' : ''}`}
        onClick={() => {
          if (isExpanded) return
          setIsExpanded(true)
          track('model_open', { model: model.group_slug })
        }}
      >
      {/* ── COL 1: Info (Left) ── */}
      <div className="cf-row-info" onClick={e => isExpanded && e.stopPropagation()}>
        {!isExpanded ? (
          <>
            {/* Collapsed: ícono + línea + tipología + NOMBRE + dormitorios */}
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
              <p className="cf-row-tag">{displayLinea(model.linea)}</p>
              {model.tipologia_code && (
                <p className="cf-row-tipologia">Tipología {model.tipologia_code}</p>
              )}
              <h3 className="cf-row-name cf-row-name-collapsed">{model.display_name}</h3>
              <p className="cf-row-bedrooms">
                {fmtBedroomsLabeled(activeSkus ?? model.skus)}
              </p>
              <p className="cf-row-precio">
                <span className="cf-row-precio-lbl">Precio:</span>{' '}
                <PrecioOrCotizar model={model} className="cf-row-precio-val" />
              </p>
            </div>

            {/* Logo de marca — hermano directo de .cf-row-info (no hijo del
                .cf-meta-collapsed) para que margin-top: auto lo empuje al pie
                de la columna, que está estirada al alto del row (=alto foto). */}
            {model.marca_logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={model.marca_logo_url}
                alt={model.marca_name ?? ''}
                className="cf-row-marca-logo"
              />
            )}
          </>
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
            <p className="cf-row-tag" style={{ marginBottom: 12 }}>{displayLinea(model.linea)}</p>
            <h3 className="cf-row-name" style={{ fontSize: 22, marginBottom: 28, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{model.display_name}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 32, width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Tipología</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>{model.tipologia_code}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Superficie</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>{fmtAreasList(activeSkus ?? model.skus)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Dormitorios</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>{fmtBedroomsList(activeSkus ?? model.skus)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Sistema</span>
                {(() => {
                  const { primary, secondary } = orderSystemsByLinea(model.systems, model.linea)
                  return (
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}>
                      {primary && <strong style={{ fontWeight: 700 }}>{primary}</strong>}
                      {primary && secondary.length > 0 && (
                        <span style={{ color: '#888' }}> — </span>
                      )}
                      {secondary.length > 0 && (
                        <span style={{ color: '#888' }}>{secondary.join(' / ')}</span>
                      )}
                      {!primary && <span>{secondary.join(' / ')}</span>}
                    </span>
                  )
                })()}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}>Precio</span>
                <PrecioOrCotizar
                  model={model}
                  style={{ fontSize: 13, fontWeight: 500, color: '#0a0a0a' }}
                />
              </div>
            </div>
            {deliveryConditionsHtml && (
              <div
                className="cf-detalles-btn-stacked"
                style={{ marginTop: 'auto', paddingTop: 24 }}
              >
                <DeliveryConditionsModal html={deliveryConditionsHtml} variant="inline" />
              </div>
            )}
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
              para que el overlay tenga exactamente el tamaño de la foto.
              displayCoverUrl refleja los filtros activos del catálogo. */}
          {displayCoverUrl && (
            <div className="cf-row-img-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displayCoverUrl}
                alt={model.display_name}
                loading={index < 3 ? 'eager' : 'lazy'}
                className="cf-row-img"
              />

              {/* Overlay hover (solo cuando NO está expandido) */}
              {!isExpanded && (
                <div className="cf-row-overlay" style={{ opacity: hovered ? 1 : 0 }}>
                  <div className="cf-row-overlay-content">
                    <p className="cf-row-overlay-name">{model.display_name}</p>
                    <p className="cf-row-overlay-sub">{fmtAreasList(activeSkus ?? model.skus)}</p>
                  </div>
                </div>
              )}

              {/* Affordance SIEMPRE visible: avisa que la foto es clickeable.
                  Decorativo (pointer-events:none) — el click lo maneja la card.
                  Alineado al pie, lado opuesto al nombre del hover. */}
              {!isExpanded && (
                <span className="cf-row-seemore" aria-hidden="true">
                  Ver
                  <span className="cf-row-seemore-plus">
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                </span>
              )}
            </div>
          )}

          {/* 12 paneles del expandido (data real desde Supabase) */}
          {isExpanded && (
            <ExpandedPanels
              model={model}
              modelContent={modelContent}
              images={images}
              activeSkus={activeSkus ?? model.skus}
              brandContent={brandContent}
              lineContent={lineContent}
              scContent={scContent}
              attributesForCatalogIds={attributesForCatalogIds}
              otherStyles={otherStyles}
              modelContentMap={modelContentMap}
              allModels={allModels}
              deliveryConditionsHtml={deliveryConditionsHtml}
              cotizador={cotizador}
            />
          )}
        </div>
      </div>

      </div>

      {/* Sticky CTA → portal a document.body. Necesario porque cf-row-shell
          tiene transform durante el expandido, lo cual atrapa el position:
          fixed de los hijos. Además: fade-in/out controlado por
          .cf-sticky-cta-visible (transition CSS). */}
      {stickyMounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={stickyRef}
            className={`cf-row-sticky-cta${
              stickyVisible ? ' cf-sticky-cta-visible' : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cf-row-sticky-cta-info">
              <span className="cf-row-sticky-cta-eyebrow">
                Estás viendo la
              </span>
              <span className="cf-row-sticky-cta-name">
                {model.display_name}
              </span>
              <span className="cf-row-sticky-cta-linea">
                {model.marca_name ? `${model.marca_name} · ` : ''}
                {displayLinea(model.linea)}
              </span>
            </div>
            <a
              className="cf-row-sticky-cta-btn"
              aria-label="Cotizar"
              href={buildCotizarMailto({
                modelName: model.display_name,
                linea: displayLinea(model.linea),
              })}
            >
              <span className="cf-row-sticky-cta-btn-full">
                Cotizar
                <span aria-hidden>→</span>
              </span>
              <span className="cf-row-sticky-cta-btn-mini" aria-hidden>
                Ver →
              </span>
            </a>
          </div>,
          document.body,
        )}

      {/* C — chevron hint de scroll horizontal. Portal a body (mismo motivo
          que el sticky CTA: el transform del shell atrapa position:fixed).
          Decorativo (pointer-events:none). Montado mientras está expandido;
          la clase -visible controla fade-in/out + pulse. */}
      {isExpanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`cf-row-scrollhint${
              scrollHint ? ' cf-row-scrollhint-visible' : ''
            }`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" width="72" height="72" fill="none">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>,
          document.body,
        )}

      {/* D — nudge "Rotá el teléfono" en portrait mobile cuando está expandido.
          Vive en el DOM siempre que isExpanded=true; el CSS lo muestra SOLO
          en portrait (@media orientation:portrait) y lo oculta en landscape.
          pointer-events:none → no bloquea el cierre por scroll del usuario. */}
      {isExpanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="cf-rotate-nudge" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12a8 8 0 0 1 8-8" />
              <path d="M12 4l-2 2 2 2" />
              <rect x="5" y="11" width="14" height="10" rx="2" />
            </svg>
            Rotá el teléfono para mejor experiencia
          </div>,
          document.body,
        )}
    </div>
  )
}
