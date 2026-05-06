'use client'

/**
 * components/catalog/HeroRow.tsx
 *
 * Slider editorial superior del catálogo. 6 slides en orden:
 *
 *   [Casa que Crece] ← [Flex Build Suite] ← [PRINCIPAL] → [Cómo mudarte] → [Ventajas] → [Calidad]
 *
 * Carga inicial: scroll al centro (PRINCIPAL = Sección 1, manifesto editorial).
 *
 * El PRINCIPAL usa fondo SVG vectorial (/hero/sistema-bg.svg) para no
 * confundirse con las fotos del catálogo — look manifesto/blueprint con
 * aside glass blur encima.
 *
 * Cada sección de texto tiene "Ver más" que abre un modal con el contenido
 * extendido (versión `long` del documento original).
 */

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import type { BrandContent, LineContent } from './HeroSlider'
import type { LineaRow } from '@/lib/supabase/queries/lineas'
import { HERO_SECTIONS, type HeroSection } from '@/lib/data/heroContent'
import FeatureAutoSlider from './FeatureAutoSlider'

/** Par de imágenes de un modelo en sus variantes 1 planta / 2 plantas. */
export interface GrowthPair {
  name: string
  img1: string
  img2: string
}

interface HeroRowProps {
  brandContent?: BrandContent[]
  /** Reservado para usos futuros (línea content). Se acepta por compat con
   *  CatalogPage; HeroRow actual no lo consume. */
  lineContent?: LineContent[]
  /** Reservado por compat — actualmente no se usa en este HeroRow. */
  lineas?: LineaRow[]
  /** Reservado por compat — actualmente no se usa en este HeroRow. */
  lineaCoverByName?: Record<string, string | null>
  /** Pares (1 planta / 2 plantas) por modelo. Background animado del slide
   *  "Casa que Crece" — alterna entre cada par para mostrar el crecimiento. */
  growthPairs?: GrowthPair[]
}

type Slide =
  | { kind: 'crece'; concept: BrandContent | null }
  | { kind: 'section'; section: HeroSection }

