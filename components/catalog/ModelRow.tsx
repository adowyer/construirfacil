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
import type { EffectiveZoneRule } from '@/lib/content/zones'
import { splitModelTitle } from '@/lib/content/model-naming'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import {
  type CatalogImage,
  type CatalogAttributeRow,
  pickFull,
} from '@/lib/supabase/queries/catalog_panels'
import ExpandedPanels from './ExpandedPanels'
import DeliveryConditionsModal from '@/components/catalog/DeliveryConditionsModal'
import CotizarCenteredModal from '@/components/catalog/CotizarCenteredModal'
import { buildCotizarMailto } from '@/lib/cta/mailto'
import { track } from '@/lib/track/client'
import {
  skuPrices,
  type CotizadorData,
  type SkuPrices,
} from '@/lib/content/cotizador-data'

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
  /** Regla zonal efectiva resuelta para (marca, provincia). null = sin
   *  provincia elegida o sin reglas. Aplica modifier+extra_charge al precio
   *  mostrado y muestra badges (promo/contacto/exclusión). */
  zoneRule?: EffectiveZoneRule | null
  /** ID de provincia activa (si la hay) — se persiste con el lead para que
   *  ventas sepa de qué jurisdicción viene la consulta. */
  provinciaId?: string | null
  /** Contexto de lote del usuario para enriquecer el lead. 'si' (tiene lote
   *  propio) → financiar solo casa; 'no' (busca casa+lote) → matchear con
   *  lots_inventory; null (no eligió) → desconocido. */
  tieneLote?: 'si' | 'no' | null
  /** Número de WhatsApp de la marca dueña del modelo, sanitizado. Sobre-
   *  escribe el fallback global `NEXT_PUBLIC_WHATSAPP_NUMBER` en la pantalla
   *  post-success del LeadForm. NULL → usa el fallback. */
  marcaWhatsapp?: string | null
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

// "Variantes con 1, 2 o 3 dormitorios" — el copy completo, listo para
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

// Calcula el precio efectivo de un SKU aplicando oferta + regla zonal.
// Orden: oferta primero (descuento sobre el base), después la zona modifica +
// agrega transporte.
function effectiveSkuPrice(
  basePrice: number,
  sku: CatalogModel['skus'][number],
  zoneRule?: EffectiveZoneRule | null,
): number {
  const offerFactor =
    sku.is_offer && sku.offer_pct != null ? 1 - sku.offer_pct / 100 : 1
  const zoneFactor = 1 + (zoneRule?.price_modifier_pct ?? 0) / 100
  const extra = zoneRule?.extra_charge_amount ?? 0
  return basePrice * offerFactor * zoneFactor + extra
}

// Resuelve precio + oferta para mostrar en la ficha. Considera:
//   - Sin show_prices o sin precio → "Cotizar"
//   - Zona contact_only/excluded → "Cotizar"
//   - Si algún SKU tiene oferta vigente → muestra "desde USD <descontado>" +
//     el precio original tachado.
//   - Sin oferta → "desde USD <ajustado por zona>".
type FichaPrice =
  | { kind: 'cotizar'; offerBadge?: string }
  | { kind: 'normal'; text: string }
  | { kind: 'offer'; text: string; original: string; label: string }

function anyOfferLabel(model: CatalogModel): string | null {
  const skuWithOffer = model.skus.find((s) => s.is_offer)
  if (!skuWithOffer) return null
  return skuWithOffer.offer_label?.trim() || 'Oferta'
}

