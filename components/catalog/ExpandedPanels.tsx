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
import type {
  CatalogImage,
  CatalogAttributeRow,
} from '@/lib/supabase/queries/catalog_panels'
import {
  imagesForSkus,
  groupAttributesByType,
} from '@/lib/supabase/queries/catalog_panels'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

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

interface PanelsProps {
  model: CatalogModel
  modelContent: ModelContentRow | null
  images: CatalogImage[]
  /** SKUs filtrados por bed/size; los paneles que muestren variantes deben
   *  iterar acá en lugar de model.skus para no salir del filtro del usuario. */
  activeSkus: CatalogModel['skus']
  brandContent: BrandContentLite[]
  lineContent: LineContentLite[]
  attributesForCatalogIds: CatalogAttributeRow[] // todos los attributes de los SKUs del modelo
  otherStyles: CatalogModel[] // otros modelos en misma linea+tipologia
  /** Map para resolver model_content de OTROS modelos (panel comparativa estilos). */
  modelContentMap?: Record<string, ModelContentRow>
  /** Catálogo completo — usado por el panel "También podría interesarte"
   *  para sugerir modelos relacionados de OTRAS líneas/tipologías. */
  allModels?: CatalogModel[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function paragraphs(s: string | null | undefined): string[] {
  if (!s) return []
  return s
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
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
        {/* "Hablar con un asesor" oculto temporalmente — vuelve cuando llegue
            Ximia. Cuando reaparezca, restaurar el bloque con
            href={buildAsesorMailto({ linea: model.linea })}. */}
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
}: {
  model: CatalogModel
  modelContent: ModelContentRow | null
  activeSkus: CatalogModel['skus']
}) {
  const tagline = modelContent?.tagline ?? null
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

  return (
    <div className="cf-pn cf-pn-desc">
      <div className="cf-pn-desc-grid">
        <div className="cf-pn-desc-left">
          <p className="cf-pn-eyebrow">{displayLinea(model.linea)} · {estilo}</p>
          <h2 className="cf-pn-title">{model.display_name}</h2>
          {tagline && <p className="cf-pn-tagline">{tagline}</p>}

          <div className="cf-pn-stats">
            <div>
              <p className="cf-pn-stat-num">
                {model.area_min && model.area_max
                  ? `${Math.round(model.area_min)}–${Math.round(model.area_max)}`
                  : '—'}
              </p>
              <p className="cf-pn-stat-lbl">m² superficie</p>
            </div>
            <div>
              <p className="cf-pn-stat-num">
                {model.beds_min && model.beds_max
                  ? `${model.beds_min}–${model.beds_max}`
                  : model.beds_min ?? '—'}
              </p>
              <p className="cf-pn-stat-lbl">dormitorios</p>
            </div>
            <div>
              <p className="cf-pn-stat-num">{filteredVariantesCount}</p>
              <p className="cf-pn-stat-lbl">variantes</p>
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
              {paragraphs(body).map((p, i) => (
                <p key={i} className="cf-pn-body-p">
                  {p}
                </p>
              ))}
            </ScrollableBody>
          ) : (
            <p className="cf-pn-body-empty">
              Sin descripción cargada todavía.
            </p>
          )}
          <PanelInlineCTA
            model={model}
            eyebrow="¿Te interesa este modelo?"
          />
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
  pillFallback,
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
  label: string
  bgSize?: 'cover' | 'contain'
  pillFallback: (i: number) => string
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
            <span className="cf-pn-gallery-label">{label}</span>
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
                  V{v}
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
              backgroundImage: `url('${current.storage_url}')`,
              backgroundSize: bgSize,
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
          <span className="cf-pn-gallery-label">{label}</span>
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
                V{v}
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
              {img.view_label ?? pillFallback(i)}
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
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
}) {
  return (
    <PanelImageSlider
      images={images.filter(isExteriorRender)}
      activeSkus={activeSkus}
      label="Exteriores"
      bgSize="cover"
      pillFallback={(i) => `Foto ${i + 1}`}
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
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
}) {
  return (
    <PanelImageSlider
      images={images.filter(isPlano)}
      activeSkus={activeSkus}
      label="Planos"
      bgSize="contain"
      pillFallback={(i) => `Plano ${i + 1}`}
    />
  )
}