function buildSlides(brandContent: BrandContent[]): Slide[] {
  const concept = brandContent.find((b) => b.key === 'concept') ?? null
  return [
    { kind: 'crece', concept },
    ...HERO_SECTIONS.map((s) => ({ kind: 'section' as const, section: s })),
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// Animación Casa que Crece (background + glass overlay)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crossfade entre img1 (1 planta) e img2 (2 plantas) de pares hermanos.
 * Antes era el contenido principal del slide; ahora es solo el FONDO del
 * slide "Casa que Crece" (encima va un bloque glass blur con el texto).
 */
function HouseGrowBg({ pairs }: { pairs: GrowthPair[] }) {
  const images = useMemo(() => pairs.flatMap((p) => [p.img1, p.img2]), [pairs])
  const [activeIdx, setActiveIdx] = useState(0)
  const [prevIdx, setPrevIdx] = useState(-1)

  useEffect(() => {
    if (images.length <= 1) return
    const id = setInterval(() => {
      setActiveIdx((current) => {
        setPrevIdx(current)
        return (current + 1) % images.length
      })
    }, 2400)
    return () => clearInterval(id)
  }, [images.length])

  if (images.length === 0) return <div className="cf-hero-crece-bg cf-hero-crece-bg-empty" />

  return (
    <>
      {images.map((url, i) => {
        const isActive = i === activeIdx
        const isPrev = i === prevIdx
        return (
          <div
            key={`${url}-${i}`}
            className="cf-hero-crece-bg"
            style={{
              backgroundImage: `url('${url}')`,
              opacity: isActive || isPrev ? 1 : 0,
              zIndex: isActive ? 2 : isPrev ? 1 : 0,
              transition: isActive ? 'opacity 1.2s ease-in-out' : 'none',
              position: 'absolute',
              inset: 0,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )
      })}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal "Ver más" — reusable para todas las secciones
// ─────────────────────────────────────────────────────────────────────────────

function SectionModal({
  open,
  onClose,
  section,
}: {
  open: boolean
  onClose: () => void
  section: HeroSection
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    else if (!open && dlg.open) dlg.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="cf-hero-modal"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose()
      }}
      onClose={onClose}
    >
      <div className="cf-hero-modal-inner">
        <button
          type="button"
          className="cf-hero-modal-close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
        <p className="cf-pn-eyebrow">{section.eyebrow}</p>
        <h2 className="cf-hero-modal-title">{section.title}</h2>
        {section.intro && <p className="cf-hero-modal-intro">{section.intro}</p>}
        <div className="cf-hero-modal-bullets">
          {section.long.map((b) => (
            <div key={b.name} className="cf-hero-modal-bullet">
              <p className="cf-hero-modal-bullet-name">{b.name}</p>
              <p className="cf-hero-modal-bullet-body">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide: Casa que Crece (background con fade + glass overlay con texto)
// ─────────────────────────────────────────────────────────────────────────────

function SlideCrece({
  concept,
  growthPairs,
}: {
  concept: BrandContent | null
  growthPairs: GrowthPair[]
}) {
  const [open, setOpen] = useState(false)
  const teaser =
    concept?.body
      ?.split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)[0] ?? null

  // Adapta concept (BrandContent) a HeroSection-like para reutilizar el modal.
  const modalSection: HeroSection = {
    id: 'crece',
    eyebrow: 'Concepto',
    title: concept?.title ?? 'La Casa que Crece',
    intro: concept?.subtitle ?? undefined,
    short: [],
    long: (concept?.body ?? '')
      .split(/\n{2,}/)
      .map((p, i) => ({ name: `${i + 1}.`, body: p.trim() }))
      .filter((b) => b.body.length > 0),
  }

  return (
    <>
      <div className="cf-hero-slide-card cf-hero-slide-crece">
        <HouseGrowBg pairs={growthPairs} />
        <div className="cf-hero-slide-crece-overlay">
          <p className="cf-pn-eyebrow">Concepto</p>
          <h3 className="cf-hero-slide-crece-title">
            {concept?.title ?? 'La Casa que Crece'}
          </h3>
          {teaser && <p className="cf-hero-slide-crece-body">{teaser}</p>}
          {(concept?.body?.length ?? 0) > (teaser?.length ?? 0) && (
            <button
              type="button"
              className="cf-hero-more-btn cf-hero-more-btn-centered"
              onClick={() => setOpen(true)}
            >
              Ver más →
            </button>
          )}
        </div>
      </div>
      <SectionModal open={open} onClose={() => setOpen(false)} section={modalSection} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide: PRINCIPAL — manifesto editorial con SVG de fondo + aside glass blur
// ─────────────────────────────────────────────────────────────────────────────

function SlidePrincipal({ section }: { section: HeroSection }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="cf-hero-slide-card cf-hero-slide-principal">
        {/* Fondo fotográfico cinematográfico */}
        <div
          className="cf-hero-principal-bg"
          style={{ backgroundImage: "url('https://img.magnific.com/premium-photo/modern-house-design-evening-sunset-illumination_1201528-15730.jpg')" }}
        />
        <div className="cf-hero-principal-overlay cf-hero-principal-overlay-centered">
          <div className="cf-hero-principal-content">
            <p className="cf-pn-eyebrow">{section.eyebrow}</p>
            <h2 className="cf-hero-principal-title-large">{section.title}</h2>
            {section.intro && (
              <p className="cf-hero-principal-intro-centered">{section.intro}</p>
            )}
            
            <FeatureAutoSlider items={section.short} intervalMs={3000} variant="centered" />
            
            <button
              type="button"
              className="cf-hero-more-btn cf-hero-more-btn-light cf-hero-more-btn-centered"
              onClick={() => setOpen(true)}
            >
              Ver más →
            </button>
          </div>
        </div>
      </div>
      <SectionModal open={open} onClose={() => setOpen(false)} section={section} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide: secciones secundarias (Flex / Mudarse / Ventajas / Calidad)
// ─────────────────────────────────────────────────────────────────────────────

function SlideSection({ section }: { section: HeroSection }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className={`cf-hero-slide-card cf-hero-slide-section cf-hero-slide-section-centered cf-hero-slide-${section.id}`}>
        <div className="cf-hero-slide-section-overlay">
          <p className="cf-pn-eyebrow">{section.eyebrow}</p>
          <h3 className="cf-hero-slide-section-title-large">{section.title}</h3>
          {section.intro && (
            <p className="cf-hero-slide-section-intro-centered">{section.intro}</p>
          )}
          
          <FeatureAutoSlider items={section.short} intervalMs={3000} variant="centered" />
          
          <button
            type="button"
            className="cf-hero-more-btn cf-hero-more-btn-centered"
            onClick={() => setOpen(true)}
          >
            Ver más →
          </button>
        </div>
      </div>
      <SectionModal open={open} onClose={() => setOpen(false)} section={section} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

export default function HeroRow({
  brandContent = [],
  growthPairs = [],
}: HeroRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const slides = useMemo(() => buildSlides(brandContent), [brandContent])

  // Carga inicial: scroll al PRINCIPAL (= Sección 1, segundo desde
  // izquierda en HERO_SECTIONS = índice 2 en el array completo:
  //   0=crece, 1=flex, 2=principal, 3=mudarse, 4=ventajas, 5=calidad).
  const principalIdx = useMemo(
    () =>
      slides.findIndex(
        (s) => s.kind === 'section' && s.section.id === 'principal',
      ),
    [slides],
  )
  const [current, setCurrent] = useState(principalIdx >= 0 ? principalIdx : 0)

  const centerSlide = useCallback((i: number, smooth = true) => {
    const track = trackRef.current
    if (!track) return
    const slide = track.children[i] as HTMLElement | undefined
    if (!slide) return
    const target = slide.offsetLeft + slide.offsetWidth / 2 - track.clientWidth / 2
    track.scrollTo({ left: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    if (principalIdx < 0) return
    centerSlide(principalIdx, false)
    setCurrent(principalIdx)
  }, [principalIdx, centerSlide])

  const snapTo = useCallback(
    (i: number) => {
      centerSlide(i, true)
      setCurrent(i)
    },
    [centerSlide],
  )

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
            className={`cf-hero-row-slide cf-hero-row-slide-${slide.kind}${
              slide.kind === 'section' ? ` cf-hero-row-slide-${slide.section.id}` : ''
            }`}
          >
            {slide.kind === 'crece' && (
              <SlideCrece concept={slide.concept} growthPairs={growthPairs} />
            )}
            {slide.kind === 'section' && slide.section.id === 'principal' && (
              <SlidePrincipal section={slide.section} />
            )}
            {slide.kind === 'section' && slide.section.id !== 'principal' && (
              <SlideSection section={slide.section} />
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