function resolveFichaPrice(
  model: CatalogModel,
  zoneRule?: EffectiveZoneRule | null,
): FichaPrice {
  if (zoneRule?.contact_only || zoneRule?.excluded) {
    return { kind: 'cotizar', offerBadge: anyOfferLabel(model) ?? undefined }
  }
  if (!model.show_prices) {
    // Marca esconde precios pero hay oferta activa → al menos mostramos el
    // badge para que la promo se vea; el precio descontado se ve al abrir
    // el cotizador.
    return { kind: 'cotizar', offerBadge: anyOfferLabel(model) ?? undefined }
  }
  const priced = model.skus.filter(
    (s) => s.precio_lista_usd != null && (s.precio_lista_usd as number) > 0,
  )
  if (priced.length === 0) {
    return { kind: 'cotizar', offerBadge: anyOfferLabel(model) ?? undefined }
  }

  // Min effective price across SKUs (puede o no incluir oferta).
  let bestSku = priced[0]
  let bestPrice = effectiveSkuPrice(bestSku.precio_lista_usd as number, bestSku, zoneRule)
  for (const s of priced.slice(1)) {
    const p = effectiveSkuPrice(s.precio_lista_usd as number, s, zoneRule)
    if (p < bestPrice) {
      bestSku = s
      bestPrice = p
    }
  }
  const fmt = (n: number) =>
    `desde USD ${Math.round(n).toLocaleString('es-AR')}`

  if (bestSku.is_offer && bestSku.offer_pct != null) {
    // Original = sin oferta pero con zona (para que el tachado tenga el mismo
    // peso del precio "real" que pagarías sin la promo).
    const noOfferFactor = 1 + (zoneRule?.price_modifier_pct ?? 0) / 100
    const extra = zoneRule?.extra_charge_amount ?? 0
    const original = (bestSku.precio_lista_usd as number) * noOfferFactor + extra
    return {
      kind: 'offer',
      text: fmt(bestPrice),
      original: fmt(original),
      label: bestSku.offer_label?.trim() || 'Oferta',
    }
  }
  return { kind: 'normal', text: fmt(bestPrice) }
}

