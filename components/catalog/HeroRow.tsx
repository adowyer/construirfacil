'use client'

/**
 * components/catalog/HeroRow.tsx
 *
 * Primera fila del catálogo: track horizontal de slides al tamaño de las
 * fotos colapsadas (420px alto × ~672px ancho, aspect-ratio 16/10).
 *
 * El primer slide es el "intro" (texto editorial: Tres líneas, tres mundos)
 * y se desplaza junto con los demás. Después vienen:
 *   - Una card por línea (Atlas, Bosque, Terra) con foto y datos.
 *   - Una card por tipología.
 *   - Una card por sistema constructivo.
 *   - Slide concepto al final.
 *
 * Sin toggle: ya nace expandida. Sin lógica de cierre.
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type { BrandContent, LineContent } from './HeroSlider'
import type { LineaRow } from '@/lib/supabase/queries/lineas'

/** Par de imágenes de un modelo en sus variantes 1 planta / 2 plantas. */
export interface GrowthPair {
  name: string
  img1: string
  img2: string
}

interface HeroRowProps {
  brandContent?: BrandContent[]
  lineContent?: LineContent[]
  lineas?: LineaRow[]
  /** Map name de línea → URL de imagen para usar de fondo del slide.
      Permite usar la primera cover_url de un modelo de la línea cuando
      `lineas.hero_image_url` está vacío. */
  lineaCoverByName?: Record<string, string | null>
  /** Pares (1 planta / 2 plantas) por modelo. Se ciclan en loop dentro
      del slide concepto para mostrar visualmente cómo "crece" la casa. */
  growthPairs?: GrowthPair[]
}

type Slide =
  | { kind: 'intro' }
  | { kind: 'linea'; linea: LineaRow }
  | { kind: 'tipologia'; tip: LineContent }
  | { kind: 'sistema'; system: BrandContent }
  | { kind: 'concepto'; concept: BrandContent }

function buildSlides(
  brandContent: BrandContent[],
  lineContent: LineContent[],
  lineas: LineaRow[],
): Slide[] {
  const byKey = (key: string) => brandContent.find((b) => b.key === key)

  // Tipologías: primeras 3 distintas (excluyendo intros de estilos).
  const tipologias = lineContent
    .filter((l) => l.tipologia_code && l.tipologia_code !== 'estilos_intro')
    .reduce((acc, l) => {
      if (!acc.find((x) => x.tipologia_code === l.tipologia_code)) acc.push(l)
      return acc
    }, [] as LineContent[])
    .slice(0, 3)

  const systems = [
    byKey('system_wood'),
    byKey('system_steel'),
    byKey('system_concrete'),
  ].filter(Boolean) as BrandContent[]
  const concept = byKey('concept')

  // Orden: intro → líneas → CONCEPTO (centro de la tira) → tipologías → sistemas.
  // El slide concepto queda visualmente al medio para que sirva de "ancla":
  // arrancamos centrados en él y se ven peeks a izquierda y derecha.
  const slides: Slide[] = [{ kind: 'intro' }]
  for (const l of lineas) slides.push({ kind: 'linea', linea: l })
  if (concept) slides.push({ kind: 'concepto', concept })
  for (const t of tipologias) slides.push({ kind: 'tipologia', tip: t })
  for (const s of systems) slides.push({ kind: 'sistema', system: s })

  return slides
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide content renderers
// ─────────────────────────────────────────────────────────────────────────────

function SlideIntro() {
  return (
    <div className="cf-hero-slide-card cf-hero-slide-intro">
      <p className="cf-pn-eyebrow">Tres líneas, tres mundos</p>
      <h2 className="cf-hero-slide-title">
        Encontrá la línea que mejor se adapta a vos
      </h2>
      <p className="cf-hero-slide-body">
        De casas premium a soluciones modulares. Cada línea responde a un
        estilo de vida diferente.
      </p>
    </div>
  )
}

function SlideLinea({
  linea,
  coverUrl,
}: {
  linea: LineaRow
  coverUrl: string | null
}) {
  const bg = linea.hero_image_url ?? coverUrl
  return (
    <div
      className="cf-hero-slide-card cf-hero-slide-linea"
      style={{
        backgroundImage: bg
          ? `linear-gradient(rgba(0,0,0,0.18), rgba(0,0,0,0.62)), url('${bg}')`
          : undefined,
        backgroundColor: bg ? undefined : '#1a1a1a',
      }}
    >
      <div className="cf-hero-slide-linea-content">
        {linea.icon_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={linea.icon_url} alt="" className="cf-hero-slide-linea-icon" />
        )}
        <p className="cf-hero-slide-linea-eyebrow">Línea</p>
        <h3 className="cf-hero-slide-linea-name">
          {linea.name ? linea.name[0].toUpperCase() + linea.name.slice(1).toLowerCase() : ''}
        </h3>
        {linea.tagline && (
          <p className="cf-hero-slide-linea-tagline">{linea.tagline}</p>
        )}
      </div>
    </div>
  )
}

