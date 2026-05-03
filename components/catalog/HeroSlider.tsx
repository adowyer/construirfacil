'use client'

import { useRef, useState, useCallback } from 'react'
import type { LineaRow } from '@/lib/supabase/queries/lineas'

const LINE_OPTIONS = ['BOSQUE', 'ATLAS', 'TERRA']
const BED_OPTIONS = ['1-2', '3', '4+']
const SIZE_OPTIONS = [
  { v: 'S', l: '–80m²' },
  { v: 'M', l: '80–160m²' },
  { v: 'L', l: '+160m²' },
]

// ── Types ──────────────────────────────────────────────────────────────────

export type BrandContent = {
  key: string
  label: string
  title: string | null
  subtitle: string | null
  body: string | null
  cta_label: string | null
  cta_url: string | null
  sort_order: number
}

export type LineContent = {
  id: string
  linea: string
  tipologia_code: string | null
  title: string | null
  subtitle: string | null
  body: string | null
  sort_order: number
}

type Slide =
  | { type: 'search'; bg: string }
  | { type: 'lineas'; lineas: LineaRow[]; lineContent: LineContent[] }
  | { type: 'tipologias'; tipologias: LineContent[] }
  | { type: 'sistemas'; systems: BrandContent[] }
  | { type: 'concepto'; concept: BrandContent }

// ── Build slides from DB data ──────────────────────────────────────────────

function buildSlides(
  brandContent: BrandContent[] = [],
  lineContent: LineContent[] = [],
  lineas: LineaRow[] = [],
  heroBg: string,
): Slide[] {
  const byKey = (key: string) => brandContent.find(b => b.key === key)
  const concept = byKey('concept')
  const systemWood = byKey('system_wood')
  const systemSteel = byKey('system_steel')
  const systemConcrete = byKey('system_concrete')

  // Tipologías: primeras 3 distintas
  const tipologias = lineContent
    .filter(l => l.tipologia_code)
    .reduce((acc, l) => {
      if (!acc.find(x => x.tipologia_code === l.tipologia_code)) acc.push(l)
      return acc
    }, [] as LineContent[])
    .slice(0, 3)

  const slides: Slide[] = [{ type: 'search', bg: heroBg }]

  if (lineas.length > 0) {
    slides.push({ type: 'lineas', lineas, lineContent })
  }

  if (tipologias.length > 0) {
    slides.push({ type: 'tipologias', tipologias })
  }

  if (systemWood || systemSteel || systemConcrete) {
    slides.push({
      type: 'sistemas',
      systems: [systemWood, systemSteel, systemConcrete].filter(Boolean) as BrandContent[],
    })
  }

  if (concept) {
    slides.push({ type: 'concepto', concept })
  }

  return slides
}

// ── Props ──────────────────────────────────────────────────────────────────

interface HeroSliderProps {
  lineFilter: string
  bedFilter: string
  sizeFilter: string
  resultCount: number
  heroBg: string
  brandContent: BrandContent[]
  lineContent: LineContent[]
  lineas: LineaRow[]
  onLineChange: (v: string) => void
  onBedChange: (v: string) => void
  onSizeChange: (v: string) => void
}

// ── Component ──────────────────────────────────────────────────────────────