// Render del valor de precio en la ficha: cuando es "Cotizar", abre la modal
// centrada de cotización (3 precios + disclaimer + link al comparativo). Si
// hay un precio real ("desde USD …"), span plano.
function PrecioOrCotizar({
  model,
  className,
  style,
  onCotizarClick,
  zoneRule,
}: {
  model: CatalogModel
  className?: string
  style?: React.CSSProperties
  /** Si está, "Cotizar" abre la modal centrada en lugar del mailto. */
  onCotizarClick?: () => void
  zoneRule?: EffectiveZoneRule | null
}) {
  const resolved = resolveFichaPrice(model, zoneRule)
  const offerBadge = resolved.kind === 'cotizar' ? resolved.offerBadge : null
  const renderBadge = () => offerBadge ? (
    <span style={{
      display: 'inline-block',
      fontSize: '0.78em',
      padding: '1px 6px',
      margin: '7px 0', 
      borderRadius: 4,
      background: '#ff003d',
      color: '#fff',
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase' as const,
      verticalAlign: 'middle',
    }}>
      {offerBadge}
    </span>
  ) : null
  if (resolved.kind === 'cotizar') {
    // Con cotizador → modal con los 3 precios + disclaimer.
    // Sin cotizador (marca sin Uber configurado) → fallback al mailto.
    if (onCotizarClick) {
      return (
        <span className={className} style={style}>
          {renderBadge()}
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#ff003d',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
            onClick={(e) => {
              e.stopPropagation()
              track('cotizar_open', {
                source: 'ficha_listado',
                model: model.display_name,
              })
              onCotizarClick()
            }}
          >
            Ver <strong style={{ fontWeight: 700 }}>precio</strong>
          </button>
        </span>
      )
    }
    return (
      <span className={className} style={style}>
        {renderBadge()}
        <a
          href={buildCotizarMailto({
            modelName: model.display_name,
            linea: displayLinea(model.linea),
          })}
          style={{
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#ff003d',
            textDecoration: 'none',
          }}
          onClick={(e) => {
            e.stopPropagation()
            track('cotizar_open', { source: 'ficha_listado_mailto', model: model.display_name })
          }}
        >
          Ver <strong style={{ fontWeight: 700 }}>precio</strong>
        </a>
      </span>
    )
  }
  if (resolved.kind === 'offer') {
    return (
      <span className={className} style={style}>
        <span style={{
          display: 'inline-block',
          fontSize: '0.78em',
          padding: '1px 6px',
          borderRadius: 4,
          background: '#ff003d',
          color: '#fff',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
          verticalAlign: 'middle',
        }}>
          {resolved.label}
        </span>
        <span style={{
          textDecoration: 'line-through',
          opacity: 0.45,
          marginRight: 6,
          fontWeight: 400,
        }}>
          {resolved.original}
        </span>
        <span style={{ fontWeight: 600 }}>{resolved.text}</span>
      </span>
    )
  }
  return (
    <span className={className} style={style}>
      {resolved.text}
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
  'LÍNEA BOSQUE': 'Wood Plus',
  'LÍNEA ATLAS': 'Steel Plus',
  'LÍNEA TERRA': 'Stone Plus',
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
  zoneRule = null,
  provinciaId = null,
  tieneLote = null,
  marcaWhatsapp = null,
}: ModelRowProps) {
  // Foto a mostrar en la card del listado: prop dinámica si llegó, sino
  // fallback al cover default del modelo.
  const displayCoverUrl = coverUrl ?? model.cover_url
  const [hovered, setHovered] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  // Chevrons de scroll horizontal del slider expandido. Aparecen/desaparecen
  // dinámicamente según si hay contenido fuera de viewport en cada dirección.
  // En desktop son clickeables (mueven el shell ~80% del viewport). En
  // mobile/touch son decorativos (el swipe gestual es el camino primario).
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  // Si el slider sale del viewport (user scrollea verticalmente con la fila
  // expandida), ocultamos los chevrons aunque haya scroll horizontal pendiente.
  // Sin esto los chevrons quedaban flotando solos cuando el shell ya no se veía.
  const [shellInView, setShellInView] = useState(true)
  const shellRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  // Modal centrada de cotización (afuera del comparativo): abre desde la
  // ficha del listado y desde el sticky CTA flotante. Adentro del
  // comparativo (Panel7) sigue la persiana actual.
  const [cotizarModalOpen, setCotizarModalOpen] = useState(false)
  // Cuando el usuario clickea "Ver cuadro comparativo" en la modal y la fila
  // todavía no está expandida, expandimos + dejamos un flag que dispara
  // (post-mount) el scroll al panel marcado con data-panel="comparativo".
  const [scrollToPanel, setScrollToPanel] = useState<string | null>(null)
  // Variante elegida en el cuadro comparativo. Mientras exista, el CTA
  // flotante "Cotizar" abre la modal con el precio + nombre de ESA variante
  // en vez del "desde" (precio más bajo). Se resetea al cerrar la fila.
  const [comparativoSel, setComparativoSel] = useState<{
    variante: string | null
    pricesUsd: SkuPrices
  } | null>(null)
  /** Precios de "referencia" para la modal del listado: los del SKU más
   *  barato (por precio de lista) → el cotizador arranca en el "desde". */
  const defaultPricesUsd: SkuPrices = (() => {
    if (!cotizador) return {}
    const skus = (activeSkus ?? model.skus).filter(
      (s) => typeof s.precio_lista_usd === 'number' && s.precio_lista_usd > 0,
    )
    if (skus.length === 0) return {}
    const cheapest = skus.reduce((a, b) =>
      (a.precio_lista_usd as number) <= (b.precio_lista_usd as number) ? a : b,
    )
    return skuPrices(cheapest)
  })()
  const hasCotizador = Boolean(cotizador && cotizador.tiers.length > 0)
  const openCotizar = () => setCotizarModalOpen(true)
  const scrollToPanelInTrack = (panelName: string) => {
    const track = galleryRef.current
    if (!track) return
    const slide = track.querySelector<HTMLElement>(
      `[data-panel="${panelName}"]`,
    )
    if (!slide) return
    slide.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
  const goToComparativo = () => {
    // Si ya está expandida, scroll directo. Sino expandimos + marcamos el
    // panel a scrollear; el useEffect de abajo lo hace cuando el track ya
    // está en el DOM y el slider terminó su layout.
    if (isExpanded) {
      scrollToPanelInTrack('comparativo')
    } else {
      setScrollToPanel('comparativo')
      setIsExpanded(true)
    }
  }
  // Una vez que el expand montó (next paint), si quedó un panel pendiente
  // de scrollear, lo hacemos. Limpiamos el flag para que no vuelva a disparar.
  useEffect(() => {
    if (!isExpanded || !scrollToPanel) return
    // Esperamos 2 frames: 1 para layout inicial, 2 para que el slider
    // termine su auto-positioning (definido en el rAF de focus physics).
    const t = window.setTimeout(() => {
      scrollToPanelInTrack(scrollToPanel)
      setScrollToPanel(null)
    }, 280)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, scrollToPanel])

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
      // La fila se cerró → el comparativo se desmonta y su selección se
      // pierde; limpiamos para que el próximo open arranque en "desde".
      setComparativoSel(null)
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

  // Chevrons + nudge inicial del slider expandido.
  //
  // El nudge tween llama la atención al abrir (mueve ~180px y vuelve). Los
  // chevrons aparecen dinámicamente según `canScrollLeft`/`canScrollRight`,
  // que se updatean con un listener de scroll: el chevron derecho aparece
  // cuando hay contenido fuera de viewport a la derecha; el izquierdo
  // cuando ya scrolleamos algo.
  //
  // Sin chevrons + sin nudge, usuarios reales en testing no descubrían que
  // se puede mover horizontal. El nudge aporta el "kick" inicial; los
  // chevrons quedan como guía permanente bidireccional.
  useEffect(() => {
    if (!isExpanded) {
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }
    const shell = shellRef.current
    if (!shell) return

    // Listener: actualiza qué chevrons están activos según posición + tamaño.
    const update = () => {
      const max = shell.scrollWidth - shell.clientWidth
      setCanScrollLeft(shell.scrollLeft > 2)
      setCanScrollRight(shell.scrollLeft < max - 2)
    }

    // Initial check tras layout estable (img heights ya resueltos).
    const initTimer = setTimeout(update, 400)
    shell.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)

    // IntersectionObserver para detectar si el slider está visible en el
    // viewport. Si baja del 35% visible, ocultamos los chevrons. Usar
    // thresholds múltiples para tener buena respuesta a movimientos suaves.
    let io: IntersectionObserver | null = null
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        ([entry]) => {
          setShellInView(entry.intersectionRatio > 0.35)
        },
        { threshold: [0, 0.35, 0.7, 1] },
      )
      io.observe(shell)
    }

    let cancelled = false
    let rafId = 0
    const timers: ReturnType<typeof setTimeout>[] = []

    const NUDGE_DIST = 180
    const OUT_MS = 720
    const BACK_MS = 900
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

    // Nudge inicial: ~450ms tras abrir, mueve a la derecha y vuelve.
    timers.push(
      setTimeout(() => {
        if (cancelled) return
        tween(0, NUDGE_DIST, OUT_MS, () =>
          tween(NUDGE_DIST, 0, BACK_MS, () => {
            if (cancelled || !shellRef.current) return
            shellRef.current.scrollLeft = 0
            update()
          }),
        )
      }, 450),
    )

    return () => {
      cancelled = true
      if (rafId) cancelAnimationFrame(rafId)
      timers.forEach(clearTimeout)
      clearTimeout(initTimer)
      shell.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      io?.disconnect()
    }
  }, [isExpanded])

  // Click handler para los chevrons: mueve el shell ~80% del viewport con
  // un tween rAF propio. El `scrollBy({behavior:'smooth'})` nativo es seco
  // en Safari (~250ms) y rompe con la suavidad del resto del catálogo.
  // Acá usamos easeInOutCubic + ~900ms — coherente con el nudge inicial y
  // las demás transitions cubic-bezier(0.16,1,0.3,1) del slider.
  const scrollTweenRef = useRef<{ cancelled: boolean } | null>(null)
  const scrollShellBy = (dir: 1 | -1) => {
    const shell = shellRef.current
    if (!shell) return

    // Cancelar cualquier tween en curso (doble click en chevron antes de
    // que termine el anterior → arrancar el nuevo desde donde está, no
    // pelearse con el rAF viejo).
    if (scrollTweenRef.current) scrollTweenRef.current.cancelled = true
    const token = { cancelled: false }
    scrollTweenRef.current = token

    const from = shell.scrollLeft
    const max = shell.scrollWidth - shell.clientWidth
    const to = Math.max(0, Math.min(max, from + shell.clientWidth * 0.8 * dir))
    if (Math.abs(to - from) < 1) return

    const duration = 900
    const ease = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const t0 = performance.now()
    const step = (now: number) => {
      if (token.cancelled || !shellRef.current) return
      const p = Math.min(1, (now - t0) / duration)
      shellRef.current.scrollLeft = from + (to - from) * ease(p)
      if (p < 1) requestAnimationFrame(step)
      else scrollTweenRef.current = null
    }
    requestAnimationFrame(step)
  }


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
              {(() => {
                const split = splitModelTitle({
                  style_name: model.style_name,
                  tipologia_code_new: model.tipologia_code_new,
                  strategy: model.naming_strategy,
                })
                return (
                  <h3 className="cf-row-name cf-row-name-collapsed">
                    {split.eyebrow && (
                      <span
                        className="cf-row-name-eyebrow"
                        style={{
                          display: 'block',
                          fontWeight: 500,
                          letterSpacing: 'normal',
                          lineHeight: 1.1,
                          marginBottom: 2,
                        }}
                      >
                        {split.eyebrow}
                      </span>
                    )}
                    <span
                      className="cf-row-name-hero"
                      style={{
                        display: 'block',
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      {split.hero}
                    </span>
                  </h3>
                )
              })()}
              <p className="cf-row-bedrooms">
                {fmtBedroomsLabeled(activeSkus ?? model.skus)}
              </p>
              <p className="cf-row-precio">
                <span className="cf-row-precio-lbl"></span>{' '}
                <PrecioOrCotizar
                  model={model}
                  className="cf-row-precio-val"
                  onCotizarClick={hasCotizador ? openCotizar : undefined}
                  zoneRule={zoneRule}
                />
              </p>
              {zoneRule && (zoneRule.promo_label || zoneRule.excluded || zoneRule.contact_only) && (
                <p className="cf-row-zone-badge" style={{
                  fontSize: 11,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  marginTop: 4,
                  color: zoneRule.excluded ? '#9a3b00' : zoneRule.contact_only ? '#0a5570' : '#1a5e2c',
                  fontWeight: 600,
                }}>
                  {zoneRule.excluded
                    ? '⚠ Consultar disponibilidad'
                    : zoneRule.contact_only
                      ? '☎ Cotización personal'
                      : zoneRule.promo_label
                        ? `🏷 ${zoneRule.promo_label}`
                        : ''}
                </p>
              )}
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
            {(() => {
              const split = splitModelTitle({
                style_name: model.style_name,
                tipologia_code_new: model.tipologia_code_new,
                strategy: model.naming_strategy,
              })
              return (
                <h3 className="cf-row-name" style={{ marginBottom: 28, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#0a0a0a', lineHeight: 1.05 }}>
                  {split.eyebrow && (
                    <span style={{ display: 'block', fontSize: 22, fontWeight: 500, marginBottom: 2 }}>
                      {split.eyebrow}
                    </span>
                  )}
                  <span style={{ display: 'block', fontSize: 22, fontWeight: 700 }}>
                    {split.hero}
                  </span>
                </h3>
              )
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 32, width: '100%' }}>
              {/* Bloque "Tipología" removido: la tipología ya está en el nombre
                  (display_name = "CASA NODO Estilo PAMPA"). */}
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
                <span style={{ fontSize: '9.5px', fontWeight: 500, letterSpacing: '.1em', textTransform: 'uppercase' as const, color: '#aaa', marginBottom: 4 }}></span>
                <PrecioOrCotizar
                  model={model}
                  className="cf-row-precio-val"
                  style={{ fontSize: 14 }}
                  onCotizarClick={hasCotizador ? openCotizar : undefined}
                  zoneRule={zoneRule}
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
                    {(() => {
                      const split = splitModelTitle({
                        style_name: model.style_name,
                        tipologia_code_new: model.tipologia_code_new,
                        strategy: model.naming_strategy,
                      })
                      return (
                        <p className="cf-row-overlay-name">
                          {split.eyebrow && (
                            <span style={{ fontWeight: 500 }}>{split.eyebrow} </span>
                          )}
                          <span style={{ fontWeight: 700 }}>{split.hero}</span>
                        </p>
                      )
                    })()}
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
              provinciaId={provinciaId}
              marcaWhatsapp={marcaWhatsapp}
              zoneRule={zoneRule}
              onComparativoSelect={setComparativoSel}
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
                {(() => {
                  const split = splitModelTitle({
                    style_name: model.style_name,
                    tipologia_code_new: model.tipologia_code_new,
                    strategy: model.naming_strategy,
                  })
                  return (
                    <>
                      {split.eyebrow && (
                        <span style={{ fontWeight: 500 }}>{split.eyebrow} </span>
                      )}
                      <span style={{ fontWeight: 700 }}>{split.hero}</span>
                    </>
                  )
                })()}
              </span>
              <span className="cf-row-sticky-cta-linea">
                {model.marca_name ? `${model.marca_name} · ` : ''}
                {displayLinea(model.linea)}
              </span>
            </div>
            {/* El sticky abre la MISMA modal que los botones "Cotizar" de la
                ficha — un único comportamiento en todo el catálogo. La modal
                muestra el precio "desde" + disclaimer y desde ahí se entra al
                cuadro comparativo para cotizar la variante concreta. */}
            {hasCotizador ? (
              <button
                type="button"
                className="cf-row-sticky-cta-btn"
                aria-label="Ver precio"
                onClick={(e) => {
                  e.stopPropagation()
                  track('cotizar_open', {
                    source: 'sticky_cta',
                    model: model.display_name,
                  })
                  openCotizar()
                }}
              >
                <span className="cf-row-sticky-cta-btn-full">
                  Quiero <strong style={{ fontWeight: 700 }}>esta casa</strong>
                  <span aria-hidden>→</span>
                </span>
                <span className="cf-row-sticky-cta-btn-mini" aria-hidden>
                  Ver →
                </span>
              </button>
            ) : (
              <a
                className="cf-row-sticky-cta-btn"
                aria-label="Ver precio"
                href={buildCotizarMailto({
                  modelName: model.display_name,
                  linea: displayLinea(model.linea),
                })}
              >
                <span className="cf-row-sticky-cta-btn-full">
                  Quiero <strong style={{ fontWeight: 700 }}>esta casa</strong>
                  <span aria-hidden>→</span>
                </span>
                <span className="cf-row-sticky-cta-btn-mini" aria-hidden>
                  Ver →
                </span>
              </a>
            )}
          </div>,
          document.body,
        )}

      {/* C — chevrons de scroll horizontal (← + →). Portal a body (el
          transform del shell atrapa position:fixed). En desktop son
          clickeables (scrollBy ~80% viewport). En mobile/touch son
          decorativos (CSS pointer-events:none vía media query). Aparecen/
          desaparecen según canScrollLeft / canScrollRight. */}
      {isExpanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <button
              type="button"
              className={`cf-row-scrollhint cf-row-scrollhint--left${
                canScrollLeft && shellInView ? ' cf-row-scrollhint-visible' : ''
              }`}
              aria-label="Slide anterior"
              tabIndex={canScrollLeft && shellInView ? 0 : -1}
              onClick={() => scrollShellBy(-1)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/arrow-scroll.png"
                alt=""
                aria-hidden="true"
                className="cf-row-scrollhint-img"
              />
            </button>
            <button
              type="button"
              className={`cf-row-scrollhint cf-row-scrollhint--right${
                canScrollRight && shellInView ? ' cf-row-scrollhint-visible' : ''
              }`}
              aria-label="Slide siguiente"
              tabIndex={canScrollRight && shellInView ? 0 : -1}
              onClick={() => scrollShellBy(1)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/arrow-scroll.png"
                alt=""
                aria-hidden="true"
                className="cf-row-scrollhint-img"
              />
            </button>
          </>,
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

      {/* Modal centrada de cotización (abre desde la ficha del listado o
          desde el sticky CTA). Adentro del comparativo (Panel7) se usa la
          persiana que ya tiene la selección variante+SC del usuario. */}
      {hasCotizador && cotizador && (
        <CotizarCenteredModal
          open={cotizarModalOpen}
          onClose={() => setCotizarModalOpen(false)}
          cotizador={cotizador}
          // Si el usuario ya eligió variante en el comparativo, cotizamos esa
          // (precios + nombre); si no, el "desde" (variante más barata).
          pricesUsd={comparativoSel?.pricesUsd ?? defaultPricesUsd}
          // Zona excluded: la modal renderiza un mensaje informativo en vez
          // del cotizador (cotizar algo que no se ofrece en la provincia del
          // usuario es engañoso). Misma decisión que `resolveFichaPrice`.
          excluded={!!zoneRule?.excluded}
          context={{
            model: model.display_name,
            variante: comparativoSel?.variante ?? null,
            sistema: null,
            marca: model.marca_name,
            linea: displayLinea(model.linea),
            marca_id: model.marca_id ?? null,
            marca_whatsapp: marcaWhatsapp,
            model_slug: model.group_slug,
            style_name: model.style_name,
            tipologia_code_new: model.tipologia_code_new,
            provincia_id: provinciaId,
            tiene_lote: tieneLote,
          }}
          onOpenComparativo={goToComparativo}
        />
      )}
    </div>
  )
}
