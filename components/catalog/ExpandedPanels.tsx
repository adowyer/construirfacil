'use client'

/**
 * components/catalog/ExpandedPanels.tsx
 *
 * 9 paneles que conforman la "tira" expandida de un modelo en el catálogo.
 * Reciben datos ya fetcheados a nivel route y se renderizan en orden:
 *
 *   1. Descripción larga (model_content.body + tagline + estilo_label)
 *   2. Galería exteriores (model_images is_exterior=true + pills view_label)
 *   3. Tipología arquitectónica (line_content por linea+tipologia_code)
 *   4. Galería interiores (model_images is_exterior=false + pills view_label)
 *   5. Estilos: intro + galería comparativa (otros modelos misma tipología)
 *   6. La casa que crece (brand_content.concept + diagrama de variantes)
 *   7. Comparativo de variantes (pills V1/V2 con fotos)
 *   8. Equipamiento incluido (house_catalog_attributes agrupado por type)
 *   9. Datos + Precios + CTA WhatsApp (selector de variante + sistema)
 */

import { useState, useEffect, useRef, Fragment, type ReactNode } from 'react'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import { displayLinea } from '@/lib/supabase/queries/catalog_grouped'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import { buildCotizarMailto, buildAsesorMailto } from '@/lib/cta/mailto'
import CotizarModal from './CotizarModal'
import { track } from '@/lib/track/client'
import type { CotizadorData } from '@/lib/content/cotizador-data'
import { PRICE_SLOT_COLUMN } from '@/lib/supabase/queries/marca_price_slot'
import { applyTierModifier, pickBestCuotaArs } from '@/lib/pricing/cuota'
import { variantLabel } from '@/lib/format/variant'
import { ensureHtml } from '@/lib/content/rich'
import DeliveryConditionsModal from '@/components/catalog/DeliveryConditionsModal'
import {
  type CatalogImage,
  type CatalogAttributeRow,
  imagesForSkus,
  groupAttributesByType,
  pickFull,
} from '@/lib/supabase/queries/catalog_panels'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