function SlideTipologia({ tip }: { tip: LineContent }) {
  // Body puede tener varios párrafos: tomamos los primeros para que entre
  // dentro del slide. El detalle completo vive en el panel del modelo.
  const bodyShort = tip.body ? tip.body.split(/\n{2,}/)[0]?.trim() : null
  return (
    <div className="cf-hero-slide-card cf-hero-slide-tipologia">
      <p className="cf-pn-eyebrow">Tipología</p>
      <p className="cf-hero-slide-tip-code">{tip.tipologia_code}</p>
      {tip.title && <h3 className="cf-hero-slide-tip-title">{tip.title}</h3>}
      {tip.subtitle && <p className="cf-hero-slide-tip-sub">{tip.subtitle}</p>}
      {bodyShort && <p className="cf-hero-slide-tip-body">{bodyShort}</p>}
    </div>
  )
}

function SlideSistema({ system }: { system: BrandContent }) {
  return (
    <div className="cf-hero-slide-card cf-hero-slide-sistema">
      <p className="cf-pn-eyebrow">Sistema constructivo</p>
      <h3 className="cf-hero-slide-sys-name">{system.title ?? system.label}</h3>
      {system.subtitle && (
        <p className="cf-hero-slide-sys-sub">{system.subtitle}</p>
      )}
    </div>
  )
}

/**
 * Loop visual con fotos reales: alterna entre la versión 1 planta y la
 * versión 2 plantas de modelos hermanos (Alecrín I / Alecrín II, etc.).
 *
 * - Crossfade entre img1 (1 planta) e img2 (2 plantas), 3s cada estado.
 * - Cuando termina un ciclo completo, rota al siguiente par de modelo.
 * - Si solo hay 1 par, hace el crossfade infinito sobre ese par.
 * - Si no hay pares (línea sin variantes 1↔2), no muestra nada.
 */
function HouseGrowAnim({ pairs }: { pairs: GrowthPair[] }) {
  const [pairIdx, setPairIdx] = useState(0)
  // Track de cuál capa está activa (img1 visible vs img2 visible). Se
  // alterna cada CYCLE_MS para crear el crossfade.
  const [showSecond, setShowSecond] = useState(false)

  const CYCLE_MS = 3000 // tiempo de cada estado (1p o 2p) visible.

  // Tick: alterna entre 1 planta y 2 plantas. Al terminar un ciclo completo
  // (vuelve a 1 planta tras estar en 2), rota al siguiente par.
  useEffect(() => {
    if (pairs.length === 0) return
    const id = setInterval(() => {
      setShowSecond((prev) => {
        if (prev) {
          // Estábamos en 2 plantas → volvemos a 1 planta y rotamos.
          if (pairs.length > 1) {
            setPairIdx((i) => (i + 1) % pairs.length)
          }
          return false
        }
        return true
      })
    }, CYCLE_MS)
    return () => clearInterval(id)
  }, [pairs.length])

  if (pairs.length === 0) return null
  const safeIdx = Math.min(pairIdx, pairs.length - 1)
  const pair = pairs[safeIdx]

  return (
    <div className="cf-grow-stage">
      {/* Capa de fondo: 2 plantas (siempre montada) */}
      <div
        className="cf-grow-img cf-grow-img-2"
        style={{ backgroundImage: `url('${pair.img2}')` }}
      />
      {/* Capa de frente: 1 planta — se desvanece para revelar las 2 plantas */}
      <div
        className={`cf-grow-img cf-grow-img-1 ${showSecond ? 'cf-grow-hide' : ''}`}
        style={{ backgroundImage: `url('${pair.img1}')` }}
      />
      <div className="cf-grow-cap">
        {pair.name} · {showSecond ? '2 plantas' : '1 planta'}
      </div>
    </div>
  )
}

