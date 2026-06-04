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
import { variantLabel } from '@/lib/format/variant'
import { modelGroupSlug } from '@/lib/content/model-slug'
import type { LineaRow } from '@/lib/supabase/queries/lineas'
import type { ProvinciaRow } from '@/lib/supabase/queries/zones'
import type { MarcaZonaRule, EffectiveZoneRule } from '@/lib/content/zones'
import { resolveZoneRule, applyZonePricing } from '@/lib/content/zones'
import type { Marca } from '@/types/database'
import type {
  FooterCardRow,
  FooterContentRow,
} from '@/lib/supabase/queries/footer'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import type { SistemaConstructivoLite } from '@/lib/supabase/queries/sistema-constructivo'
import type { HeaderSlide } from '@/lib/supabase/queries/header_content'
import {
  type CatalogImage,
  type CatalogAttributeRow,
  pickThumb,
  pickFull,
} from '@/lib/supabase/queries/catalog_panels'
import CatalogFooter from './CatalogFooter'
import { useRouter } from 'next/navigation'
import HomeRow from './HomeRow'
import type { HomeSlide } from '@/lib/supabase/queries/home_content'
import CotizarModal from './CotizarModal'
import ReservarModal from './ReservarModal'
import CatalogPromoBanner from './CatalogPromoBanner'
import CatalogGridPromoCard from './CatalogGridPromoCard'
import {
  filterPromosForProvincia,
  type PromoMessage,
} from '@/lib/supabase/queries/promos'
import { logPromoEvent } from '@/app/_track/promo-events/actions'
import { track } from '@/lib/track/client'
import { skuPrices, type CotizadorData } from '@/lib/content/cotizador-data'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  models: CatalogModel[]
  brandContent?: BrandContent[]
  lineContent?: LineContent[]
  /** Fase 2: slides editables del header resueltos (CF o marca). Se pasa a
   *  HeroRow; sin filas, cada slide cae a su hardcoded (cero regresión). */
  headerSlides?: HeaderSlide[]
  /** Copy editorial por sistema constructivo (global + per-marca). El panel
   *  SC lo prefiere sobre brandContent; si está vacío, cae al legacy. */
  scContent?: SistemaConstructivoLite[]
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
  /** Cierre + institucional del footer (singleton CF). null → hardcoded. */
  footerContent?: FooterContentRow | null
  /** Slides del HomeRow resueltos (B2B hereda B2C). Vacío → defaults. */
  homeSlides?: HomeSlide[]
  /** Marca activa (en /catalogo/[marca]). Null/undefined en el agregador.
   *  Controla logo, breadcrumb y filtros de contenido contextual. */
  selectedMarca?: { id: string; name: string; slug: string; logo_url: string | null } | null
  /** Modo inicial: si true, la grilla del catálogo arranca OCULTA y se
   *  muestra el HomeSlider (5 cards editoriales con CTA "Ver catálogo").
   *  Se usa en `/` (home) — entrar al catálogo es un toggle interno, no una
   *  navegación. Default false (modo catálogo normal, ej. /catalogo/[marca]). */
  initialHomeMode?: boolean
  /** 'b2b' (ruta /empresas): HomeRow usa copy B2B y "Ver catálogo" navega
   *  al catálogo B2C abierto (/catalogo) en vez del toggle interno.
   *  El contenido del HeroRow B2B llega por `headerSlides` (variant b2b). */
  variant?: 'b2c' | 'b2b'
  /** "Condiciones de Entrega" (HTML saneado, resuelto server). Se pasa a
   *  ModelRow→ExpandedPanels (pill en el panel Exteriores). null → sin pill. */
  deliveryConditionsHtml?: string | null
  /** Cotizador Uber (tramos + cuota + slot base por marca). Resuelto server
   *  en loadHomeData. null/sin tramos → la ficha cae al CTA "Cotizar" de
   *  siempre (cero regresión en rutas que aún no lo pasan). */
  cotizador?: CotizadorData | null
  /** Cards institucionales (marca_id NULL) para reemplazar TRUST_CARDS
   *  hardcodeadas en el agregador y como fallback per-marca sin cards. */
  institutionalFooterCards?: FooterCardRow[]
  /** Si está seteado, el catálogo arranca en modo catalog (no home) y abre
   *  inmediatamente el modelo cuyo slug nuevo (`casa-<tipo>-<style>`) matchea.
   *  Lo usa /modelos/[slug] para deep-linking con SEO. */
  initialModelSlug?: string | null
  /** Lista de provincias para el selector "Ubicación" de StickyFilters. */
  provincias?: ProvinciaRow[]
  /** Reglas zonales activas (marca_zonas). Vacío = sin reglas, todos los
   *  modelos se muestran sin modificaciones. */
  marcaZonas?: MarcaZonaRule[]
  /** Provincia inicial a aplicar si el usuario no eligió ninguna todavía
   *  (no hay valor en localStorage). Lo usan las landings de campaña de
   *  /casa-financiada/[localidad] para que la página arranque con la
   *  provincia correcta sin que el visitante tenga que setearla. */
  initialProvinciaId?: string | null
  /** Banners promocionales admin-driven (tabla `promo_messages`).
   *  Se filtran en cliente por provincia activa con
   *  `filterPromosForProvincia`. Vacío = catálogo cae a los banners
   *  hardcoded por cohorte Lote (sin regresión). */
  promos?: PromoMessage[]
}