interface PanelsProps {
  model: CatalogModel
  modelContent: ModelContentRow | null
  images: CatalogImage[]
  /** SKUs filtrados por bed/size; los paneles que muestren variantes deben
   *  iterar acá en lugar de model.skus para no salir del filtro del usuario. */
  activeSkus: CatalogModel['skus']
  brandContent: BrandContentLite[]
  lineContent: LineContentLite[]
  /** Copy editorial dedicado por sistema constructivo (global + per-marca).
   *  El panel SC lo prefiere; si no hay fila, cae al legacy de brandContent. */
  scContent: ScContentLite[]
  attributesForCatalogIds: CatalogAttributeRow[] // todos los attributes de los SKUs del modelo
  otherStyles: CatalogModel[] // otros modelos en misma linea+tipologia
  /** Map para resolver model_content de OTROS modelos (panel comparativa estilos). */
  modelContentMap?: Record<string, ModelContentRow>
  /** Catálogo completo — usado por el panel "También podría interesarte"
   *  para sugerir modelos relacionados de OTRAS líneas/tipologías. */
  allModels?: CatalogModel[]
  /** "Condiciones de Entrega" (HTML saneado, resuelto server). Pill sobre
   *  la galería de exteriores → modal. null → no se muestra. */
  deliveryConditionsHtml?: string | null
  /** Cotizador Uber (tramos + cuota + slot base por marca). El panel
   *  Comparativo lo usa para mostrar la cuota por variante + el selector.
   *  null/sin tramos → "Cotizar" de siempre (cero regresión). */
  cotizador?: CotizadorData | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Helpers de formato — derivar listas discretas de superficies y dormitorios
// desde los SKUs activos. Los textos del catálogo deben reflejar SKUs reales,
// no rangos sintéticos.
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

function fmtBedroomsList(skus: CatalogModel['skus']): string {
  const beds = bedroomsFromSkus(skus)
  if (beds.length === 0) return '—'
  if (beds.length === 1) return String(beds[0])
  const last = beds[beds.length - 1]
  const rest = beds.slice(0, -1).join(', ')
  return `${rest} o ${last}`
}

function areasFromSkus(skus: CatalogModel['skus']): number[] {
  const set = new Set<number>()
  for (const sku of skus) {
    const a = sku.area_m2 ?? 0
    if (a > 0) set.add(Math.round(a))
  }
  return [...set].sort((a, b) => a - b)
}

function fmtAreasList(skus: CatalogModel['skus']): string {
  const areas = areasFromSkus(skus)
  if (areas.length === 0) return '—'
  if (areas.length === 1) return `${areas[0]} m²`
  const last = areas[areas.length - 1]
  const rest = areas.slice(0, -1).join(', ')
  return `${rest} y ${last} m²`
}

/**
 * Scrollea sólo el bloque interno cuando el contenido excede `max-height: 40vh`.
 * Botones ↑ ↓ clickeables a la derecha mueven el scroll. `overscroll-behavior:
 * contain` evita que el wheel/touch propague al slider externo.
 */
function ScrollableBody({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)
  const [canUp, setCanUp] = useState(false)
  const [canDown, setCanDown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const ovf = el.scrollHeight > el.clientHeight + 1
      setOverflows(ovf)
      setCanUp(el.scrollTop > 4)
      setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4)
    }
    update()
    el.addEventListener('scroll', update)
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [children])

  const scrollBy = (delta: number) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ top: delta, behavior: 'smooth' })
  }

  return (
    <div className="cf-scrollable-body">
      <div className="cf-scrollable-body-content" ref={ref}>
        {children}
      </div>
      {overflows && (
        <>
          <button
            type="button"
            className="cf-scrollable-body-btn cf-scrollable-body-btn-up"
            disabled={!canUp}
            onClick={(e) => { e.stopPropagation(); scrollBy(-160) }}
            aria-label="Subir texto"
          >↑</button>
          <button
            type="button"
            className="cf-scrollable-body-btn cf-scrollable-body-btn-down"
            disabled={!canDown}
            onClick={(e) => { e.stopPropagation(); scrollBy(160) }}
            aria-label="Bajar texto"
          >↓</button>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PanelInlineCTA — bloque reutilizable para el cierre de cada panel.
// "Pedir cotización" contextualizado (con modelo) + "Hablar con un asesor"
// como secundario. Si se le pasa `eyebrow`, lo muestra arriba del CTA.
// ─────────────────────────────────────────────────────────────────────────────

function PanelInlineCTA({
  model,
  eyebrow,
  primaryLabel,
}: {
  model: CatalogModel
  eyebrow?: string
  primaryLabel?: string
}) {
  return (
    <div className="cf-pn-cta">
      {eyebrow && <p className="cf-pn-cta-eyebrow">{eyebrow}</p>}
      <div className="cf-pn-cta-row">
        <a
          className="cf-pn-cta-primary"
          href={buildCotizarMailto({
            modelName: model.display_name,
            linea: displayLinea(model.linea),
          })}
          onClick={(e) => e.stopPropagation()}
        >
          {primaryLabel ?? 'Cotizar'} →
        </a>
        <a
          className="cf-pn-cta-secondary"
          href={buildAsesorMailto({ linea: displayLinea(model.linea) })}
          onClick={(e) => e.stopPropagation()}
        >
          Hablar con Ximia
        </a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 1 — Descripción larga
// ─────────────────────────────────────────────────────────────────────────────

export function Panel1Description({
  model,
  modelContent,
  activeSkus,
  deliveryHtml = null,
}: {
  model: CatalogModel
  modelContent: ModelContentRow | null
  activeSkus: CatalogModel['skus']
  deliveryHtml?: string | null
}) {
  const body = modelContent?.body ?? null
  const estilo = modelContent?.estilo_label ?? model.estilo
  const lifestyleTags = modelContent?.lifestyle_tags ?? []
  const familyMin = modelContent?.family_size_min ?? null
  const familyMax = modelContent?.family_size_max ?? null

  // Variantes únicas que matchean los filtros activos del catálogo
  // (puede ser menor que model.variantes_count si el user filtró por
  // dormitorios o superficie). Coincide con el cuadro Comparativo.
  const filteredVariantesCount = new Set(activeSkus.map((s) => s.variante))
    .size

  // Labels singular/plural — la stat number puede ser "1" y el label
  // entonces va sin "s". "2" o "1, 2" → plural.
  const bedsList = bedroomsFromSkus(activeSkus)
  const dormLbl =
    bedsList.length === 1 && bedsList[0] === 1 ? 'dormitorio' : 'dormitorios'
  const varLbl = filteredVariantesCount === 1 ? 'variante' : 'variantes'

  return (
    <div className="cf-pn cf-pn-desc">
      <div className="cf-pn-desc-grid">
        <div className="cf-pn-desc-left">
          <p className="cf-pn-eyebrow">
            {model.marca_name ? `${model.marca_name} · ` : ''}
            {displayLinea(model.linea)} · {estilo}
          </p>
          <h2 className="cf-pn-title">{model.display_name}</h2>

          <div className="cf-pn-stats">
            <div>
              <p className="cf-pn-stat-num">{fmtAreasList(activeSkus)}</p>
              <p className="cf-pn-stat-lbl">superficie</p>
            </div>
            <div>
              <p className="cf-pn-stat-num">{fmtBedroomsList(activeSkus)}</p>
              <p className="cf-pn-stat-lbl">{dormLbl}</p>
            </div>
            <div>
              <p className="cf-pn-stat-num">{filteredVariantesCount}</p>
              <p className="cf-pn-stat-lbl">{varLbl}</p>
            </div>
          </div>

          {(familyMin || familyMax) && (
            <p className="cf-pn-meta">
              Ideal para{' '}
              {familyMin && familyMax
                ? `${familyMin}–${familyMax} personas`
                : familyMin
                  ? `${familyMin}+ personas`
                  : `hasta ${familyMax} personas`}
            </p>
          )}

          {lifestyleTags.length > 0 && (
            <div className="cf-pn-tags">
              {lifestyleTags.map((t) => (
                <span key={t} className="cf-pn-tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="cf-pn-desc-right">
          {body ? (
            <ScrollableBody>
              <div
                className="cf-richtext cf-pn-richtext"
                dangerouslySetInnerHTML={{ __html: ensureHtml(body) }}
              />
            </ScrollableBody>
          ) : (
            <p className="cf-pn-body-empty">
              Sin descripción cargada todavía.
            </p>
          )}
          {deliveryHtml && (
            <div className="cf-pn-desc-cta-bottom">
              <DeliveryConditionsModal html={deliveryHtml} variant="inline" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel galería genérico — base para Exteriores, Interiores, Planos, Axos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slider de imágenes con:
 *   - tabs verticales aside-left por variante (Todas / V1 / V2…) si activeSkus
 *     tiene 2+ variantes únicas. Default = "Todas".
 *   - pills de view_label abajo (cambian según el tab activo).
 *
 * El caller le pasa `images` ya filtradas por tipo (renders/planos/axos) y por
 * is_exterior si aplica. Este componente NO chequea vacío — el caller debe
 * usar `hasImagesFor*()` antes de invocarlo, sino devuelve un slide vacío.
 */
function PanelImageSlider({
  images,
  activeSkus,
  label,
  bgSize = 'cover',
  bgSizeCss,
  pillFallback,
  ignoreViewLabel = false,
  deliveryHtml = null,
  labelClassName,
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
  label: string
  bgSize?: 'cover' | 'contain'
  bgSizeCss?: string
  pillFallback: (i: number) => string
  /** Ignora view_label y usa siempre pillFallback (panel Perspectivas:
   *  los labels internos son "AXO/AXO PA/AXO-1…" → mostramos "Vista N"). */
  ignoreViewLabel?: boolean
  /** Solo Exteriores: HTML de "Condiciones de Entrega" → pill + modal. */
  deliveryHtml?: string | null
  /** Modifier opcional para el label (ej. ajuste fino de margin por panel). */
  labelClassName?: string
}) {
  // Agrupamos variantes por su parte mayor (ignorando .1 .2): V1 incluye V1.1
  // y V1.2 (subversiones que solo cambian detalles internos). V3 incluye V3.1.
  // El tab muestra solo el major; click en V1 filtra fotos de cualquier sku
  // cuya variante empiece con "1" (1, 1.1, 1.2, …).
  const variantsByMajor = new Map<string, Set<string>>()
  for (const sku of activeSkus) {
    const major = String(sku.variante).split('.')[0]
    if (!variantsByMajor.has(major)) variantsByMajor.set(major, new Set())
    variantsByMajor.get(major)!.add(sku.variante)
  }
  const majorVariants = Array.from(variantsByMajor.keys()).sort((a, b) => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
    return a.localeCompare(b)
  })
  const hasVariantTabs = majorVariants.length >= 2

  const [activeMajor, setActiveMajor] = useState<string | null>(null)
  const [activePillIdx, setActivePillIdx] = useState(0)

  const filtered = images.filter((img) => {
    if (activeMajor === null) return true
    // Imagen aplica al major si linkea a algún sku con variante del grupo (1, 1.1, …)
    const minors = variantsByMajor.get(activeMajor) ?? new Set<string>()
    const variantSkuIds = activeSkus
      .filter((s) => minors.has(s.variante))
      .map((s) => s.id)
    return img.sku_ids.some((id) => variantSkuIds.includes(id))
  })

  if (filtered.length === 0) {
    // Edge case: el usuario seleccionó una variante que no tiene fotos en este
    // panel. Resetear a "Todas" via un onClick automático sería confuso —
    // mejor mostrar un mensaje sutil.
    return (
      <div
        className="cf-pn cf-pn-gallery"
        style={{ backgroundColor: bgSize === 'contain' ? '#ffffff' : '#1a1a1a' }}
      >
        <div className="cf-pn-gallery-overlay">
          <div className="cf-pn-gallery-top">
            <span className={`cf-pn-gallery-label${labelClassName ? ' ' + labelClassName : ''}`}>{label}</span>
          </div>
          {hasVariantTabs && (
            <div className="cf-pn-variant-tabs">
              <button
                type="button"
                className={`cf-pn-variant-tab ${activeMajor === null ? 'active' : ''}`}
                onClick={() => {
                  setActiveMajor(null)
                  setActivePillIdx(0)
                }}
              >
                Todas
              </button>
              {majorVariants.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`cf-pn-variant-tab ${activeMajor === v ? 'active' : ''}`}
                  onClick={() => {
                    setActiveMajor(v)
                    setActivePillIdx(0)
                  }}
                >
                  {variantLabel(v)}
                </button>
              ))}
            </div>
          )}
          <div className="cf-pn-empty-msg">Sin fotos para esta variante.</div>
        </div>
      </div>
    )
  }

  const safeIdx = Math.min(activePillIdx, filtered.length - 1)
  const current = filtered[safeIdx]
  const isPdf = /\.pdf($|\?)/i.test(current.storage_url)
  // Paneles con bg claro: planos PDF, axonometrías. Cuando el panel es claro,
  // aplicamos `cf-pn-gallery-light` que apaga el gradient negro del overlay y
  // ajusta colores de pills/labels para mantener contraste.
  const isLight = bgSize === 'contain' || isPdf

  return (
    <div
      className={`cf-pn cf-pn-gallery${isLight ? ' cf-pn-gallery-light' : ''}${isPdf ? ' cf-pn-gallery-pdf' : ''}`}
      style={
        isPdf
          ? { backgroundColor: '#ffffff' }
          : {
            backgroundImage: `url('${pickFull(current)}')`,
            // bgSizeCss permite override raw (ej. "75% auto" en Planos);
            // sino cae al modo declarativo (cover/contain).
            backgroundSize: bgSizeCss ?? bgSize,
            // En paneles light (Axos/Planos), subir la imagen al ~32%
            // para que no choque con los pills de abajo.
            backgroundPosition: bgSize === 'contain' ? 'center 32%' : 'center',
            backgroundRepeat: 'no-repeat',
            backgroundColor: bgSize === 'contain' ? '#ffffff' : undefined,
          }
      }
    >
      {isPdf && (
        <iframe
          src={`${current.storage_url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
          className="cf-pn-pdf-embed"
          title="Plano arquitectónico"
        />
      )}
      <div className="cf-pn-gallery-overlay">
        <div className="cf-pn-gallery-top">
          <span className={`cf-pn-gallery-label${labelClassName ? ' ' + labelClassName : ''}`}>{label}</span>
          {deliveryHtml && (
            <DeliveryConditionsModal html={deliveryHtml} variant="gallery" />
          )}
        </div>

        {/* Tabs verticales por variante (solo si hay 2+) */}
        {hasVariantTabs && (
          <div className="cf-pn-variant-tabs">
            <button
              type="button"
              className={`cf-pn-variant-tab ${activeMajor === null ? 'active' : ''}`}
              onClick={() => {
                setActiveMajor(null)
                setActivePillIdx(0)
              }}
            >
              Todas
            </button>
            {majorVariants.map((v) => (
              <button
                key={v}
                type="button"
                className={`cf-pn-variant-tab ${activeMajor === v ? 'active' : ''}`}
                onClick={() => {
                  setActiveMajor(v)
                  setActivePillIdx(0)
                }}
              >
                {variantLabel(v)}
              </button>
            ))}
          </div>
        )}

        <div className="cf-pn-pills">
          {filtered.map((img, i) => (
            <button
              key={img.id}
              type="button"
              className={`cf-pn-pill ${i === safeIdx ? 'active' : ''}`}
              onClick={() => setActivePillIdx(i)}
            >
              {ignoreViewLabel
                ? pillFallback(i)
                : (img.view_label ?? pillFallback(i))}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrappers tipados: cada uno filtra y devuelve null si no hay fotos para ese
// slot (el orquestador se basa en hasImagesFor* para decidir si renderear).
// ─────────────────────────────────────────────────────────────────────────────

const isExteriorRender = (img: CatalogImage) =>
  img.is_exterior === true && img.image_type === 'render'
const isInteriorRender = (img: CatalogImage) =>
  img.is_exterior === false && img.image_type === 'render'
const isPlano = (img: CatalogImage) => img.image_type === 'plano'
const isAxo = (img: CatalogImage) => img.image_type === 'axo'

export const hasExterioresImages = (imgs: CatalogImage[]) => imgs.some(isExteriorRender)
export const hasInterioresImages = (imgs: CatalogImage[]) => imgs.some(isInteriorRender)
export const hasPlanosImages = (imgs: CatalogImage[]) => imgs.some(isPlano)
export const hasAxosImages = (imgs: CatalogImage[]) => imgs.some(isAxo)

export function PanelExteriores({
  images,
  activeSkus,
  deliveryHtml = null,
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
  deliveryHtml?: string | null
}) {
  return (
    <PanelImageSlider
      images={images.filter(isExteriorRender)}
      activeSkus={activeSkus}
      label="Exteriores"
      bgSize="cover"
      pillFallback={(i) => `Foto ${i + 1}`}
      deliveryHtml={deliveryHtml}
    />
  )
}

export function PanelInteriores({
  images,
  activeSkus,
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
}) {
  return (
    <PanelImageSlider
      images={images.filter(isInteriorRender)}
      activeSkus={activeSkus}
      label="Interiores"
      bgSize="cover"
      pillFallback={(i) => `Foto ${i + 1}`}
    />
  )
}

export function PanelPlanos({
  images,
  activeSkus,
  deliveryHtml = null,
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
  deliveryHtml?: string | null
}) {
  return (
    <PanelImageSlider
      images={images.filter(isPlano)}
      activeSkus={activeSkus}
      label="Planos"
      bgSize="contain"
      bgSizeCss="75% auto"
      pillFallback={(i) => `Plano ${i + 1}`}
      deliveryHtml={deliveryHtml}
    />
  )
}

export function PanelAxos({
  images,
  activeSkus,
  deliveryHtml = null,
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
  deliveryHtml?: string | null
}) {
  return (
    <PanelImageSlider
      images={images.filter(isAxo)}
      activeSkus={activeSkus}
      label="Perspectivas"
      bgSize="contain"
      bgSizeCss="80% auto"
      pillFallback={(i) => `Vista ${i + 1}`}
      ignoreViewLabel
      deliveryHtml={deliveryHtml}
      labelClassName="cf-pn-gallery-label--axos"
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 3 — Tipología arquitectónica
// ─────────────────────────────────────────────────────────────────────────────

export function Panel3Tipologia({
  model,
  lineContent,
}: {
  model: CatalogModel
  lineContent: LineContentLite[]
}) {
  // Buscar la fila con (linea, tipologia_code) del modelo
  const row = lineContent.find(
    (lc) =>
      lc.linea === model.linea &&
      lc.tipologia_code != null &&
      String(lc.tipologia_code).toUpperCase() === String(model.tipologia_code).toUpperCase(),
  )

  return (
    <div className="cf-pn cf-pn-text">
      <div className="cf-pn-text-inner">
        <p className="cf-pn-eyebrow">Distribución arquitectónica</p>
        <p className="cf-pn-tipo-code">Tipología {model.tipologia_code}</p>
        <h2 className="cf-pn-title">
          {row?.subtitle ?? 'Una tipología que integra distintos espacios'}
        </h2>
        {row?.body ? (
          <ScrollableBody>
            <div
              className="cf-richtext cf-pn-richtext"
              dangerouslySetInnerHTML={{ __html: ensureHtml(row.body) }}
            />
          </ScrollableBody>
        ) : (
          <p className="cf-pn-body-empty">
            Sin descripción de tipología cargada todavía.
          </p>
        )}
        <PanelInlineCTA
          model={model}
          eyebrow="¿Querés más detalles de la tipología?"
          primaryLabel="Consultar"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel Estilo (intro) — solo texto: introducción a los estilos de la línea
// ─────────────────────────────────────────────────────────────────────────────

export function PanelEstiloIntro({
  model,
  lineContent,
  otherStyles,
}: {
  model: CatalogModel
  lineContent: LineContentLite[]
  otherStyles: CatalogModel[]
}) {
  const intro = lineContent.find(
    (lc) => lc.linea === model.linea && lc.tipologia_code === 'estilos_intro',
  )
  // Cantidad de estilos disponibles para esta tipología (incluye el actual).
  const allStylesCount =
    1 + otherStyles.filter((m) => m.style_name !== model.style_name).length
  const single = allStylesCount <= 1
  // Title-case del estilo para el caso single. "moderno" → "Moderno".
  const titleCaseEstilo = (model.estilo ?? '')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
  const dynamicTitle = single
    ? `El perfecto estilo ${titleCaseEstilo}`
    : `${allStylesCount} Estilos para elegir`
  const ctaEyebrow = single
    ? '¿Querés más detalles de este estilo?'
    : '¿Querés más detalles de algún estilo?'

  return (
    <div className="cf-pn cf-pn-text">
      <div className="cf-pn-text-inner">
        <p className="cf-pn-eyebrow">{displayLinea(model.linea)} · Estilos</p>
        {/* Título siempre dinámico (item 10a): el conteo viene de los modelos
            disponibles en la DB para esta línea+tipología; el editorial del
            admin (intro?.title) NO se usa porque debe reflejar el conteo
            real, no un copy fijo. El body editorial sí se respeta. */}
        <h2 className="cf-pn-title">{dynamicTitle}</h2>
        {intro?.body ? (
          <ScrollableBody>
            <div
              className="cf-richtext cf-pn-richtext"
              dangerouslySetInnerHTML={{ __html: ensureHtml(intro.body) }}
            />
          </ScrollableBody>
        ) : (
          <p className="cf-pn-body-empty">Sin texto introductorio cargado.</p>
        )}
        <PanelInlineCTA
          model={model}
          eyebrow={ctaEyebrow}
          primaryLabel="Consultar"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel Comparativa de estilos — foto full bleed + columna lateral con texto
// del estilo seleccionado (scrolleable) + pills bottom para alternar.
// ─────────────────────────────────────────────────────────────────────────────

export function PanelEstilosCompare({
  model,
  otherStyles,
  modelContentMap = {},
}: {
  model: CatalogModel
  otherStyles: CatalogModel[]
  modelContentMap?: Record<string, ModelContentRow>
}) {
  // Modelo actual + los otros en la misma línea + tipología.
  const allStyles = [model, ...otherStyles.filter((m) => m.style_name !== model.style_name)]
  const [active, setActive] = useState(0)
  const current = allStyles[Math.min(active, allStyles.length - 1)] ?? model
  const currentContent = modelContentMap[`${current.linea}::${current.style_name}`] ?? null

  if (allStyles.length <= 1) {
    return (
      <div
        className="cf-pn cf-pn-estilos-cmp"
        style={{
          backgroundImage: model.cover_url ? `url('${model.cover_url}')` : undefined,
          backgroundColor: model.cover_url ? undefined : model.lqip_color,
        }}
      >
        <div className="cf-pn-estilos-cmp-overlay">
          <span className="cf-pn-gallery-label">Estilo</span>
        </div>
        <aside className="cf-pn-estilos-aside">
          <p className="cf-pn-eyebrow">Estilo</p>
          <h3 className="cf-pn-estilos-aside-title">{current.estilo}</h3>
          <p className="cf-pn-body-empty">
            Esta tipología solo se ofrece en este estilo.
          </p>
        </aside>
      </div>
    )
  }

  return (
    <div
      className="cf-pn cf-pn-estilos-cmp"
      style={{
        backgroundImage: current.cover_url ? `url('${current.cover_url}')` : undefined,
        backgroundColor: current.cover_url ? undefined : current.lqip_color,
      }}
    >
      {/* Label arriba */}
      <div className="cf-pn-estilos-cmp-overlay">
        <span className="cf-pn-gallery-label">Estilo</span>
      </div>

      {/* Columna lateral con texto del estilo seleccionado, scrolleable */}
      <aside className="cf-pn-estilos-aside">
        <p className="cf-pn-eyebrow">{displayLinea(current.linea)} · Estilo</p>
        <h3 className="cf-pn-estilos-aside-title">{current.estilo}</h3>
        <p className="cf-pn-estilos-aside-sub">{current.display_name}</p>
        <div className="cf-pn-estilos-aside-body">
          {currentContent?.body ? (
            <div
              className="cf-richtext cf-pn-richtext"
              dangerouslySetInnerHTML={{ __html: ensureHtml(currentContent.body) }}
            />
          ) : currentContent?.tagline ? (
            <p className="cf-pn-body-p">{currentContent.tagline}</p>
          ) : (
            <p className="cf-pn-body-empty">Sin descripción cargada.</p>
          )}
        </div>
      </aside>

      {/* Pills bottom */}
      <div className="cf-pn-estilos-cmp-pills">
        {allStyles.map((m, i) => (
          <button
            key={m.group_slug}
            type="button"
            className={`cf-pn-pill ${i === active ? 'active' : ''}`}
            onClick={() => setActive(i)}
          >
            {m.estilo}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 6 — La casa que crece + variantes
// ─────────────────────────────────────────────────────────────────────────────

export function Panel6CasaQueCrece({
  model,
  brandContent,
  activeSkus,
}: {
  model: CatalogModel
  brandContent: BrandContentLite[]
  activeSkus: CatalogModel['skus']
}) {
  const concept = brandContent.find((b) => b.key === 'concept')
  // Variantes únicas dentro de las activeSkus (respeta filtros del usuario)
  const uniqueVars = activeSkus.reduce(
    (acc, s) => {
      if (!acc.find((v) => v.variante === s.variante)) acc.push(s)
      return acc
    },
    [] as typeof activeSkus,
  )

  return (
    <div className="cf-pn cf-pn-crece">
      <div className="cf-pn-crece-grid">
        {/* Texto + GIF unidos bajo un único borde — se sienten una sola
            unidad. Variants queda afuera como bloque ortogonal. */}
        <div className="cf-pn-crece-feature">
          <div className="cf-pn-crece-text">
            <p className="cf-pn-eyebrow">Concepto</p>
            <h2 className="cf-pn-title">{concept?.title ?? 'La Casa que Crece'}</h2>
            {concept?.body ? (
              <ScrollableBody>
                <div
                  className="cf-richtext cf-pn-richtext"
                  dangerouslySetInnerHTML={{ __html: ensureHtml(concept.body) }}
                />
              </ScrollableBody>
            ) : (
              <p className="cf-pn-body-empty">Sin texto cargado.</p>
            )}
          </div>

          <div className="cf-pn-crece-anim">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/la-casa-que-crece-anim.gif"
              alt="La casa que crece — animación"
              className="cf-pn-crece-anim-img"
            />
          </div>
        </div>

        {/* La columna de "Variantes de [modelo]" se eliminó: el panel
            siguiente (Comparativo) ya muestra esa info en formato tabla
            comparativa. Mantener acá era repetitivo. */}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 7 — Cuadro comparativo entre TODAS las variantes del modelo.
// Bg con foto exterior representativa + overlay oscuro + card blanco
// con la tabla. Cada celda autocontenida (valor + label) — no hay primera
// columna de labels. Las celdas que difieren se destacan en rojo CF.
// ─────────────────────────────────────────────────────────────────────────────

// Lavadero formatter: la DB tiene 'INTERIOR' | 'EXTERIOR' | null | otra string.
function fmtLavadero(l: string | null | undefined): string {
  if (!l) return '—'
  const u = l.toUpperCase().trim()
  if (u === 'NO' || u === '-' || u === '—') return '—'
  if (u === 'INTERIOR' || u === 'INT') return '✓ Interior'
  if (u === 'EXTERIOR' || u === 'EXT') return '✓ Exterior'
  // String custom (ej. "Cubierto").
  return l
}

// Precio formatter: si la marca no muestra precios o el SKU no tiene precio,
// devolvemos "Cotizar".
function fmtPrecio(
  sku: CatalogModel['skus'][number] | null,
  showPrices: boolean,
): string {
  if (!showPrices) return 'Cotizar'
  if (!sku?.precio_lista_usd) return 'Cotizar'
  return `USD ${Math.round(sku.precio_lista_usd).toLocaleString('es-AR')}`
}

export function Panel7Comparativo({
  model,
  images,
  activeSkus,
  showPrices = false,
  cotizador = null,
}: {
  model: CatalogModel
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
  showPrices?: boolean
  cotizador?: CotizadorData | null
}) {
  // Una variante única por (variante × sistema) — pero como el SC se elige
  // arriba con pills, mostramos una fila por VARIANTE y los datos del SKU
  // que matchea (variante + SC seleccionado).
  const uniqueVars = activeSkus.reduce(
    (acc, s) => {
      if (!acc.find((v) => v.variante === s.variante)) acc.push(s)
      return acc
    },
    [] as typeof activeSkus,
  )

  // Selector de SC arriba — controla los precios de toda la tabla.
  const [selectedSCIdx, setSelectedSCIdx] = useState(0)
  const currentSC = model.systems[selectedSCIdx] ?? model.systems[0] ?? null

  // Selector de variante para la cotización inline al pie.
  const [selectedVarIdx, setSelectedVarIdx] = useState(0)

  // SKU del cruce variante × SC seleccionado. Si la combinación no existe
  // (algunos SKUs solo en un SC), caemos al SKU de la variante en cualquier SC.
  const skuForVarSC = (v: CatalogModel['skus'][number]) =>
    activeSkus.find(
      (s) => s.variante === v.variante && s.sistema_constructivo === currentSC,
    ) ??
    activeSkus.find((s) => s.variante === v.variante) ??
    null

  // ── Cuota (cotizador Uber) ───────────────────────────────────────────
  // El precio base sale del slot que la marca marcó como base (degrada a
  // 'lista'). La columna PRECIO de la tabla usa un tramo de referencia
  // (el destacado) para que las variantes sean comparables entre sí.
  const tiersOrdered = cotizador
    ? [...cotizador.tiers].sort((a, b) => a.sort_order - b.sort_order)
    : []
  const hasUber = tiersOrdered.length > 0
  const refTier =
    tiersOrdered.find((t) => t.highlighted) ?? tiersOrdered[0] ?? null
  const baseSlot =
    (model.marca_id && cotizador?.baseSlotByMarca[model.marca_id]) || 'lista'
  const baseCol = PRICE_SLOT_COLUMN[baseSlot]

  const cuotaForSku = (
    sku: CatalogModel['skus'][number] | null,
    modifierPct: number,
  ): number | null => {
    if (!sku || !cotizador || cotizador.cuotaProducts.length === 0) return null
    const best = pickBestCuotaArs({
      priceUsd: applyTierModifier(sku[baseCol] ?? 0, modifierPct),
      fxRef: cotizador.fxRef,
      products: cotizador.cuotaProducts,
    })
    return best?.cuotaArs ?? null
  }
  const fmtCuota = (n: number) =>
    '$' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 }) + '/mes'

  const cols: {
    key: string
    label: string
    get: (v: CatalogModel['skus'][number]) => string
  }[] = [
      { key: 'area', label: 'Sup.', get: (v) => (v.area_m2 ? `${Math.round(v.area_m2)} m²` : '—') },
      { key: 'floors', label: 'Plantas', get: (v) => (v.floors ? String(v.floors) : '—') },
      { key: 'beds', label: 'Dorm.', get: (v) => v.bedrooms_label ?? '—' },
      { key: 'baths', label: 'Baños', get: (v) => (v.bathrooms != null ? String(v.bathrooms) : '—') },
      { key: 'toilette', label: 'Toilette', get: (v) => (v.toilette ? '✓' : '—') },
      { key: 'parrilla', label: 'Parrilla', get: (v) => (v.parrilla ? '✓' : '—') },
      { key: 'lavadero', label: 'Lavadero', get: (v) => fmtLavadero(v.lavadero) },
      {
        key: 'precio',
        label: 'Precio',
        get: (v) => {
          if (showPrices) return fmtPrecio(skuForVarSC(v), true)
          if (hasUber && refTier) {
            const c = cuotaForSku(
              skuForVarSC(v),
              refTier.price_modifier_pct,
            )
            if (c != null) return fmtCuota(c)
          }
          return 'Cotizar'
        },
      },
    ]

  const selectedVar = uniqueVars[selectedVarIdx] ?? uniqueVars[0]
  const [cotizarOpen, setCotizarOpen] = useState(false)
  const selectedBasePrice = selectedVar
    ? skuForVarSC(selectedVar)?.[baseCol] ?? null
    : null

  // Foto de fondo del panel (item 14: la foto está bien, solo el CUADRO
  // interno va blanco). Preferimos la variante más grande con floors=2,
  // sino la mayor; fallback a cualquier exterior render del modelo.
  const sortedByArea = [...uniqueVars].sort(
    (a, b) => (b.area_m2 ?? 0) - (a.area_m2 ?? 0),
  )
  const preferred = sortedByArea.find((v) => v.floors === 2) ?? sortedByArea[0]
  const heroImg =
    (preferred &&
      imagesForSkus(images, [preferred.id]).find(
        (img) => img.is_exterior === true && img.image_type === 'render',
      )) ??
    images.find(
      (img) => img.is_exterior === true && img.image_type === 'render',
    )

  return (
    <div
      className="cf-pn cf-pn-compare cf-pn-compare-light"
      style={{
        backgroundImage: heroImg ? `url('${pickFull(heroImg)}')` : undefined,
        backgroundColor: heroImg ? undefined : model.lqip_color,
      }}
    >
      <div className="cf-pn-compare-feature">
        <header className="cf-pn-compare-header">
          <p className="cf-pn-eyebrow">
            Comparativo · Tipología {model.tipologia_code} · {displayLinea(model.linea)} · {model.display_name}
          </p>
          <h3 className="cf-pn-compare-sub">
            Cotizá la variante que más se ajusta a tus necesidades
          </h3>
        </header>

        {model.systems.length > 1 && (
          <div className="cf-pn-compare-sc-pills">
            {model.systems.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`cf-pn-pill ${i === selectedSCIdx ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedSCIdx(i)
                }}
              >
                {displaySC(s)}
              </button>
            ))}
          </div>
        )}

        <div
          className="cf-pn-compare-table"
          style={{
            gridTemplateColumns: `auto repeat(${cols.length}, minmax(72px, 1fr))`,
          }}
        >
          <div className="cf-pn-compare-corner">Variante</div>
          {cols.map((c) => (
            <div key={`th-${c.key}`} className="cf-pn-compare-th">
              {c.label}
            </div>
          ))}

          {uniqueVars.map((v, i) => {
            const isSelected = i === selectedVarIdx
            const cellCls = `cf-pn-compare-cell${isSelected ? ' selected' : ''}`
            return (
              <Fragment key={`row-${v.variante}`}>
                <button
                  type="button"
                  className={`cf-pn-compare-row-lbl${isSelected ? ' selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedVarIdx(i)
                  }}
                >
                  {variantLabel(v.variante)}
                </button>
                {cols.map((c) => (
                  <div key={`${v.variante}-${c.key}`} className={cellCls}>
                    {c.get(v)}
                  </div>
                ))}
              </Fragment>
            )
          })}
        </div>

        {/* Cotización inline — variante + SC seleccionados arriba. El
            comparativo NO se tapa: el selector Uber + cuota + form viven en
            un modal que se abre desde el CTA (nunca sale del catálogo).
            Sin cotizador: el "Cotizar" mailto de siempre (cero regresión). */}
        <div
          className="cf-pn-compare-inline-cotizar"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cf-pn-compare-inline-info">
            <span className="cf-pn-compare-inline-eyebrow">Tu selección</span>
            <span className="cf-pn-compare-inline-detail">
              {selectedVar ? variantLabel(selectedVar.variante) : ''}
              {currentSC ? ` · ${displaySC(currentSC)}` : ''}
            </span>
          </div>
          <div className="cf-pn-cta-row">
            {hasUber ? (
              <button
                type="button"
                className="cf-pn-cta-primary"
                onClick={(e) => {
                  e.stopPropagation()
                  track('cotizar_open', {
                    source: 'comparativo',
                    model: model.display_name,
                    variante: selectedVar?.variante ?? null,
                    sistema: currentSC,
                  })
                  setCotizarOpen(true)
                }}
              >
                Cotizar tu selección →
              </button>
            ) : (
              <a
                className="cf-pn-cta-primary"
                href={buildCotizarMailto({
                  modelName: model.display_name,
                  variante: selectedVar?.variante,
                  sistema: currentSC ?? undefined,
                  linea: displayLinea(model.linea),
                })}
                onClick={(e) => e.stopPropagation()}
              >
                Cotizar →
              </a>
            )}
            <a
              className="cf-pn-cta-secondary"
              href={buildAsesorMailto({ linea: displayLinea(model.linea) })}
              onClick={(e) => e.stopPropagation()}
            >
              Hablar con Ximia
            </a>
          </div>
        </div>
      </div>

      {hasUber && cotizador && (
        <CotizarModal
          open={cotizarOpen}
          onClose={() => setCotizarOpen(false)}
          cotizador={cotizador}
          basePriceUsd={selectedBasePrice}
          context={{
            model: model.display_name,
            variante: selectedVar?.variante ?? null,
            sistema: currentSC,
          }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 8 — Equipamiento incluido
// ─────────────────────────────────────────────────────────────────────────────

export function Panel8Equipamiento({
  model,
  attributesForCatalogIds,
}: {
  model: CatalogModel
  attributesForCatalogIds: CatalogAttributeRow[]
}) {
  const grouped = groupAttributesByType(attributesForCatalogIds)
  const totalValues = grouped.reduce((acc, g) => acc + g.values.length, 0)

  return (
    <div className="cf-pn cf-pn-equip">
      <div className="cf-pn-equip-inner">
        <p className="cf-pn-eyebrow">Equipamiento incluido</p>
        <h2 className="cf-pn-title">{model.display_name}</h2>

        {grouped.length === 0 ? (
          <p className="cf-pn-body-empty">
            Sin equipamiento configurado todavía. Cargá atributos desde el admin.
          </p>
        ) : (
          <>
            <p className="cf-pn-equip-sub">
              {grouped.length} categoría{grouped.length !== 1 ? 's' : ''} · {totalValues} ítem
              {totalValues !== 1 ? 's' : ''}
            </p>
            <div className="cf-pn-equip-grid">
              {grouped.map((g) => (
                <details key={g.type_id} className="cf-pn-equip-cat">
                  <summary className="cf-pn-equip-cat-head">
                    <span className="cf-pn-equip-cat-name">{g.type_name}</span>
                    <span className="cf-pn-equip-cat-count">{g.values.length}</span>
                  </summary>
                  <ul className="cf-pn-equip-cat-list">
                    {g.values.map((v) => (
                      <li key={v.slug ?? v.name}>{v.name}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </>
        )}
        <PanelInlineCTA
          model={model}
          eyebrow="¿Querés modificar el equipamiento?"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel Sistema Constructivo — solo texto. Si el modelo se ofrece en >1 sistema,
// agrega pills para alternar entre ellos. Texto sale de brand_content.
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_KEY_MAP: Record<string, string> = {
  'WOOD PLUS': 'system_wood',
  'STEEL PLUS': 'system_steel',
  'STONE PLUS': 'system_concrete',
  // Aliases: la DB todavía puede tener "Hormigón Plus" o "Concrete Plus" en
  // SKUs viejos. Todos resuelven al mismo brand_content.system_concrete.
  'HORMIGÓN PLUS': 'system_concrete',
  'HORMIGON PLUS': 'system_concrete',
  'CONCRETE PLUS': 'system_concrete',
}

// Display normalizer: si la DB tiene "Hormigón Plus" / "Concrete Plus", lo
// mostramos como "Stone Plus" (el rebrand vigente).
function displaySC(sc: string): string {
  const u = sc.toUpperCase().trim()
  if (u === 'HORMIGÓN PLUS' || u === 'HORMIGON PLUS' || u === 'CONCRETE PLUS')
    return 'Stone Plus'
  // Title case: "WOOD PLUS" → "Wood Plus".
  return sc
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase())
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel SC en columnas — replica el skin de los SlideLineaCard del HeroRow:
// foto bg + overlay gradient + texto blanco. Una columna por SC presente en
// el modelo. Foto = casa más grande del SC (max area_m2). Texto editorial
// viene de brand_content.system_{wood,steel,concrete}.
// ─────────────────────────────────────────────────────────────────────────────

interface BrandContentForSC extends BrandContentLite {
  subtitle?: string | null
}

// FALLBACK LEGACY — solo se usa si `scContent` está vacío (migración 0019
// aún no aplicada / librería sin filas). Reproduce el comportamiento viejo:
// 3 columnas fijas Steel/Wood/Stone Plus con copy de brand_content y foto
// por línea preferida (Steel→Bosque, Wood→Atlas, Stone→Terra). Cuando hay
// librería, el panel pasa a ser data-driven por la marca del modelo.
const CANONICAL_SCS: {
  sc: string
  key: string
  title: string
  preferredLinea: string
}[] = [
    { sc: 'STEEL PLUS', key: 'system_steel', title: 'Steel Plus', preferredLinea: 'BOSQUE' },
    { sc: 'WOOD PLUS', key: 'system_wood', title: 'Wood Plus', preferredLinea: 'ATLAS' },
    { sc: 'STONE PLUS', key: 'system_concrete', title: 'Stone Plus', preferredLinea: 'TERRA' },
  ]

// Splittea body en primera línea (copy/tagline) + resto. La primera línea
// se promueve a subtítulo estilizado; el resto sigue como body normal.
function splitFirstLine(s: string | null | undefined): {
  lead: string
  rest: string
} {
  if (!s) return { lead: '', rest: '' }
  const trimmed = s.trim()
  const m = trimmed.match(/^([^\n]+)\n+([\s\S]*)$/)
  if (m) return { lead: m[1].trim(), rest: m[2].trim() }
  return { lead: trimmed, rest: '' }
}

export function PanelSCColumns({
  model,
  brandContent,
  scContent = [],
  images,
  activeSkus,
  allModels = [],
}: {
  model: CatalogModel
  brandContent: BrandContentForSC[]
  /** Copy editorial dedicado por SC (global + per-marca). Preferido sobre
   *  brandContent; si no hay fila, cae al legacy. */
  scContent?: ScContentLite[]
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
  /** Todo el catálogo — usado para asignar foto bg por línea preferida
   *  (Steel→Bosque, Wood→Atlas, Stone→Terra). Si está vacío, fallback al
   *  pool de fotos del modelo actual. */
  allModels?: CatalogModel[]
}) {
  // Filtro frente vs contrafrente: descartamos vistas posteriores explícitas
  // (view_label "contrafrente" / "posterior" / "back" / "rear"). Si la foto
  // no tiene view_label, asumimos frente (mayoría de renders del catálogo).
  const isFrontView = (img: CatalogImage): boolean => {
    const v = (img.view_label ?? '').toLowerCase().trim()
    if (!v) return true
    if (/contra|posterior|rear|back|trasera|fondo/.test(v)) return false
    return true
  }
  const hasFrontKeyword = (img: CatalogImage): boolean => {
    const v = (img.view_label ?? '').toLowerCase()
    return /frente|frontal|front|principal/.test(v)
  }

  // Pool de exteriores render del modelo (solo frente), ordenado por
  // preferencia: view_label "frente" explícito primero, después SKUs con
  // floors=2, luego mayor area_m2. Cada columna toma una foto distinta.
  const exteriorRenders = images.filter(
    (i) =>
      i.is_exterior === true &&
      i.image_type === 'render' &&
      isFrontView(i),
  )
  const photoScore = (img: CatalogImage): number => {
    const skus = model.skus.filter((s) => img.sku_ids.includes(s.id))
    const frontBoost = hasFrontKeyword(img) ? 100000 : 0
    if (skus.length === 0) return frontBoost
    const skuBoost = skus.reduce((acc, s) => {
      const floorsBoost = s.floors === 2 ? 10000 : 0
      const area = s.area_m2 ?? 0
      return Math.max(acc, floorsBoost + area)
    }, 0)
    return frontBoost + skuBoost
  }
  const sortedPool = [...exteriorRenders].sort(
    (a, b) => photoScore(b) - photoScore(a),
  )

  // Asignación de foto por línea preferida (Steel→Bosque, Wood→Atlas,
  // Stone→Terra). Tomamos un modelo de esa línea del catálogo global y
  // preferimos la casa más grande de 2 plantas. Devolvemos {cover_url} en
  // un shape compatible con CatalogImage para reusar el render.
  // Shape mínimo compatible con pickFull. `cover_url` ya viene optimizado
  // desde getGroupedCatalog (thumb_url → webp_url → storage_url), así que
  // populamos webp_url con el mismo valor para que pickFull lo retorne.
  type PhotoLike = { storage_url: string; webp_url: string | null }

  const usedUrls = new Set<string>()
  const photoForLinea = (targetLinea: string): PhotoLike | null => {
    const candidates = allModels.filter(
      (m) => m.linea?.toUpperCase().trim() === targetLinea && m.cover_url,
    )
    if (candidates.length === 0) return null
    // Preferimos casas grandes / con 2 plantas (mejor estética en bg).
    const ranked = [...candidates].sort((a, b) => {
      const aTwo = a.skus.some((s) => s.floors === 2) ? 1 : 0
      const bTwo = b.skus.some((s) => s.floors === 2) ? 1 : 0
      if (aTwo !== bTwo) return bTwo - aTwo
      return (b.area_max ?? 0) - (a.area_max ?? 0)
    })
    for (const c of ranked) {
      if (c.cover_url && !usedUrls.has(c.cover_url)) {
        usedUrls.add(c.cover_url)
        return { storage_url: c.cover_url, webp_url: c.cover_url }
      }
    }
    // Todas usadas: tomar la primera igual.
    if (ranked[0]?.cover_url) {
      return { storage_url: ranked[0].cover_url, webp_url: ranked[0].cover_url }
    }
    return null
  }

  // Fallback: pool de fotos del modelo actual (cuando allModels está vacío
  // o no hay casas en la línea preferida).
  const usedIds = new Set<string>()
  const photoFromPool = (): CatalogImage | null => {
    const next = sortedPool.find((img) => !usedIds.has(img.id))
    if (next) {
      usedIds.add(next.id)
      return next
    }
    return sortedPool[0] ?? null
  }

  // ── Librería SC de la marca del modelo ─────────────────────────────
  // Propietarios de la marca del modelo + compartidos (marca_id NULL) no
  // pisados por un propietario del mismo slug. Orden por sort_order.
  const marcaId = model.marca_id
  const proprietary = marcaId
    ? scContent.filter((r) => r.marca_id === marcaId)
    : []
  const proprietarySlugs = new Set(proprietary.map((r) => r.slug))
  const shared = scContent.filter(
    (r) => r.marca_id === null && !proprietarySlugs.has(r.slug),
  )
  const marcaLib = [...proprietary, ...shared].sort(
    (a, b) => a.sort_order - b.sort_order,
  )

  type ScCol = {
    sc: string
    title: string
    bgUrl: string | null
    lead: string
    body: string
  }
  let columns: ScCol[]

  if (marcaLib.length > 0) {
    // Data-driven: una columna por SC de la librería de la marca. tagline
    // vacío → se promueve la 1ra línea del body (compat con formato viejo).
    columns = marcaLib.map((row) => {
      const s = splitFirstLine(row.body)
      const photo = row.hero_image_url ? null : photoFromPool()
      return {
        sc: row.slug,
        title: row.name,
        bgUrl: row.hero_image_url ?? (photo ? pickFull(photo) : null),
        lead: row.tagline?.trim() || s.lead,
        body: row.tagline ? row.body ?? '' : s.rest,
      }
    })
  } else {
    // Fallback legacy: 3 columnas fijas Steel/Wood/Stone Plus desde
    // brand_content + foto por línea preferida (comportamiento pre-0019).
    columns = CANONICAL_SCS.map(({ sc, key, title, preferredLinea }) => {
      const content = brandContent.find((b) => b.key === key) ?? null
      const split = splitFirstLine(content?.body)
      const photo = photoForLinea(preferredLinea) ?? photoFromPool()
      return {
        sc,
        title,
        bgUrl: photo ? pickFull(photo) : null,
        lead: content?.subtitle?.trim() || split.lead,
        body: content?.subtitle ? content.body ?? '' : split.rest,
      }
    })
  }

  if (columns.length === 0) return null

  return (
    <div className="cf-pn cf-pn-sc-cols">
      {columns.map((col) => (
        <div
          key={col.sc}
          className="cf-pn-sc-col"
          style={{
            backgroundImage: col.bgUrl ? `url('${col.bgUrl}')` : undefined,
            backgroundColor: col.bgUrl ? undefined : model.lqip_color,
          }}
        >
          <div className="cf-pn-sc-col-overlay">
            <p className="cf-pn-sc-col-eyebrow">Sistema constructivo</p>
            <h3 className="cf-pn-sc-col-title">{col.title}</h3>
            {col.lead && <p className="cf-pn-sc-col-sub">{col.lead}</p>}
            {col.body && <p className="cf-pn-sc-col-body">{col.body}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

export function PanelSistemaConstructivo({
  model,
  brandContent,
}: {
  model: CatalogModel
  brandContent: BrandContentLite[]
}) {
  const [active, setActive] = useState(0)
  const safeIdx = Math.min(active, model.systems.length - 1)
  const currentSystem = model.systems[safeIdx]
  const key = SYSTEM_KEY_MAP[currentSystem?.toUpperCase().trim() ?? ''] ?? null
  const content = key ? brandContent.find((b) => b.key === key) : null

  return (
    <div className="cf-pn cf-pn-text">
      <div className="cf-pn-text-inner">
        <p className="cf-pn-eyebrow">Sistema constructivo</p>
        <h2 className="cf-pn-title">{content?.title ?? currentSystem ?? '—'}</h2>

        {model.systems.length > 1 && (
          <div className="cf-pn-pills cf-pn-pills-static" style={{ marginTop: 18, marginBottom: 24 }}>
            {model.systems.map((s, i) => (
              <button
                key={s}
                type="button"
                className={`cf-pn-pill ${i === safeIdx ? 'active' : ''}`}
                onClick={() => setActive(i)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {content?.body ? (
          <ScrollableBody>
            <div
              className="cf-richtext cf-pn-richtext"
              dangerouslySetInnerHTML={{ __html: ensureHtml(content.body) }}
            />
          </ScrollableBody>
        ) : (
          <p className="cf-pn-body-empty">Sin descripción cargada para este sistema.</p>
        )}
        <PanelInlineCTA
          model={model}
          eyebrow={`¿Te interesa el sistema ${currentSystem ?? 'constructivo'}?`}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 9 — Datos + Precios + CTA (Ficha Completa)
// ─────────────────────────────────────────────────────────────────────────────

export function Panel9Datos({
  model,
  activeSkus,
}: {
  model: CatalogModel
  activeSkus: CatalogModel['skus']
}) {
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [selectedSystem, setSelectedSystem] = useState(0)

  const uniqueVars = activeSkus.reduce(
    (acc, s) => {
      if (!acc.find((v) => v.variante === s.variante)) acc.push(s)
      return acc
    },
    [] as typeof activeSkus,
  )

  const currentSku =
    activeSkus.find(
      (s) =>
        s.variante === uniqueVars[selectedVariant]?.variante &&
        s.sistema_constructivo === model.systems[selectedSystem],
    ) ?? activeSkus[0] ?? model.skus[0]

  const cotizarHref = buildCotizarMailto({
    modelName: model.display_name,
    variante: uniqueVars[selectedVariant]?.variante,
    sistema: model.systems[selectedSystem],
    linea: displayLinea(model.linea),
  })

  return (
    <div className="cf-pn cf-pn-datos">
      <div className="cf-pn-datos-inner">
        <p className="cf-pn-eyebrow">{model.display_name}</p>
        <h2 className="cf-pn-title">
          Cotizá la variante que se ajusta a vos.
        </h2>
        <p className="cf-pn-datos-lead">
          Elegí superficie, dormitorios y sistema constructivo — te enviamos
          la cotización a tu correo en menos de 24 horas.
        </p>

        <p className="cf-pn-equip-sub">Elegí tu variante</p>
        <div className="cf-pn-datos-vargrid">
          {uniqueVars.map((v, i) => (
            <button
              key={v.variante}
              type="button"
              className={`cf-pn-datos-vcard ${i === selectedVariant ? 'selected' : ''}`}
              onClick={() => setSelectedVariant(i)}
            >
              <p className="cf-pn-variant-name">{variantLabel(v.variante)}</p>
              <p className="cf-pn-variant-meta">
                {v.area_m2 ? `${Math.round(v.area_m2)} m²` : '—'}
                {v.bedrooms_label ? ` · ${v.bedrooms_label} dorm.` : ''}
                {v.floors ? ` · ${v.floors} pl.` : ''}
              </p>
            </button>
          ))}
        </div>

        {model.systems.length > 1 && (
          <>
            <p className="cf-pn-equip-sub" style={{ marginTop: 24 }}>
              Sistema constructivo
            </p>
            <div className="cf-pn-datos-syspills">
              {model.systems.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={`cf-pn-pill ${i === selectedSystem ? 'active' : ''}`}
                  onClick={() => setSelectedSystem(i)}
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        <a
          href={cotizarHref}
          className="cf-pn-datos-cta"
          onClick={(e) => e.stopPropagation()}
        >
          Cotizar →
        </a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Panel "También podría interesarte" — modelos relacionados al que el
// user está viendo. Prioriza:
//   1. Mismo estilo en otra línea/tipología.
//   2. Misma línea pero distinta tipología.
//   3. Cualquier otro modelo del catálogo (fallback).
// Cards clickeables: el click hace scroll al row del modelo en la grilla.
// ─────────────────────────────────────────────────────────────────────────────

function PanelRelated({
  model,
  allModels,
}: {
  model: CatalogModel
  allModels: CatalogModel[]
}) {
  const candidates = allModels.filter((m) => m.group_slug !== model.group_slug)

  // Score: mismo estilo (3) + misma línea otra tipología (2) + nada (0).
  const scored = candidates.map((m) => {
    let score = 0
    if (m.estilo === model.estilo) score += 3
    if (m.linea === model.linea && m.tipologia_code !== model.tipologia_code)
      score += 2
    return { m, score }
  })
  // Top 4: priorizar score alto, después orden alfabético.
  const related = scored
    .sort((a, b) => b.score - a.score || a.m.display_name.localeCompare(b.m.display_name))
    .slice(0, 4)
    .map((s) => s.m)

  if (related.length === 0) return null

  // Mostrar siempre 4 slots: completar con placeholders grises si hay menos
  // candidatos que matcheen. Mantiene la grid balanceada.
  const slots: ((typeof related)[number] | null)[] = [
    ...related,
    ...Array(Math.max(0, 4 - related.length)).fill(null),
  ].slice(0, 4)

  return (
    <div className="cf-pn cf-pn-related">
      <div className="cf-pn-related-inner">
        <div className="cf-pn-related-feature">
          <header className="cf-pn-related-header">
            <p className="cf-pn-eyebrow">Más opciones</p>
            <h3 className="cf-pn-related-title">
              Casas similares a {model.display_name}
            </h3>
          </header>
          <div className="cf-pn-related-grid-wrap">
            <div className="cf-pn-related-grid">
              {slots.map((r, i) =>
                r ? (
                  <a
                    key={r.group_slug}
                    href={`#row-${r.group_slug}`}
                    className="cf-pn-related-card"
                    style={{
                      backgroundImage: r.cover_url
                        ? `url('${r.cover_url}')`
                        : undefined,
                      backgroundColor: r.cover_url ? undefined : r.lqip_color,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      const id = `row-${r.group_slug}`
                      const el = document.getElementById(id)
                      if (!el) return
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      window.setTimeout(() => {
                        document
                          .getElementById(id)
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }, 1300)
                    }}
                  >
                    <div className="cf-pn-related-card-overlay">
                      <span className="cf-pn-related-card-linea">
                        {displayLinea(r.linea)} · {r.estilo}
                      </span>
                      <span className="cf-pn-related-card-name">
                        {r.display_name}
                      </span>
                    </div>
                  </a>
                ) : (
                  <div
                    key={`placeholder-${i}`}
                    className="cf-pn-related-card cf-pn-related-card-placeholder"
                    aria-hidden="true"
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper que orquesta los 9 paneles en orden
// ─────────────────────────────────────────────────────────────────────────────

export default function ExpandedPanels(props: PanelsProps) {
  // Decidimos slide por slide si hay contenido. Sin contenido → no rendereamos.
  const hasExt = hasExterioresImages(props.images)
  const hasInt = hasInterioresImages(props.images)
  const hasPlanos = hasPlanosImages(props.images)
  const hasAxos = hasAxosImages(props.images)

  return (
    <>
      {/* 1. Description — usa el ancho default cf-slide-text. */}
      <div className="cf-station-slide cf-slide-text">
        <Panel1Description
          model={props.model}
          modelContent={props.modelContent}
          activeSkus={props.activeSkus}
          deliveryHtml={props.deliveryConditionsHtml ?? null}
        />
      </div>

      {/* 2. Exteriores — solo si hay fotos */}
      {hasExt && (
        <div className="cf-station-slide cf-slide-image">
          <PanelExteriores
            images={props.images}
            activeSkus={props.activeSkus}
            deliveryHtml={props.deliveryConditionsHtml ?? null}
          />
        </div>
      )}

      {/* 3. Interiores — solo si hay fotos */}
      {hasInt && (
        <div className="cf-station-slide cf-slide-image">
          <PanelInteriores images={props.images} activeSkus={props.activeSkus} />
        </div>
      )}

      {/* 4. Distribución arquitectónica (Tipología) — viene inmediatamente
          después de las fotos interiores: el usuario terminó de ver cómo
          se ve la casa por dentro, ahora le explicamos cómo se organiza. */}
      <div className="cf-station-slide cf-slide-text">
        <Panel3Tipologia model={props.model} lineContent={props.lineContent} />
      </div>

      {/* 5. Perspectivas (image_type='axo') — completa el bloque de
          distribución mostrando la vista axonométrica de los ambientes. */}
      {hasAxos && (
        <div className="cf-station-slide cf-slide-image cf-slide-image-narrow">
          <PanelAxos
            images={props.images}
            activeSkus={props.activeSkus}
            deliveryHtml={props.deliveryConditionsHtml ?? null}
          />
        </div>
      )}

      {/* 6. Estilo (intro de estilos de la línea, solo texto) */}
      <div className="cf-station-slide cf-slide-text cf-slide-text-narrow">
        <PanelEstiloIntro
          model={props.model}
          lineContent={props.lineContent}
          otherStyles={props.otherStyles}
        />
      </div>

      {/* 5. Comparativa de estilos (foto + columna lateral + pills) */}
      <div className="cf-station-slide cf-slide-image">
        <PanelEstilosCompare
          model={props.model}
          otherStyles={props.otherStyles}
          modelContentMap={props.modelContentMap}
        />
      </div>

      {/* 6. Sistema Constructivo en columnas — foto + overlay + texto.
          Una columna por SC presente en el modelo (Steel/Wood/Stone Plus).
          Reemplaza al panel de Sistema Constructivo de texto. */}
      <div className="cf-station-slide cf-slide-image cf-slide-sc-cols">
        <PanelSCColumns
          model={props.model}
          brandContent={props.brandContent}
          scContent={props.scContent}
          images={props.images}
          activeSkus={props.activeSkus}
          allModels={props.allModels}
        />
      </div>

      {/* 7. Comparativo de variantes — tabla + cotización inline. */}
      <div className="cf-station-slide cf-slide-image">
        <Panel7Comparativo
          model={props.model}
          images={props.images}
          activeSkus={props.activeSkus}
          showPrices={props.model.show_prices}
          cotizador={props.cotizador ?? null}
        />
      </div>

      {/* 8. La Casa que Crece — feature único (text + GIF) sin variants. */}
      <div className="cf-station-slide cf-slide-text cf-slide-text-xwide">
        <Panel6CasaQueCrece model={props.model} brandContent={props.brandContent} activeSkus={props.activeSkus} />
      </div>

      {/* 9. Materiales / Equipamiento — solo si el modelo tiene atributos
          cargados. Si está vacío, ocultamos el slide entero. */}
      {props.attributesForCatalogIds.length > 0 && (
        <div className="cf-station-slide cf-slide-text cf-slide-text-wide">
          <Panel8Equipamiento
            model={props.model}
            attributesForCatalogIds={props.attributesForCatalogIds}
          />
        </div>
      )}

      {/* 12. Planos arquitectónicos — solo si hay. Slide medio (75vw). */}
      {hasPlanos && (
        <div className="cf-station-slide cf-slide-image cf-slide-image-medium">
          <PanelPlanos
            images={props.images}
            activeSkus={props.activeSkus}
            deliveryHtml={props.deliveryConditionsHtml ?? null}
          />
        </div>
      )}

      {/* 13. También podría interesarte — modelos relacionados al final. */}
      {props.allModels && props.allModels.length > 1 && (
        <div className="cf-station-slide cf-slide-image">
          <PanelRelated model={props.model} allModels={props.allModels} />
        </div>
      )}
    </>
  )
}