function SlideConcepto({
  concept,
  growthPairs = [],
}: {
  concept: BrandContent
  growthPairs?: GrowthPair[]
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [, setOpen] = useState(false)

  // Body completo para la modal; primer párrafo recortado para el slide.
  const allParagraphs = concept.body
    ? concept.body
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
    : []
  const teaser = allParagraphs[0] ?? null

  const openModal = () => {
    dialogRef.current?.showModal()
    setOpen(true)
  }
  const closeModal = () => {
    dialogRef.current?.close()
    setOpen(false)
  }

  return (
    <>
      <div className="cf-hero-slide-card cf-hero-slide-concepto">
        <div className="cf-hero-slide-concepto-grid">
          <div className="cf-hero-slide-concepto-text">
            <p className="cf-pn-eyebrow">Concepto</p>
            <h3 className="cf-hero-slide-title">
              {concept.title ?? concept.label}
            </h3>
            {concept.subtitle && (
              <p className="cf-hero-slide-concepto-sub">{concept.subtitle}</p>
            )}
            {teaser && (
              <p className="cf-hero-slide-concepto-p">{teaser}</p>
            )}
            <button
              type="button"
              className="cf-hero-slide-concepto-more"
              onClick={openModal}
            >
              Ver más →
            </button>
          </div>
          <div className="cf-hero-slide-concepto-anim">
            <HouseGrowAnim pairs={growthPairs} />
          </div>
        </div>
      </div>

      {/* Modal con texto completo + animación a mayor tamaño */}
      <dialog
        ref={dialogRef}
        className="cf-concepto-modal"
        onClick={(e) => {
          // Click sobre el backdrop (no el contenido) cierra.
          if (e.target === dialogRef.current) closeModal()
        }}
        onClose={() => setOpen(false)}
      >
        <div className="cf-concepto-modal-inner">
          <button
            type="button"
            className="cf-concepto-modal-close"
            onClick={closeModal}
            aria-label="Cerrar"
          >
            ×
          </button>
          <div className="cf-concepto-modal-grid">
            <div className="cf-concepto-modal-text">
              <p className="cf-pn-eyebrow">Concepto</p>
              <h2 className="cf-concepto-modal-title">
                {concept.title ?? concept.label}
              </h2>
              {concept.subtitle && (
                <p className="cf-concepto-modal-sub">{concept.subtitle}</p>
              )}
              <div className="cf-concepto-modal-body">
                {allParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
            <div className="cf-concepto-modal-anim">
              <HouseGrowAnim pairs={growthPairs} />
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function HeroRow({
  brandContent = [],
  lineContent = [],
  lineas = [],
  lineaCoverByName = {},
  growthPairs = [],
}: HeroRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const slides = useMemo(
    () => buildSlides(brandContent, lineContent, lineas),
    [brandContent, lineContent, lineas],
  )
  const conceptIdx = useMemo(
    () => slides.findIndex((s) => s.kind === 'concepto'),
    [slides],
  )
  const [current, setCurrent] = useState(conceptIdx >= 0 ? conceptIdx : 0)

  // Centra un slide N en el viewport del track.
  const centerSlide = useCallback((i: number, smooth = true) => {
    const track = trackRef.current
    if (!track) return
    const slide = track.children[i] as HTMLElement | undefined
    if (!slide) return
    const target = slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2
    track.scrollTo({ left: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Al montar: el slide concepto queda centrado, sin animación inicial.
  useEffect(() => {
    if (conceptIdx < 0) return
    centerSlide(conceptIdx, false)
    setCurrent(conceptIdx)
  }, [conceptIdx, centerSlide])

  const snapTo = useCallback(
    (i: number) => {
      centerSlide(i, true)
      setCurrent(i)
    },
    [centerSlide],
  )

  // Detectar el slide activo: el más cercano al CENTRO del viewport del track.
  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const trackCenter = track.scrollLeft + track.clientWidth / 2
    let closestIdx = 0
    let closestDist = Infinity
    for (let i = 0; i < track.children.length; i++) {
      const el = track.children[i] as HTMLElement
      const elCenter = el.offsetLeft + el.offsetWidth / 2
      const d = Math.abs(elCenter - trackCenter)
      if (d < closestDist) {
        closestDist = d
        closestIdx = i
      }
    }
    setCurrent(closestIdx)
  }, [])

  return (
    <div className="cf-hero-row">
      <div ref={trackRef} className="cf-hero-row-track" onScroll={onScroll}>
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`cf-hero-row-slide cf-hero-row-slide-${slide.kind}`}
          >
            {slide.kind === 'intro' && <SlideIntro />}
            {slide.kind === 'linea' && (
              <SlideLinea
                linea={slide.linea}
                coverUrl={lineaCoverByName[slide.linea.name] ?? null}
              />
            )}
            {slide.kind === 'tipologia' && <SlideTipologia tip={slide.tip} />}
            {slide.kind === 'sistema' && <SlideSistema system={slide.system} />}
            {slide.kind === 'concepto' && (
              <SlideConcepto concept={slide.concept} growthPairs={growthPairs} />
            )}
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="cf-hero-row-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`cf-hero-row-dot ${i === current ? 'active' : ''}`}
              onClick={() => snapTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