export default function HeroSlider({
  lineFilter, bedFilter, sizeFilter, resultCount,
  heroBg, brandContent, lineContent, lineas,
  onLineChange, onBedChange, onSizeChange,
}: HeroSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  const slides = buildSlides(brandContent, lineContent, lineas, heroBg)

  const snapTo = useCallback((i: number) => {
    const track = trackRef.current
    if (!track) return
    const slide = track.children[i] as HTMLElement
    if (slide) slide.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    setCurrent(i)
  }, [])

  const prev = () => snapTo(Math.max(0, current - 1))
  const next = () => snapTo(Math.min(slides.length - 1, current + 1))

  const handleScroll = () => {
    const track = trackRef.current
    if (!track || !track.children[0]) return
    const slideW = (track.children[0] as HTMLElement).getBoundingClientRect().width + 12
    const idx = Math.round(track.scrollLeft / slideW)
    if (idx !== current) setCurrent(idx)
  }

  return (
    <div className="cf-hero-wrapper">
      <div className="cf-hero-track" ref={trackRef} onScroll={handleScroll}>
        {slides.map((slide, i) => (
          <div key={i} className="cf-slide">
            {slide.type === 'search' && (
              <SlideSearch
                bg={slide.bg}
                lineFilter={lineFilter}
                bedFilter={bedFilter}
                sizeFilter={sizeFilter}
                resultCount={resultCount}
                onLineChange={onLineChange}
                onBedChange={onBedChange}
                onSizeChange={onSizeChange}
              />
            )}
            {slide.type === 'lineas' && (
              <SlideLineas lineas={slide.lineas} lineContent={slide.lineContent} />
            )}
            {slide.type === 'tipologias' && (
              <SlideTipologias tipologias={slide.tipologias} />
            )}
            {slide.type === 'sistemas' && (
              <SlideSistemas systems={slide.systems} />
            )}
            {slide.type === 'concepto' && (
              <SlideConcepto concept={slide.concept} />
            )}
          </div>
        ))}
      </div>

      {current > 0 && (
        <button className="cf-hero-arr cf-hero-arr-left" onClick={prev} aria-label="Anterior">‹</button>
      )}
      {current < slides.length - 1 && (
        <button className="cf-hero-arr cf-hero-arr-right" onClick={next} aria-label="Siguiente">›</button>
      )}

      <div className="cf-hero-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`cf-dot ${i === current ? 'cf-dot-active' : ''}`}
            onClick={() => snapTo(i)}
            aria-label={`Ir al slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Slide: search ──────────────────────────────────────────────────────────

function SlideSearch({
  bg, lineFilter, bedFilter, sizeFilter, resultCount,
  onLineChange, onBedChange, onSizeChange,
}: {
  bg: string
  lineFilter: string
  bedFilter: string
  sizeFilter: string
  resultCount: number
  onLineChange: (v: string) => void
  onBedChange: (v: string) => void
  onSizeChange: (v: string) => void
}) {
  return (
    <div
      className="cf-slide-search"
      style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.55)), url('${bg}')` }}
    >
      <p className="cf-slide-eyebrow">Catálogo Hausind</p>
      <h1 className="cf-slide-title">La casa que querés,<br />al precio que necesitás</h1>
      <div className="cf-search-bar">
        <div className="cf-search-field cf-search-field--select">
          <p className="cf-search-lbl">Línea</p>
          <div className="cf-search-chips">
            {LINE_OPTIONS.map(v => (
              <button
                key={v}
                className={`cf-search-chip ${lineFilter === v ? 'active' : ''}`}
                onClick={() => onLineChange(lineFilter === v ? 'ALL' : v)}
              >
                {v.charAt(0) + v.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="cf-search-field cf-search-field--select">
          <p className="cf-search-lbl">Dorm.</p>
          <div className="cf-search-chips">
            {BED_OPTIONS.map(v => (
              <button
                key={v}
                className={`cf-search-chip ${bedFilter === v ? 'active' : ''}`}
                onClick={() => onBedChange(bedFilter === v ? 'ALL' : v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="cf-search-field cf-search-field--select">
          <p className="cf-search-lbl">Tamaño</p>
          <div className="cf-search-chips">
            {SIZE_OPTIONS.map(({ v, l }) => (
              <button
                key={v}
                className={`cf-search-chip ${sizeFilter === v ? 'active' : ''}`}
                onClick={() => onSizeChange(sizeFilter === v ? 'ALL' : v)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <button
          className="cf-search-go"
          onClick={() => document.getElementById('catalog-grid')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Ver {resultCount} casas →
        </button>
      </div>
    </div>
  )
}

// ── Slide: Líneas ──────────────────────────────────────────────────────────

const LINE_FALLBACK: Record<string, string> = {
  BOSQUE: '#2d3a2e',
  ATLAS:  '#2a3040',
  TERRA:  '#3a2e28',
}

function SlideLineas({ lineas, lineContent }: { lineas: LineaRow[]; lineContent: LineContent[] }) {
  return (
    <div className="cf-slide-edu">
      <div className="cf-slide-edu-left">
        <p className="cf-slide-edu-eyebrow">Tres líneas, tres mundos</p>
        <h2 className="cf-slide-edu-title">Encontrá la línea que mejor se adapta a vos</h2>
        <p className="cf-slide-edu-text">De casas premium a soluciones modulares. Cada línea responde a un estilo de vida diferente.</p>
      </div>
      <div className="cf-slide-edu-right">
        {lineas.map(linea => {
          const slugUpper = linea.slug.toUpperCase()
          const content = lineContent.find(l => l.linea === slugUpper && !l.tipologia_code)
          return (
            <div
              key={linea.id}
              className="cf-edu-card"
              style={linea.hero_image_url
                ? { backgroundImage: `url('${linea.hero_image_url}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : { background: LINE_FALLBACK[slugUpper] ?? '#2a2a2a' }
              }
            >
              <div className="cf-edu-card-overlay cf-edu-card-overlay--tall">
                <p className="cf-edu-card-name">{linea.name}</p>
                <p className="cf-edu-card-meta">{linea.tagline ?? content?.subtitle ?? ''}</p>
                {content?.body && (
                  <p className="cf-edu-card-body">{content.body.split('\n\n')[0].slice(0, 120)}...</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Slide: Tipologías ──────────────────────────────────────────────────────

function SlideTipologias({ tipologias }: { tipologias: LineContent[] }) {
  const COLORS = ['#f0eee8', '#ebe8df', '#e8e4d4']
  return (
    <div className="cf-slide-edu">
      <div className="cf-slide-edu-left">
        <p className="cf-slide-edu-eyebrow">Tipología = forma del plano</p>
        <h2 className="cf-slide-edu-title">Cómo se organiza tu casa</h2>
        <p className="cf-slide-edu-text">Cada tipología define cómo se distribuyen los ambientes sociales, privados y de servicio. Elegí la que mejor se adapta a tu forma de vivir.</p>
      </div>
      <div className="cf-slide-edu-right">
        {tipologias.map((t, i) => (
          <div
            key={t.id}
            className="cf-edu-card"
            style={{ background: COLORS[i] ?? '#f0eee8' }}
          >
            <div className="cf-edu-card-plain cf-edu-card-plain--content">
              <span className="cf-edu-card-code">T{t.tipologia_code}</span>
              <span className="cf-edu-card-plain-meta">{t.title}</span>
              <p className="cf-edu-card-plain-body">{t.body?.split('\n\n')[0].slice(0, 100)}...</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slide: Sistemas ────────────────────────────────────────────────────────

function SlideSistemas({ systems }: { systems: BrandContent[] }) {
  const COLORS = ['#f0eee8', '#ebe8df', '#e8e4d4']
  return (
    <div className="cf-slide-edu">
      <div className="cf-slide-edu-left">
        <p className="cf-slide-edu-eyebrow">Sistemas constructivos</p>
        <h2 className="cf-slide-edu-title">Wood, Steel, Hormigón</h2>
        <p className="cf-slide-edu-text">El sistema constructivo define la estructura, los tiempos de obra y el costo. Todos los sistemas cumplen los mismos estándares de calidad y eficiencia.</p>
      </div>
      <div className="cf-slide-edu-right">
        {systems.map((s, i) => (
          <div
            key={s.key}
            className="cf-edu-card"
            style={{ background: COLORS[i] ?? '#f0eee8' }}
          >
            <div className="cf-edu-card-plain cf-edu-card-plain--content">
              <span className="cf-edu-card-code cf-edu-card-code--sm">{s.title}</span>
              <span className="cf-edu-card-plain-meta">{s.subtitle}</span>
              <p className="cf-edu-card-plain-body">{s.body?.split('\n\n')[0].slice(0, 120)}...</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Slide: Concepto ────────────────────────────────────────────────────────

function SlideConcepto({ concept }: { concept: BrandContent }) {
  const paragraphs = concept.body?.split('\n\n') ?? []
  return (
    <div className="cf-slide-edu">
      <div className="cf-slide-edu-left">
        <p className="cf-slide-edu-eyebrow">La casa que crece</p>
        <h2 className="cf-slide-edu-title">{concept.title}</h2>
        <p className="cf-slide-edu-text">{paragraphs[0]?.slice(0, 180)}...</p>
      </div>
      <div className="cf-slide-edu-right">
        {(['V0', 'V2', 'V3'] as const).map((v, i) => (
          <div
            key={v}
            className="cf-edu-card"
            style={{ background: i === 0 ? '#f0eee8' : i === 1 ? '#ebe8df' : '#e8e4d4' }}
          >
            <div className="cf-edu-card-plain">
              <span className="cf-edu-card-code">{v}</span>
              <span className="cf-edu-card-plain-meta">
                {v === 'V0' ? '40 m² · 1 dorm.' : v === 'V2' ? '75 m² · 2 dorm.' : '86 m² · 4 dorm.'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
