'use client'

/**
 * components/catalog/HeroSlider.tsx
 *
 * Slider hero con 5 slides:
 *   0. Buscador sobre foto destacada
 *   1. Las 3 líneas (Bosque / Atlas / Terra)
 *   2. Tipologías
 *   3. Sistemas constructivos
 *   4. La casa que crece (variantes)
 *
 * Características:
 *   - Slides no full-width (88%) → peek del siguiente a la derecha
 *   - Manual: flechas izq/der + dots clickeables
 *   - Sin auto-avance
 */

import { useRef, useState, useCallback } from 'react'

const SLIDES = [
  {
    type: 'search' as const,
    bg: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1600',
  },
  {
    type: 'edu' as const,
    eyebrow: 'Tres líneas, tres mundos',
    title: 'Encontrá la línea que mejor se adapta a vos',
    text: 'De casas premium a soluciones modulares. Cada línea responde a un estilo de vida diferente.',
    cards: [
      { name: 'Bosque', meta: 'Premium · 9 modelos', bg: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600' },
      { name: 'Atlas',  meta: 'Estándar · 5 modelos', bg: 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=600' },
      { name: 'Terra',  meta: 'Modular · 5 modelos', bg: 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=600' },
    ],
  },
  {
    type: 'edu' as const,
    eyebrow: 'Tipología = forma del plano',
    title: 'Cómo se organiza tu casa',
    text: 'Cada tipología define cómo se distribuyen los ambientes sociales, privados y de servicio. Elegí la que mejor se adapta a tu forma de vivir.',
    cards: [
      { name: 'T1', meta: 'Volúmenes laterales · servicios al centro', bg: null, color: '#f0eee8' },
      { name: 'T2', meta: 'Social al frente · privado atrás', bg: null, color: '#ebe8df' },
      { name: 'T3 / U / O / Z', meta: 'Distribuciones modulares', bg: null, color: '#e8e4d4' },
    ],
  },
  {
    type: 'edu' as const,
    eyebrow: 'Sistemas constructivos',
    title: 'Wood, Steel, Hormigón',
    text: 'El sistema constructivo define la estructura, los tiempos de obra y el costo. Todos los sistemas cumplen los mismos estándares de calidad y eficiencia.',
    cards: [
      { name: 'Wood Plus', meta: 'Steel framing + terminaciones madera', bg: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600' },
      { name: 'Steel Plus', meta: 'Estructura metálica · máxima velocidad', bg: 'https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=600' },
      { name: 'Hormigón Plus', meta: 'Bloques estructurales · alta durabilidad', bg: 'https://images.unsplash.com/photo-1564540583246-934409427776?w=600' },
    ],
  },
  {
    type: 'edu' as const,
    eyebrow: 'La casa que crece',
    title: 'Empezá con lo que necesitás hoy',
    text: 'Cada modelo tiene variantes (V0, V1, V2, V3...). Tu casa puede crecer con tu familia o tu presupuesto, sin mudarte.',
    cards: [
      { name: 'V0', meta: '40 m² · 1 dorm.', bg: null, color: '#f0eee8' },
      { name: 'V2', meta: '75 m² · 2 dorm.', bg: null, color: '#ebe8df' },
      { name: 'V3', meta: '86 m² · 4 dorm.', bg: null, color: '#e8e4d4' },
    ],
  },
]

export default function HeroSlider() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  const snapTo = useCallback((i: number) => {
    const track = trackRef.current
    if (!track) return
    const slide = track.children[i] as HTMLElement
    if (slide) {
      slide.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    }
    setCurrent(i)
  }, [])

  const prev = () => snapTo(Math.max(0, current - 1))
  const next = () => snapTo(Math.min(SLIDES.length - 1, current + 1))

  const handleScroll = () => {
    const track = trackRef.current
    if (!track || !track.children[0]) return
    const slideW = (track.children[0] as HTMLElement).getBoundingClientRect().width + 12
    const idx = Math.round(track.scrollLeft / slideW)
    if (idx !== current) setCurrent(idx)
  }

  return (
    <div className="cf-hero-wrapper">
      <div
        className="cf-hero-track"
        ref={trackRef}
        onScroll={handleScroll}
      >
        {SLIDES.map((slide, i) => (
          <div key={i} className="cf-slide">
            {slide.type === 'search' ? (
              <SlideSearch bg={slide.bg!} />
            ) : (
              <SlideEdu
                eyebrow={slide.eyebrow!}
                title={slide.title!}
                text={slide.text!}
                cards={slide.cards!}
              />
            )}
          </div>
        ))}
      </div>

      {/* Flechas */}
      {current > 0 && (
        <button className="cf-hero-arr cf-hero-arr-left" onClick={prev} aria-label="Anterior">‹</button>
      )}
      {current < SLIDES.length - 1 && (
        <button className="cf-hero-arr cf-hero-arr-right" onClick={next} aria-label="Siguiente">›</button>
      )}

      {/* Dots */}
      <div className="cf-hero-dots">
        {SLIDES.map((_, i) => (
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

// ─────────────────────────────────────────────────────────────────────────────
// Slide 1: buscador hero
// ─────────────────────────────────────────────────────────────────────────────

function SlideSearch({ bg }: { bg: string }) {
  return (
    <div
      className="cf-slide-search"
      style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.55)), url('${bg}')` }}
    >
      <p className="cf-slide-eyebrow">Catálogo Hausind</p>
      <h1 className="cf-slide-title">La casa que querés,<br/>al precio que necesitás</h1>
      <div className="cf-search-bar">
        <SearchField label="Línea" value="Todas" />
        <SearchField label="Tamaño" value="Cualquiera" />
        <SearchField label="Dorm." value="Cualquiera" />
        <button className="cf-search-go">Buscar 248 →</button>
      </div>
    </div>
  )
}

function SearchField({ label, value }: { label: string; value: string }) {
  return (
    <div className="cf-search-field">
      <p className="cf-search-lbl">{label}</p>
      <p className="cf-search-val">{value}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slides 2-5: educativos
// ─────────────────────────────────────────────────────────────────────────────

function SlideEdu({
  eyebrow, title, text, cards,
}: {
  eyebrow: string
  title: string
  text: string
  cards: { name: string; meta: string; bg?: string | null; color?: string }[]
}) {
  return (
    <div className="cf-slide-edu">
      <div className="cf-slide-edu-left">
        <p className="cf-slide-edu-eyebrow">{eyebrow}</p>
        <h2 className="cf-slide-edu-title">{title}</h2>
        <p className="cf-slide-edu-text">{text}</p>
      </div>
      <div className="cf-slide-edu-right">
        {cards.map((c, i) => (
          <div
            key={i}
            className="cf-edu-card"
            style={c.bg
              ? { backgroundImage: `url('${c.bg}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: c.color ?? '#f0eee8' }
            }
          >
            {c.bg ? (
              <div className="cf-edu-card-overlay">
                <p className="cf-edu-card-name">{c.name}</p>
                <p className="cf-edu-card-meta">{c.meta}</p>
              </div>
            ) : (
              <div className="cf-edu-card-plain">
                <span className="cf-edu-card-code">{c.name}</span>
                <span className="cf-edu-card-plain-meta">{c.meta}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
