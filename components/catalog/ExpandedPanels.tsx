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

import { useState } from 'react'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import type { ModelContentRow } from '@/lib/supabase/queries/models'
import type {
  CatalogImage,
  CatalogAttributeRow,
} from '@/lib/supabase/queries/catalog_panels'
import {
  matchImagesForModel,
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
  brandContent: BrandContentLite[]
  lineContent: LineContentLite[]
  attributesForCatalogIds: CatalogAttributeRow[] // todos los attributes de los SKUs del modelo
  otherStyles: CatalogModel[] // otros modelos en misma linea+tipologia
  /** Map para resolver model_content de OTROS modelos (panel comparativa estilos). */
  modelContentMap?: Record<string, ModelContentRow>
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtUSD(n: number | null) {
  if (!n) return '—'
  return 'USD ' + Math.round(n).toLocaleString('es-AR')
}

function paragraphs(s: string | null | undefined): string[] {
  if (!s) return []
  return s
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 1 — Descripción larga
// ─────────────────────────────────────────────────────────────────────────────

export function Panel1Description({
  model,
  modelContent,
}: {
  model: CatalogModel
  modelContent: ModelContentRow | null
}) {
  const tagline = modelContent?.tagline ?? null
  const body = modelContent?.body ?? null
  const estilo = modelContent?.estilo_label ?? model.estilo
  const lifestyleTags = modelContent?.lifestyle_tags ?? []
  const familyMin = modelContent?.family_size_min ?? null
  const familyMax = modelContent?.family_size_max ?? null

  return (
    <div className="cf-pn cf-pn-desc">
      <div className="cf-pn-desc-grid">
        <div className="cf-pn-desc-left">
          <p className="cf-pn-eyebrow">{model.linea} · {estilo}</p>
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
              <p className="cf-pn-stat-num">{model.variantes_count}</p>
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
            paragraphs(body).map((p, i) => (
              <p key={i} className="cf-pn-body-p">
                {p}
              </p>
            ))
          ) : (
            <p className="cf-pn-body-empty">
              Sin descripción cargada todavía.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 2 / 4 — Galería exteriores / interiores
// ─────────────────────────────────────────────────────────────────────────────

export function PanelGallery({
  model,
  images,
  isExterior,
}: {
  model: CatalogModel
  images: CatalogImage[]
  isExterior: boolean
}) {
  // Excluimos planos/axonométricas: viven en su propio panel.
  const filtered = images.filter(
    (img) =>
      Boolean(img.is_exterior) === isExterior &&
      img.image_type !== 'plano',
  )
  const [active, setActive] = useState(0)

  if (filtered.length === 0) {
    return (
      <div className="cf-pn cf-pn-gallery cf-pn-empty">
        <div className="cf-pn-empty-content">
          <p className="cf-pn-eyebrow">{isExterior ? 'Exteriores' : 'Interiores'}</p>
          <h2 className="cf-pn-title">{model.display_name}</h2>
          <p className="cf-pn-body-empty">
            Sin {isExterior ? 'exteriores' : 'interiores'} cargados todavía.
          </p>
        </div>
      </div>
    )
  }

  const safeActive = Math.min(active, filtered.length - 1)
  const current = filtered[safeActive]

  return (
    <div
      className="cf-pn cf-pn-gallery"
      style={{
        backgroundImage: `url('${current.storage_url}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="cf-pn-gallery-overlay">
        <div className="cf-pn-gallery-top">
          <span className="cf-pn-gallery-label">
            {isExterior ? 'Exteriores' : 'Interiores'}
          </span>
        </div>
        <div className="cf-pn-pills">
          {filtered.map((img, i) => (
            <button
              key={img.id}
              type="button"
              className={`cf-pn-pill ${i === safeActive ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              {img.view_label ?? `Foto ${i + 1}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel Planos — planos arquitectónicos + axonometrías
// ─────────────────────────────────────────────────────────────────────────────

export function PanelPlanos({
  model,
  images,
}: {
  model: CatalogModel
  images: CatalogImage[]
}) {
  // Solo imágenes con image_type='plano' (incluye axonometrías por convención).
  // Filtramos también por aplicabilidad al modelo (mismo match que el resto).
  const filtered = images.filter((img) => img.image_type === 'plano')
  const [active, setActive] = useState(0)

  if (filtered.length === 0) {
    return (
      <div className="cf-pn cf-pn-gallery cf-pn-empty">
        <div className="cf-pn-empty-content">
          <p className="cf-pn-eyebrow">Planos</p>
          <h2 className="cf-pn-title">{model.display_name}</h2>
          <p className="cf-pn-body-empty">
            Sin planos cargados todavía.
          </p>
        </div>
      </div>
    )
  }

  const safeActive = Math.min(active, filtered.length - 1)
  const current = filtered[safeActive]

  return (
    <div
      className="cf-pn cf-pn-gallery"
      style={{
        backgroundImage: `url('${current.storage_url}')`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#f7f6f1',
      }}
    >
      <div className="cf-pn-gallery-overlay">
        <div className="cf-pn-gallery-top">
          <span className="cf-pn-gallery-label">Planos</span>
        </div>
        <div className="cf-pn-pills">
          {filtered.map((img, i) => (
            <button
              key={img.id}
              type="button"
              className={`cf-pn-pill ${i === safeActive ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              {img.view_label ?? `Plano ${i + 1}`}
            </button>
          ))}
        </div>
      </div>
    </div>
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
          paragraphs(row.body).map((p, i) => (
            <p key={i} className="cf-pn-body-p">
              {p}
            </p>
          ))
        ) : (
          <p className="cf-pn-body-empty">
            Sin descripción de tipología cargada todavía.
          </p>
        )}
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
        <p className="cf-pn-eyebrow">{model.linea} · Estilos</p>
        <h2 className="cf-pn-title">{intro?.title ?? 'Maneras de habitar'}</h2>
        {intro?.body ? (
          paragraphs(intro.body).map((p, i) => (
            <p key={i} className="cf-pn-body-p">
              {p}
            </p>
          ))
        ) : (
          <p className="cf-pn-body-empty">Sin texto introductorio cargado.</p>
        )}
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
        <p className="cf-pn-eyebrow">{current.linea} · Estilo</p>
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
}: {
  model: CatalogModel
  brandContent: BrandContentLite[]
}) {
  const concept = brandContent.find((b) => b.key === 'concept')
  // Variantes únicas (sin repetir sistema)
  const uniqueVars = model.skus.reduce(
    (acc, s) => {
      if (!acc.find((v) => v.variante === s.variante)) acc.push(s)
      return acc
    },
    [] as typeof model.skus,
  )

  return (
    <div className="cf-pn cf-pn-crece">
      <div className="cf-pn-crece-grid">
        <div className="cf-pn-crece-text">
          <p className="cf-pn-eyebrow">Concepto</p>
          <h2 className="cf-pn-title">{concept?.title ?? 'La Casa que Crece'}</h2>
          {concept?.body ? (
            paragraphs(concept.body).map((p, i) => (
              <p key={i} className="cf-pn-body-p">
                {p}
              </p>
            ))
          ) : (
            <p className="cf-pn-body-empty">Sin texto cargado.</p>
          )}
        </div>

        <div className="cf-pn-crece-variants">
          <p className="cf-pn-eyebrow">Variantes de {model.display_name}</p>
          <div className="cf-pn-variants-list">
            {uniqueVars.map((v) => (
              <div key={v.variante} className="cf-pn-variant-card">
                <div className="cf-pn-variant-head">
                  <span className="cf-pn-variant-name">V{v.variante}</span>
                  <span className="cf-pn-variant-floors">
                    {v.floors ? `${v.floors} planta${v.floors > 1 ? 's' : ''}` : '—'}
                  </span>
                </div>
                <div className="cf-pn-variant-meta">
                  <span>{v.area_m2 ? `${Math.round(v.area_m2)} m²` : '—'}</span>
                  {v.bedrooms_label && <span>· {v.bedrooms_label} dorm.</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 7 — Comparativo (pills, sin drag)
// ─────────────────────────────────────────────────────────────────────────────

export function Panel7Comparativo({
  model,
  images,
}: {
  model: CatalogModel
  images: CatalogImage[]
}) {
  const uniqueVars = model.skus.reduce(
    (acc, s) => {
      if (!acc.find((v) => v.variante === s.variante)) acc.push(s)
      return acc
    },
    [] as typeof model.skus,
  )
  const [active, setActive] = useState(0)
  const currentVar = uniqueVars[active] ?? uniqueVars[0]

  // Para cada variante, busca la imagen más específica.
  const variantImages = uniqueVars.map((v) => {
    const matched = matchImagesForModel(images, {
      linea: model.linea,
      tipologia_code: model.tipologia_code,
      style_name: model.style_name,
      variante: v.variante,
    })
    return matched[0] ?? null
  })
  const currentImg = variantImages[active] ?? null

  return (
    <div
      className="cf-pn cf-pn-compare"
      style={{
        backgroundImage: currentImg?.storage_url
          ? `url('${currentImg.storage_url}')`
          : undefined,
        backgroundColor: currentImg?.storage_url ? undefined : model.lqip_color,
      }}
    >
      <div className="cf-pn-compare-overlay">
        <div className="cf-pn-compare-top">
          <p className="cf-pn-eyebrow">Comparativo</p>
          <h2 className="cf-pn-compare-title">{model.display_name}</h2>
        </div>

        <div className="cf-pn-compare-data">
          {currentVar && (
            <>
              <div className="cf-pn-compare-stat">
                <span className="cf-pn-stat-lbl">Superficie</span>
                <span className="cf-pn-stat-num">
                  {currentVar.area_m2 ? `${Math.round(currentVar.area_m2)} m²` : '—'}
                </span>
              </div>
              <div className="cf-pn-compare-stat">
                <span className="cf-pn-stat-lbl">Plantas</span>
                <span className="cf-pn-stat-num">
                  {currentVar.floors ?? '—'}
                </span>
              </div>
              <div className="cf-pn-compare-stat">
                <span className="cf-pn-stat-lbl">Dormitorios</span>
                <span className="cf-pn-stat-num">
                  {currentVar.bedrooms_label ?? '—'}
                </span>
              </div>
              <div className="cf-pn-compare-stat">
                <span className="cf-pn-stat-lbl">Desde</span>
                <span className="cf-pn-stat-num">
                  {fmtUSD(currentVar.precio_lista_usd)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="cf-pn-pills">
          {uniqueVars.map((v, i) => (
            <button
              key={v.variante}
              type="button"
              className={`cf-pn-pill ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              Variante {v.variante}
            </button>
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
          paragraphs(content.body).map((p, i) => (
            <p key={i} className="cf-pn-body-p">
              {p}
            </p>
          ))
        ) : (
          <p className="cf-pn-body-empty">Sin descripción cargada para este sistema.</p>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel 9 — Datos + Precios + CTA (Ficha Completa)
// ─────────────────────────────────────────────────────────────────────────────

export function Panel9Datos({ model }: { model: CatalogModel }) {
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [selectedSystem, setSelectedSystem] = useState(0)

  const uniqueVars = model.skus.reduce(
    (acc, s) => {
      if (!acc.find((v) => v.variante === s.variante)) acc.push(s)
      return acc
    },
    [] as typeof model.skus,
  )

  const currentSku =
    model.skus.find(
      (s) =>
        s.variante === uniqueVars[selectedVariant]?.variante &&
        s.sistema_constructivo === model.systems[selectedSystem],
    ) ?? model.skus[0]

  const wapText = encodeURIComponent(
    `Hola, me interesa el modelo ${model.display_name} (variante ${
      uniqueVars[selectedVariant]?.variante
    }, sistema ${model.systems[selectedSystem]}). ¿Podría obtener más información?`,
  )
  const wapNumber = '5491155551234'

  return (
    <div className="cf-pn cf-pn-datos">
      <div className="cf-pn-datos-inner">
        <p className="cf-pn-eyebrow">Datos & precio</p>
        <h2 className="cf-pn-title">{model.display_name}</h2>

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

        {currentSku && (
          <>
            <p className="cf-pn-equip-sub" style={{ marginTop: 24 }}>
              Precio estimado
            </p>
            <div className="cf-pn-datos-prices">
              <div className="cf-pn-datos-price">
                <span>Lista</span>
                <span>{fmtUSD(currentSku.precio_lista_usd)}</span>
              </div>
              <div className="cf-pn-datos-price">
                <span>Contado</span>
                <span>{fmtUSD(currentSku.precio_contado_usd)}</span>
              </div>
              <div className="cf-pn-datos-price cf-pn-datos-price-feat">
                <span>Al pozo</span>
                <span>{fmtUSD(currentSku.precio_pozo_usd)}</span>
              </div>
            </div>
          </>
        )}

        <a
          href={`https://wa.me/${wapNumber}?text=${wapText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="cf-pn-datos-cta"
          onClick={(e) => e.stopPropagation()}
        >
          Consultar por WhatsApp →
        </a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper que orquesta los 9 paneles en orden
// ─────────────────────────────────────────────────────────────────────────────

export default function ExpandedPanels(props: PanelsProps) {
  // Si la línea no tiene planos cargados (ej. ATLAS hoy), saltamos el slide.
  const hasPlanos = props.images.some((img) => img.image_type === 'plano')

  return (
    <>
      {/* 1. Description */}
      <div className="cf-station-slide cf-slide-text">
        <Panel1Description model={props.model} modelContent={props.modelContent} />
      </div>

      {/* 2. Exteriores */}
      <div className="cf-station-slide cf-slide-image">
        <PanelGallery model={props.model} images={props.images} isExterior={true} />
      </div>

      {/* 3. Interiores */}
      <div className="cf-station-slide cf-slide-image">
        <PanelGallery model={props.model} images={props.images} isExterior={false} />
      </div>

      {/* 4. Estilo (intro de estilos de la línea, solo texto) */}
      <div className="cf-station-slide cf-slide-text">
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

      {/* 7. Planos / Axonometrías — solo si hay imágenes cargadas */}
      {hasPlanos && (
        <div className="cf-station-slide cf-slide-image">
          <PanelPlanos model={props.model} images={props.images} />
        </div>
      )}

      {/* 8. La Casa que Crece (concept) */}
      <div className="cf-station-slide cf-slide-text cf-slide-text-wide">
        <Panel6CasaQueCrece model={props.model} brandContent={props.brandContent} />
      </div>

      {/* 9. Comparativo de variantes (V1 / V2) */}
      <div className="cf-station-slide cf-slide-image">
        <Panel7Comparativo model={props.model} images={props.images} />
      </div>

      {/* 10. Ficha Completa (datos + precios + WhatsApp CTA) */}
      <div className="cf-station-slide cf-slide-text">
        <Panel9Datos model={props.model} />
      </div>

      {/* 11. Sistema Constructivo */}
      <div className="cf-station-slide cf-slide-text">
        <PanelSistemaConstructivo model={props.model} brandContent={props.brandContent} />
      </div>

      {/* 12. Equipamiento */}
      <div className="cf-station-slide cf-slide-text cf-slide-text-wide">
        <Panel8Equipamiento
          model={props.model}
          attributesForCatalogIds={props.attributesForCatalogIds}
        />
      </div>
    </>
  )
}