type Station = 'portada' | 'exteriores' | 'interiores' | 'comparador' | 'datos'

const STATIONS: { id: Station; label: string }[] = [
  { id: 'portada', label: 'Portada' },
  { id: 'exteriores', label: 'Exteriores' },
  { id: 'interiores', label: 'Interiores' },
  { id: 'comparador', label: 'Comparador' },
  { id: 'datos', label: 'Datos' },
]

const LINE_ORDER = ['LÍNEA TERRA', 'LÍNEA ATLAS', 'LÍNEA BOSQUE']

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function CatalogPage({
  models = [],
  brandContent = [],
  lineContent = [],
  headerSlides = [],
  scContent = [],
  lineas = [],
  marcas = [],
  modelContentMap = {},
  catalogImages = [],
  catalogAttributes = [],
  featuredModels = [],
  footerCardsByMarca = {},
  footerContent = null,
  homeSlides = [],
  selectedMarca = null,
  initialHomeMode = false,
  variant = 'b2c',
  deliveryConditionsHtml = null,
  cotizador = null,
  institutionalFooterCards = [],
  initialModelSlug = null,
  provincias = [],
  marcaZonas = [],
  initialProvinciaId = null,
  promos = [],
}: PageProps) {
  const router = useRouter()
  // Máquina de estados de transición home ↔ catálogo.
  //
  //   home    → HomeSlider visible. Catálogo desmontado.
  //   opening → HomeSlider shell se cierra (persiana arriba). Catálogo shell
  //             se abre con un PLACEHOLDER vacío de altura fija (1 viewport)
  //             — eso da al shell altura visible durante la persiana,
  //             evitando que el footer "suba" porque no hay contenido.
  //   catalog → Placeholder reemplazado por el catálogo real, que entra con
  //             fade-in (solo opacity, sin movimiento vertical).
  //   closing → Catálogo fade-out, luego phase=home cierra todo.
  //
  // El truco del placeholder resuelve el bug del shell vacío: como React
  // tarda en montar 100+ ModelRow, mientras tanto el placeholder mantiene la
  // altura. Después se monta el catálogo en su lugar sin saltos.
  type LandingPhase = 'home' | 'opening' | 'catalog' | 'closing'
  const [phase, setPhase] = useState<LandingPhase>(
    initialHomeMode ? 'home' : 'catalog',
  )

  const SHELL_MS = 900 // duración persiana (sincronizado con CSS)
  const FADE_MS = 400 // duración fade-in/out del catálogo

  const goToCatalog = () => {
    if (phase !== 'home') return
    setPhase('opening')
    window.setTimeout(() => setPhase('catalog'), SHELL_MS)
  }
  const goToHome = () => {
    if (phase !== 'catalog') return
    setPhase('closing')
    window.setTimeout(() => setPhase('home'), FADE_MS)
  }

  // Booleanos derivados para JSX
  const homeShellOpen = phase === 'home'
  const showHomeSlider = phase === 'home'
  const catalogShellOpen = phase !== 'home'
  // El catálogo SE MONTA tarde (después de la persiana). El placeholder
  // ocupa su lugar durante 'opening' para que el shell tenga altura visible.
  const catalogMounted = phase === 'catalog' || phase === 'closing'
  const showPlaceholder = phase === 'opening'
  const catalogFadingOut = phase === 'closing'

  const [activeModel, setActiveModel] = useState<CatalogModel | null>(null)

  // Deep-link a /modelos/[slug]: al montar buscamos el modelo cuyo slug nuevo
  // matchea el initialModelSlug y lo abrimos. Una vez (no re-corre si el
  // usuario navega manualmente después).
  useEffect(() => {
    if (!initialModelSlug || activeModel) return
    const target = models.find((m) =>
      modelGroupSlug({
        style_name: m.style_name,
        tipologia_code_new: m.tipologia_code_new,
      }) === initialModelSlug,
    )
    if (target) setActiveModel(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialModelSlug])
  const [station, setStation] = useState<Station>('portada')
  // Multi-select: arrays. '' inicial sería un valor inválido, así que arrays vacíos.
  const [bedFilters, setBedFilters] = useState<string[]>([])
  const [sizeFilters, setSizeFilters] = useState<string[]>([])
  const [priceFilter, setPriceFilter] = useState<string | null>(null)
  const [provinciaId, setProvinciaId] = useState<string | null>(null)
  const [onlyOffers, setOnlyOffers] = useState<boolean>(false)
  // Filtro Lote — diferenciador estructural del producto. 'si' (tiene lote),
  // 'no' (busca casa+lote), null (no eligió → hero banner activo).
  // El estado se setea desde el CatalogPromoBanner hero (no desde
  // StickyFilters — sacamos el filtro de ahí porque inflaba la barra).
  // Persistido como provincia (ubicación + intención de compra son contexto
  // del usuario, no estado efímero).
  const [tieneLote, setTieneLote] = useState<'si' | 'no' | null>(null)

  // Resolución de promos admin para la provincia activa. Cae a [] si
  // no hay tabla cargada — los hero banners hardcoded por cohorte tieneLote
  // siguen funcionando independientes (cero regresión).
  const visiblePromos: PromoMessage[] = filterPromosForProvincia(
    promos,
    provinciaId,
  )
  const adminHeroPromos = visiblePromos.filter((p) => p.scope === 'hero')
  const adminIntermediatePromos = visiblePromos.filter(
    (p) => p.scope === 'intermediate',
  )

  // Tracking de impresiones de banners admin — UNA por session por banner
  // visible (incluye provincia/cohorte como dimensiones del evento). El
  // useRef evita duplicar si el componente re-renderiza por otros filtros.
  const trackedImpressions = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ua = window.navigator.userAgent
    for (const p of visiblePromos) {
      const key = `${p.id}::${provinciaId ?? '_'}::${tieneLote ?? '_'}`
      if (trackedImpressions.current.has(key)) continue
      trackedImpressions.current.add(key)
      void logPromoEvent({
        promo_id: p.id,
        event: 'impression',
        provincia_id: provinciaId,
        tiene_lote: tieneLote,
        user_agent: ua,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePromos.map((p) => p.id).join(','), provinciaId, tieneLote])

  // Helper para wrap los onClick del CTA con tracking. El handler real
  // sigue ejecutándose; el track es side-effect.
  const trackedHandler = (promoId: string, handler: () => void) => () => {
    void logPromoEvent({
      promo_id: promoId,
      event: 'click',
      provincia_id: provinciaId,
      tiene_lote: tieneLote,
      user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null,
    })
    handler()
  }
  // Map cta_action → handler. Cuando Ximia esté live, flippeamos
  // XIMIA_LIVE a true y los CTAs action='ximia' abren el chat real.
  // Mientras tanto los redirigimos al contacto genérico Y sobrescribimos
  // el label del founder (ver promoCtaLabel) para no prometer una
  // conversación con un agente que no responde.
  const XIMIA_LIVE = false
  const promoCtaHandler = (action: PromoMessage['cta_action']) => {
    if (action === 'contactar') return () => setContactarOpen(true)
    if (action === 'ximia') {
      // TODO: cuando XIMIA_LIVE = true, abrir Ximia chat real
      return () => setContactarOpen(true)
    }
    return () => {} // none / saber_mas → no-op (saber_mas se implementa cuando exista la modal)
  }
  /** Override del label del CTA para evitar promesas rotas. Si action es
   *  'ximia' y Ximia no está live, mostramos copy honesto de contacto. */
  const promoCtaLabel = (action: PromoMessage['cta_action'], label: string | null) => {
    if (action === 'ximia' && !XIMIA_LIVE) return 'Quiero que me contacten'
    return label
  }

  /** Helper para CTAs hardcoded "Conversar con Ximia": mientras XIMIA_LIVE
   *  es false el label cae a "Quiero que me contacten" y la acción abre
   *  el modal de contacto genérico. Cuando flipeemos XIMIA_LIVE a true,
   *  el onClick debe abrir el chat de Ximia (TODO). */
  const ximiaCta = (preferredLabel: string) => ({
    label: XIMIA_LIVE ? preferredLabel : 'Quiero que me contacten',
    onClick: () => setContactarOpen(true),
  })
  // Orden fijo a "recommended" — sacamos el selector del UI (decisión del cliente).
  // El sort por featured_rank vive inline en el .sort() del listado.

  // Persistencia de la provincia entre sesiones (la ubicación es contexto del
  // usuario, no estado efímero). Si la página recibe initialProvinciaId
  // (campañas /casa-financiada/[localidad]) y no hay valor previo, lo usamos
  // como semilla (y se persiste vía el otro effect).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('cf-provincia-id')
    if (stored) setProvinciaId(stored)
    else if (initialProvinciaId) setProvinciaId(initialProvinciaId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (provinciaId) window.localStorage.setItem('cf-provincia-id', provinciaId)
    else window.localStorage.removeItem('cf-provincia-id')
  }, [provinciaId])

  // Persistencia del filtro Lote — mismo patrón que provincia. El valor sólo
  // puede ser 'si' / 'no' / null, así que filtramos cualquier basura.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem('cf-tiene-lote')
    if (stored === 'si' || stored === 'no') setTieneLote(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (tieneLote) window.localStorage.setItem('cf-tiene-lote', tieneLote)
    else window.localStorage.removeItem('cf-tiene-lote')
  }, [tieneLote])
  // Modal de contacto genérico (mid-CTA "¿Te ayudo a elegir?"). Reemplaza el
  // mailto que rompía sin cliente de mail configurado.
  const [contactarOpen, setContactarOpen] = useState(false)

  // Helpers de toggle — SINGLE-select. Clickear el pill activo lo
  // deselecciona; clickear otro lo reemplaza. Patrón nuevo: no tiene
  // sentido filtrar "2 dormitorios o 4 pero no 3" — el rango con huecos
  // confunde más de lo que ayuda. Si en el futuro hay caso real de multi
  // (ej. "1 ó 4+ con offer"), refactoreamos.
  const toggleBed = (v: string) =>
    setBedFilters((cur) => (cur.includes(v) ? [] : [v]))
  const toggleSize = (v: string) =>
    setSizeFilters((cur) => (cur.includes(v) ? [] : [v]))
  const toggleOffers = () => setOnlyOffers((v) => !v)


  const detailRef = useRef<HTMLDivElement>(null)
  const detailTrackRef = useRef<HTMLDivElement>(null)

  // ── Filter models ──
  // Convención: filtro vacío = "sin filtrar". Se aceptan estos valores:
  //   bedFilter:    '' | '1' | '2' | '3' | '4+'
  //   sizeFilter:   '' | 'S' | 'SM' | 'M' | 'L'

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
    // 4 buckets — labels en StickyFilters.SIZE_OPTIONS.
    if (sf === 'S')  return a < 70             // cabaña / individual
    if (sf === 'M')  return a >= 70 && a < 100 // pareja / familia chica
    if (sf === 'L')  return a >= 100 && a < 150 // familiar
    if (sf === 'XL') return a >= 150           // familia grande / premium
    return true
  }
  // Bandas de precio (USD lista). Cubren la distribución real del catálogo.
  const skuMatchesPrice = (sku: CatalogModel['skus'][number], pf: string): boolean => {
    const p = sku.precio_lista_usd ?? 0
    if (p <= 0) return false
    if (pf === 'lt100')   return p < 100_000
    if (pf === '100-150') return p >= 100_000 && p < 150_000
    if (pf === '150-300') return p >= 150_000 && p < 300_000
    if (pf === 'gt300')   return p >= 300_000
    return true
  }

  // ── Resolución de reglas zonales por (modelo, provincia) ────────────
  // Pre-computamos la regla "general" (linea=null, sc=null) por modelo y el
  // mapa de reglas más específicas por SKU. El catálogo público usa la
  // general para badges y el wrapper de precio del modelo; CotizarModal usa
  // la más específica del SKU concreto.
  //
  // Si provinciaId == null, no aplicamos nada (mismo comportamiento de antes).
  // Si la marca/línea/SC no tiene regla, la rule es vacía (EMPTY_RULE).
  const zoneByModel = new Map<string, EffectiveZoneRule>()
  const zoneBySku = new Map<string, EffectiveZoneRule>()
  if (provinciaId) {
    for (const m of models) {
      if (!m.marca_id) continue
      // Encontramos la lineaId via el primer SKU (todos los SKUs del grupo
      // comparten línea — está agrupado por linea, style, tipologia).
      // marca_zonas.linea_id matchea contra lineas.id; CatalogModel guarda
      // linea como text canónico, no id, así que la resolución por línea
      // necesita un pasaje vía nombre→id. Por ahora resolvemos sin lineaId
      // (treated as null). Refinamiento futuro: hidratar linea_id en el bag.
      const modelRule = resolveZoneRule(marcaZonas, {
        marca_id: m.marca_id,
        provincia_id: provinciaId,
        linea_id: null,
        sc: null,
      })
      zoneByModel.set(m.group_slug, modelRule)
      for (const s of m.skus) {
        const skuRule = resolveZoneRule(marcaZonas, {
          marca_id: m.marca_id,
          provincia_id: provinciaId,
          linea_id: null,
          sc: s.sistema_constructivo,
        })
        zoneBySku.set(s.id, skuRule)
      }
    }
  }

  // Match contra los arrays de filtros activos. Lógica OR dentro del mismo
  // filtro (bedFilters=[2,3] → bed=2 OR bed=3), AND entre filtros distintos
  // (beds=[2] AND sizes=[M] → bed=2 Y size=M).
  const skuMatchesFilters = (sku: CatalogModel['skus'][number]): boolean => {
    if (bedFilters.length > 0 && !bedFilters.some((b) => skuMatchesBed(sku, b))) return false
    if (sizeFilters.length > 0 && !sizeFilters.some((s) => skuMatchesSize(sku, s))) return false
    if (priceFilter && !skuMatchesPrice(sku, priceFilter)) return false
    return true
  }

  // Modelo visible si al menos un SKU pasa los filtros.
  // El sort por precio usa price_from interno (los precios no se muestran al
  // público pero la data sigue siendo válida para ordenar).
  const filtered = models.filter(m => {
    // Ofertas (oculta modelos sin ningún SKU en oferta activa).
    if (onlyOffers && !m.skus.some((s) => s.is_offer)) return false
    if (bedFilters.length === 0 && sizeFilters.length === 0 && !priceFilter) return true
    return m.skus.some(skuMatchesFilters)
  }).sort((a, b) => {
    // Solo "recommended" en el UI público. featured_rank asc, NULL al final.
    const ra = a.featured_rank
    const rb = b.featured_rank
    if (ra == null && rb == null) return 0
    if (ra == null) return 1
    if (rb == null) return -1
    return ra - rb
  })

  // ── Filtros dinámicos: qué opciones tendrían al menos 1 modelo si se
  // combinaran con los OTROS filtros activos. Las que no, van disabled en
  // la barra sticky para evitar que el usuario llegue a un listado vacío.
  const BED_OPTIONS = ['1', '2', '3', '4+']
  const SIZE_OPTIONS = ['S', 'M', 'L', 'XL']
  const PRICE_OPTIONS = ['lt100', '100-150', '150-300', 'gt300']

  // ¿Hay al menos 1 modelo que pase (beds[], sizes[], prices[])?
  // Misma lógica OR-dentro/AND-entre que skuMatchesFilters, pero con arrays
  // que el caller controla.
  const hasResultsFor = (beds: string[], sizes: string[], price: string | null = priceFilter): boolean =>
    models.some((m) => {
      if (beds.length === 0 && sizes.length === 0 && !price) return true
      return m.skus.some((s) => {
        if (beds.length > 0 && !beds.some((b) => skuMatchesBed(s, b))) return false
        if (sizes.length > 0 && !sizes.some((sz) => skuMatchesSize(s, sz))) return false
        if (price && !skuMatchesPrice(s, price)) return false
        return true
      })
    })

  // Una opción está enabled si: ya está activa (para destildarla) O el
  // resultado de tener SOLO esa opción activa (junto con los filtros de
  // los otros ejes) tiene al menos 1 modelo. En multi-select basta con que
  // por sí sola haya match — se va a unir vía OR con las ya activas.
  const enabledBeds = new Set(
    BED_OPTIONS.filter(
      (b) => bedFilters.includes(b) || hasResultsFor([b], sizeFilters, priceFilter),
    ),
  )
  const enabledSizes = new Set(
    SIZE_OPTIONS.filter(
      (s) => sizeFilters.includes(s) || hasResultsFor(bedFilters, [s], priceFilter),
    ),
  )
  const enabledPrices = new Set(
    PRICE_OPTIONS.filter(
      (p) => priceFilter === p || hasResultsFor(bedFilters, sizeFilters, p),
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
    'LÍNEA BOSQUE': '/bosque-icon.png',
    'LÍNEA ATLAS': '/atlas-icon.png',
    'LÍNEA TERRA': '/terra-icon.png',
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
      byLinea[key].set(img.id, pickThumb(img))
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
          tipologias: m.tipologia_code_new
            ? [m.tipologia_code_new]
            : m.tipologia_code ? [m.tipologia_code] : [],
          group_slugs: [m.group_slug],
        })
      } else {
        const tipCode = m.tipologia_code_new ?? m.tipologia_code
        if (tipCode && !existing.tipologias.includes(tipCode)) {
          existing.tipologias.push(tipCode)
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
    const bosque = models.filter((m) => m.linea === 'LÍNEA BOSQUE')
    const pairs: GrowthPair[] = []

    const findExteriorForSku = (skuId: string): string | undefined => {
      // Imágenes exteriores (no planos) linkeadas a ese SKU vía model_image_skus.
      const candidates = catalogImages.filter(
        (img) =>
          img.is_exterior === true &&
          img.image_type !== 'plano' &&
          img.sku_ids.includes(skuId),
      )
      return candidates[0] ? pickFull(candidates[0]) : undefined
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
      {/* ── Header del sitio (NO sticky) ──
          Cuando estamos en home (`/` + initialHomeMode=true), el link "Inicio"
          del breadcrumb se convierte en un button que vuelve al modo home
          desde el modo catálogo, sin navegación. */}
      <SiteHeader
        marcaContext={{
          selectedMarca,
          availableMarcas: marcas.map((m) => ({
            name: m.name,
            slug: m.slug,
            logo_url: m.logo_url,
          })),
        }}
        onInicioClick={
          initialHomeMode && phase !== 'home' && phase !== 'closing'
            ? goToHome
            : undefined
        }
        homeMode={phase === 'home'}
        onVerCatalogo={
          phase === 'home'
            ? variant === 'b2b'
              ? () => router.push('/catalogo')
              : goToCatalog
            : undefined
        }
      />

      {/* ── Hero row: primera fila siempre desplegada ── */}
      <HeroRow
        brandContent={brandContent}
        lineContent={lineContent}
        headerSlides={headerSlides}
        lineas={lineas}
        lineaCoverByName={coverByLineaName}
        growthPairs={growthPairs}
        lineaPhotosByName={lineaPhotosByName}
        modelosByLineaName={modelosByLineaName}
        onVerCatalogo={
          phase === 'home'
            ? variant === 'b2b'
              ? () => router.push('/catalogo')
              : goToCatalog
            : undefined
        }
      />

      {/* ── Catálogo en shell expandible, ARRIBA del HomeSlider.
          Cuando se abre, empuja al HomeSlider hacia abajo (flow natural).
          Como el catálogo es muy alto, el HomeSlider queda fuera del
          viewport — no necesitamos colapsarlo. Al cerrar, el catálogo se
          cierra de abajo hacia arriba (shell colapsa) y el HomeSlider
          vuelve a su lugar empujado por el flow. ── */}
      <div
        className={`cf-section-shell${catalogShellOpen ? ' is-open' : ''}`}
        aria-hidden={!catalogShellOpen}
      >
        <div className="cf-section-shell-inner">
          {showPlaceholder && (
            <div className="cf-catalog-placeholder" aria-hidden="true" />
          )}
          {catalogMounted && (
          <div
            className={`cf-catalog-content${
              catalogFadingOut ? ' is-out' : ''
            }`}
          >
          <StickyFilters
            bedFilters={bedFilters}
            sizeFilters={sizeFilters}
            priceFilter={priceFilter}
            provinciaId={provinciaId}
            onlyOffers={onlyOffers}
            tieneLote={tieneLote}
            enabledBeds={enabledBeds}
            enabledSizes={enabledSizes}
            enabledPrices={enabledPrices}
            provincias={provincias}
            onBedToggle={toggleBed}
            onSizeToggle={toggleSize}
            onPriceChange={setPriceFilter}
            onProvinciaChange={setProvinciaId}
            onOffersToggle={toggleOffers}
            onTieneLoteChange={setTieneLote}
          />

          {/* Hero banner Casa + Lote — diferenciador estructural del
              producto. Reemplaza al filtro Lote que estaba en StickyFilters
              (rompía el ancho de la barra). Estados:
                • null  → hero verde con dos CTAs (setean tieneLote)
                • 'si'  → strip inline verde, confirmación + cambiar respuesta
                • 'no'  → strip inline cyan, CTA "Quiero que me contacten"
                          (abre ReservarModal genérico). Cuando Ximia esté
                          live, el destino del CTA se flippea. */}
          {tieneLote === null && (
            <CatalogPromoBanner
              color="green"
              variant="hero"
              eyebrow="Casa + Lote"
              body="Tu casa, financiada — con o sin terreno propio."
              actions={[
                {
                  label: 'Tengo terreno',
                  onClick: () => setTieneLote('si'),
                },
                {
                  label: 'Necesito terreno',
                  onClick: () => setTieneLote('no'),
                },
              ]}
            />
          )}
          {/* Strips cohorte ('si' / 'no') retirados: el refuerzo de
              contexto vive en CatalogGridPromoCard al inicio del grid
              (card editorial grande). El sticky tiene el select Terreno
              para cambiar respuesta. */}

          {/* Hero promos admin-driven — DEBAJO del cohorte hero. Decisión
              firme: cohorte siempre primero (es el banner estructural del
              producto), admin hero refuerza pero no compite. Si el founder
              quiere dominar el slot superior, debería usar scope='hero'
              + sort_order bajo (esto se refleja en el orden de map abajo). */}
          {adminHeroPromos.map((p) => {
            const ctaLabel = promoCtaLabel(p.cta_action, p.cta_label)
            return (
              <CatalogPromoBanner
                key={p.id}
                color={p.color}
                variant="hero"
                eyebrow={p.titulo}
                body={p.cuerpo}
                actions={
                  p.cta_action !== 'none' && ctaLabel
                    ? [{
                        label: ctaLabel,
                        onClick: trackedHandler(p.id, promoCtaHandler(p.cta_action)),
                      }]
                    : undefined
                }
              />
            )
          })}

          <div className="cf-grid">
        {Object.entries(grouped).map(([line, items], gi) => (
          <div key={line}>
            {/* Cards editoriales Casa+Lote / Financiación al inicio del
                primer grupo (gi===0 = LÍNEA TERRA). Una por cohorte. El
                null state (sin elegir) no muestra card — el hero verde
                con CTAs Tengo/Necesito terreno cumple esa función. */}
            {gi === 0 && tieneLote === 'no' && (
              <CatalogGridPromoCard
                eyebrow="Casa + Lote + financiación"
                title="¿No tenés terreno?"
                body="Tenemos propuestas únicas de Casa + Lote con financiación. Contactanos o hacé el proceso de pre-calificación financiera con Ximia."
                actions={[
                  ximiaCta('Conversar con Ximia'),
                  {
                    label: 'Necesito Casa + Lote',
                    onClick: () => setContactarOpen(true),
                  },
                ]}
              />
            )}
            {gi === 0 && tieneLote === 'si' && (
              <CatalogGridPromoCard
                eyebrow="Financiación"
                title="Armá tu plan de pagos"
                body="Consultá por nuestros exclusivos planes de financiación hasta 30 años. Buscá en nuestro catálogo la casa perfecta para vos y hacé con Ximia la pre-calificación financiera para acceder a un crédito."
                bgImage="/casas/1.jpg"
                actions={[ximiaCta('Conversar con Ximia')]}
              />
            )}
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
                    .sort((a, b) => {
                      // El cover SIEMPRE es de frente; a igualdad, la foto
                      // más específica de la variante (menos SKUs linkeados).
                      const af = (a.view_label ?? '')
                        .trim()
                        .toLowerCase()
                        .startsWith('frente')
                      const bf = (b.view_label ?? '')
                        .trim()
                        .toLowerCase()
                        .startsWith('frente')
                      if (af !== bf) return af ? -1 : 1
                      return a.sku_ids.length - b.sku_ids.length
                    })[0]
                : null
              const dynamicCoverUrl = dynamicCoverImg
                ? pickThumb(dynamicCoverImg)
                : model.cover_url

              // Otros modelos en la misma (linea, tipologia_code_new) — panel 5.
              // Usa `models` raw (no `filtered`) porque el panel Estilos quiere
              // mostrar SIEMPRE toda la oferta de estilos de la tipología, sin
              // que el filtro de estilo activo lo deje vacío.
              //
              // Importante: usamos `tipologia_code_new` (NODO/DECK/ZETA), no la
              // legacy `tipologia_code` (O/U/Z). El mapeo legacy → new no es 1:1
              // (un mismo "O" puede ser NODO o DECK según el SKU), así que filtrar
              // por la legacy mezcla tipologías distintas en el panel.
              const otherStyles = models.filter(
                (m) =>
                  m.linea === model.linea &&
                  m.tipologia_code_new === model.tipologia_code_new &&
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
                  scContent={scContent}
                  attributesForCatalogIds={modelAttributes}
                  otherStyles={otherStyles}
                  modelContentMap={modelContentMap}
                  allModels={filtered}
                  lineaIconUrl={iconByLineaName[model.linea] ?? null}
                  deliveryConditionsHtml={deliveryConditionsHtml}
                  cotizador={cotizador}
                  zoneRule={zoneByModel.get(model.group_slug) ?? null}
                  provinciaId={provinciaId}
                  tieneLote={tieneLote}
                  marcaWhatsapp={
                    model.marca_id
                      ? marcas.find((mm) => mm.id === model.marca_id)?.whatsapp_number ?? null
                      : null
                  }
                />
              )
            })}

            {/* Banners intermedios entre líneas (variant='inline'). Solo
                renderean si el founder agregó un admin promo para ese slot
                desde /admin/promos. No hay fallback hardcoded — los inline
                "flotaban" mal visualmente y los sacamos. El refuerzo de
                contexto (Casa+Lote / financiación) vive en CatalogGridPromoCard
                al inicio del grid según cohorte tieneLote. */}
            {(() => {
              const adminPromo = adminIntermediatePromos[gi]
              if (!adminPromo) return null
              const ctaLabel = promoCtaLabel(adminPromo.cta_action, adminPromo.cta_label)
              return (
                <div style={{ margin: '16px 0' }}>
                  <CatalogPromoBanner
                    color={adminPromo.color}
                    variant="inline"
                    eyebrow={adminPromo.titulo}
                    body={adminPromo.cuerpo}
                    actions={
                      adminPromo.cta_action !== 'none' && ctaLabel
                        ? [
                            {
                              label: ctaLabel,
                              onClick: trackedHandler(
                                adminPromo.id,
                                promoCtaHandler(adminPromo.cta_action),
                              ),
                            },
                          ]
                        : undefined
                    }
                  />
                </div>
              )
            })()}
          </div>
        ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── HomeRow: visible en `home` y durante `opening`/`closing` (mantiene
          la sensación de persiana del catálogo deslizándose por encima).
          En `catalog` (catálogo totalmente abierto) se OCULTA — sino
          aparece abajo del catálogo al hacer scroll, lo cual no tiene
          sentido contextual (el usuario ya está navegando el catálogo).
          El fade-out usa la misma duración que el shell para que se
          sienta como una sola transición. ── */}
      {phase !== 'catalog' && (
        <div
          className={`cf-home-row-wrap ${phase === 'opening' ? 'cf-home-row-wrap-fading' : ''}`}
          aria-hidden={phase !== 'home'}
        >
          <HomeRow
            homeSlides={homeSlides}
            variant={variant}
            onVerCatalogo={
              variant === 'b2b' ? () => router.push('/catalogo') : goToCatalog
            }
          />
        </div>
      )}

      {/* ── Footer del catálogo (cierre + marquee + base) ──
          hideMarcaCards: en vista agregador (sin marca seleccionada), las
          cards de marca del marquee desaparecen — solo tienen sentido en
          el catálogo de una marca específica. */}
      <CatalogFooter
        featuredModels={featuredModels}
        marcas={marcas}
        footerCardsByMarca={footerCardsByMarca}
        institutionalFooterCards={institutionalFooterCards}
        footerContent={footerContent}
        onOpenModel={openDetail}
        hideMarcaCards={!selectedMarca}
      />

      {/* Modal genérico de contacto (mid-CTA + futuro: cualquier CTA del
          catálogo público sin contexto de modelo). Reemplaza los mailto. */}
      <ReservarModal
        open={contactarOpen}
        onClose={() => setContactarOpen(false)}
        context={{}}
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
                <StationDatos model={activeModel} cotizador={cotizador} />
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

export function StationDatos({
  model,
  cotizador = null,
}: {
  model: CatalogModel
  cotizador?: CotizadorData | null
}) {
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

  // Los 3 precios del SKU seleccionado — el cotizador Uber muestra el real
  // de cada tramo. Sin tramos → cae al CTA "Cotizar" de siempre.
  const pricesUsd = skuPrices(currentSku)
  const hasUber = !!cotizador && cotizador.tiers.length > 0
  const [cotizarOpen, setCotizarOpen] = useState(false)
  const ctx = {
    model: model.display_name,
    variante: uniqueVariantes[selectedVariante]?.variante ?? null,
    sistema: model.systems[selectedSystem] ?? null,
  }

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
            <p className="cf-variant-name">{variantLabel(v.variante, {
              variante_labels: model.variante_labels,
              feature_delta: v.feature_delta,
            })}</p>
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

      {/* CTA → modal con selector Uber + cuota + form (no sale del catálogo).
          Sin tramos resueltos: el CTA "Cotizar" de siempre (cero regresión). */}
      {hasUber && cotizador ? (
        <>
          <button
            className="cf-wa-cta"
            onClick={() => {
              track('cotizar_open', { source: 'ficha_datos', ...ctx })
              setCotizarOpen(true)
            }}
          >
            Ver precio →
          </button>
          <CotizarModal
            open={cotizarOpen}
            onClose={() => setCotizarOpen(false)}
            cotizador={cotizador}
            pricesUsd={pricesUsd}
            context={ctx}
            offerForSC={() =>
              currentSku?.is_offer && currentSku.offer_pct != null
                ? { pct: currentSku.offer_pct, label: currentSku.offer_label?.trim() || 'Oferta' }
                : null
            }
          />
        </>
      ) : (
        <button className="cf-wa-cta">Ver precio →</button>
      )}
    </div>
  )
}