export function PanelAxos({
  images,
  activeSkus,
}: {
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
}) {
  return (
    <PanelImageSlider
      images={images.filter(isAxo)}
      activeSkus={activeSkus}
      label="Axonometrías"
      bgSize="contain"
      pillFallback={(i) => `Vista ${i + 1}`}
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
        <p className="cf-pn-eyebrow">Tipología {model.tipologia_code}</p>
        <h2 className="cf-pn-title">{row?.subtitle ?? 'Distribución arquitectónica'}</h2>
        {row?.body ? (
          <ScrollableBody>
            {paragraphs(row.body).map((p, i) => (
              <p key={i} className="cf-pn-body-p">
                {p}
              </p>
            ))}
          </ScrollableBody>
        ) : (
          <p className="cf-pn-body-empty">
            Sin descripción de tipología cargada todavía.
          </p>
        )}
        <PanelInlineCTA
          model={model}
          eyebrow="¿Te gusta esta tipología?"
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
}: {
  model: CatalogModel
  lineContent: LineContentLite[]
}) {
  const intro = lineContent.find(
    (lc) => lc.linea === model.linea && lc.tipologia_code === 'estilos_intro',
  )

  return (
    <div className="cf-pn cf-pn-text">
      <div className="cf-pn-text-inner">
        <p className="cf-pn-eyebrow">{displayLinea(model.linea)} · Estilos</p>
        <h2 className="cf-pn-title">{intro?.title ?? 'Maneras de habitar'}</h2>
        {intro?.body ? (
          <ScrollableBody>
            {paragraphs(intro.body).map((p, i) => (
              <p key={i} className="cf-pn-body-p">
                {p}
              </p>
            ))}
          </ScrollableBody>
        ) : (
          <p className="cf-pn-body-empty">Sin texto introductorio cargado.</p>
        )}
        <PanelInlineCTA
          model={model}
          eyebrow="¿Querés ver los estilos disponibles?"
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
            paragraphs(currentContent.body).map((p, i) => (
              <p key={i} className="cf-pn-body-p">
                {p}
              </p>
            ))
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
                {paragraphs(concept.body).map((p, i) => (
                  <p key={i} className="cf-pn-body-p">
                    {p}
                  </p>
                ))}
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

export function Panel7Comparativo({
  model,
  images,
  activeSkus,
}: {
  model: CatalogModel
  images: CatalogImage[]
  activeSkus: CatalogModel['skus']
}) {
  // Si el usuario filtró por bed/size, activeSkus viene reducido. Sino es model.skus.
  const uniqueVars = activeSkus.reduce(
    (acc, s) => {
      if (!acc.find((v) => v.variante === s.variante)) acc.push(s)
      return acc
    },
    [] as typeof activeSkus,
  )

  // Filas a comparar. Cada una extrae el valor de una variante + un
  // formatter para mostrarlo. El campo `key` se usa para detectar si
  // todas las variantes tienen el mismo valor (en cuyo caso la fila es
  // "homogénea" y no destacamos las celdas).
  // Atributos a comparar — se renderean como COLUMNAS (header arriba)
  // y cada VARIANTE es una fila. Sistema constructivo no se incluye:
  // todas las variantes ofrecen los mismos sistemas, no aporta.
  const cols: {
    key: string
    label: string
    get: (v: CatalogModel['skus'][number]) => string
  }[] = [
    {
      key: 'area',
      label: 'Sup.',
      get: (v) => (v.area_m2 ? `${Math.round(v.area_m2)} m²` : '—'),
    },
    {
      key: 'floors',
      label: 'Plantas',
      get: (v) => (v.floors ? String(v.floors) : '—'),
    },
    {
      key: 'beds',
      label: 'Dorm.',
      get: (v) => v.bedrooms_label ?? '—',
    },
    {
      key: 'baths',
      label: 'Baños',
      get: (v) => (v.bathrooms != null ? String(v.bathrooms) : '—'),
    },
    {
      key: 'toilette',
      label: 'Toilette',
      get: (v) => (v.toilette ? '✓' : '—'),
    },
    {
      key: 'parrilla',
      label: 'Parrilla',
      get: (v) => (v.parrilla ? '✓' : '—'),
    },
  ]

  // Foto representativa: preferimos la variante más "grande" (mayor
  // superficie). Dentro de esa, preferimos floors=2 si existe (queda
  // mejor visualmente en el bg). Si no hay foto linkeada al SKU,
  // caemos a cualquier exterior render del modelo.
  const sortedByArea = [...uniqueVars].sort(
    (a, b) => (b.area_m2 ?? 0) - (a.area_m2 ?? 0),
  )
  const preferred =
    sortedByArea.find((v) => v.floors === 2) ?? sortedByArea[0]

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
      className="cf-pn cf-pn-compare"
      style={{
        backgroundImage: heroImg
          ? `url('${heroImg.storage_url}')`
          : undefined,
        backgroundColor: heroImg ? undefined : model.lqip_color,
      }}
    >
      <div className="cf-pn-compare-overlay">
        <header className="cf-pn-compare-header">
          <p className="cf-pn-eyebrow">Comparativo</p>
          <h3 className="cf-pn-compare-sub">
            {uniqueVars.length} variante{uniqueVars.length !== 1 ? 's' : ''} disponible
            {uniqueVars.length !== 1 ? 's' : ''} — diferencias clave
          </h3>
        </header>

        <div
          className="cf-pn-compare-table"
          style={{
            // 1ra col para etiqueta de variante (V1/V2/...) + N cols con
            // los atributos (Sup., Plantas, Dorm., Baños, Toilette, Parrilla).
            gridTemplateColumns: `auto repeat(${cols.length}, minmax(80px, 1fr))`,
          }}
        >
          {/* Header row: corner vacío + label de cada atributo. */}
          <div className="cf-pn-compare-corner" />
          {cols.map((c) => (
            <div key={`th-${c.key}`} className="cf-pn-compare-th">
              {c.label}
            </div>
          ))}

          {/* Una fila por variante: V<x> + valores. */}
          {uniqueVars.map((v) => (
            <Fragment key={`row-${v.variante}`}>
              <div className="cf-pn-compare-row-lbl">V{v.variante}</div>
              {cols.map((c) => (
                <div key={`${v.variante}-${c.key}`} className="cf-pn-compare-cell">
                  {c.get(v)}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
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
  'HORMIGÓN PLUS': 'system_concrete',
  'HORMIGON PLUS': 'system_concrete',
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
            {paragraphs(content.body).map((p, i) => (
              <p key={i} className="cf-pn-body-p">
                {p}
              </p>
            ))}
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
              <p className="cf-pn-variant-name">V{v.variante}</p>
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

  return (
    <div className="cf-pn cf-pn-related">
      <div className="cf-pn-related-inner">
        <header className="cf-pn-related-header">
          <p className="cf-pn-eyebrow">Más opciones</p>
          <h3 className="cf-pn-related-title">
            Tu misma búsqueda en otros estilos
          </h3>
        </header>
        <div className="cf-pn-related-grid">
          {related.map((r) => (
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
                // Doble scroll: el primero inmediato y el segundo
                // después de que el row actualmente expandido se
                // colapse y el listado se reacomode (el RAF de focus
                // physics tarda ~600-1000ms en cerrar el row al
                // perder el centro). Sin el segundo scroll, el target
                // queda fuera del viewport hacia arriba.
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
          ))}
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
        />
      </div>

      {/* 2. Exteriores — solo si hay fotos */}
      {hasExt && (
        <div className="cf-station-slide cf-slide-image">
          <PanelExteriores images={props.images} activeSkus={props.activeSkus} />
        </div>
      )}

      {/* 3. Interiores — solo si hay fotos */}
      {hasInt && (
        <div className="cf-station-slide cf-slide-image">
          <PanelInteriores images={props.images} activeSkus={props.activeSkus} />
        </div>
      )}

      {/* 4. Estilo (intro de estilos de la línea, solo texto) */}
      <div className="cf-station-slide cf-slide-text cf-slide-text-narrow">
        <PanelEstiloIntro model={props.model} lineContent={props.lineContent} />
      </div>

      {/* 5. Comparativa de estilos (foto + columna lateral + pills) */}
      <div className="cf-station-slide cf-slide-image">
        <PanelEstilosCompare
          model={props.model}
          otherStyles={props.otherStyles}
          modelContentMap={props.modelContentMap}
        />
      </div>

      {/* 6. Tipología arquitectónica */}
      <div className="cf-station-slide cf-slide-text">
        <Panel3Tipologia model={props.model} lineContent={props.lineContent} />
      </div>

      {/* 7. Planos arquitectónicos — solo si hay. Slide medio (75vw)
          para que se lean cómodos. */}
      {hasPlanos && (
        <div className="cf-station-slide cf-slide-image cf-slide-image-medium">
          <PanelPlanos images={props.images} activeSkus={props.activeSkus} />
        </div>
      )}

      {/* 8. Axonometrías — solo si hay. Slide angosto con bg blanco. */}
      {hasAxos && (
        <div className="cf-station-slide cf-slide-image cf-slide-image-narrow">
          <PanelAxos images={props.images} activeSkus={props.activeSkus} />
        </div>
      )}

      {/* 9. Comparativo de variantes — bg foto + tabla. Va acá (después
          de planos/axos) para romper la secuencia de bloques blancos
          consecutivos con un slide de foto. */}
      <div className="cf-station-slide cf-slide-image">
        <Panel7Comparativo model={props.model} images={props.images} activeSkus={props.activeSkus} />
      </div>

      {/* 10. La Casa que Crece — feature único (text + GIF) sin variants. */}
      <div className="cf-station-slide cf-slide-text cf-slide-text-xwide">
        <Panel6CasaQueCrece model={props.model} brandContent={props.brandContent} activeSkus={props.activeSkus} />
      </div>

      {/* 10. Ficha Completa (datos + precios + WhatsApp CTA) */}
      <div className="cf-station-slide cf-slide-text">
        <Panel9Datos model={props.model} activeSkus={props.activeSkus} />
      </div>

      {/* 11. Sistema Constructivo */}
      <div className="cf-station-slide cf-slide-text">
        <PanelSistemaConstructivo model={props.model} brandContent={props.brandContent} />
      </div>

      {/* 12. Equipamiento — solo se muestra si el modelo tiene atributos
          cargados. Si está vacío, ocultamos el slide entero (no tiene
          sentido mostrar "sin equipamiento configurado"). */}
      {props.attributesForCatalogIds.length > 0 && (
        <div className="cf-station-slide cf-slide-text cf-slide-text-wide">
          <Panel8Equipamiento
            model={props.model}
            attributesForCatalogIds={props.attributesForCatalogIds}
          />
        </div>
      )}

      {/* 13. También podría interesarte — modelos relacionados al final
          del expandido. Da una salida lateral al usuario que está en
          deep dive sin cerrarle el detalle actual. */}
      {props.allModels && props.allModels.length > 1 && (
        <div className="cf-station-slide cf-slide-image">
          <PanelRelated model={props.model} allModels={props.allModels} />
        </div>
      )}
    </>
  )
}
