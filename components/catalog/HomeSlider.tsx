'use client'

/**
 * components/catalog/HomeSlider.tsx
 *
 * Slider 2 que se renderiza arriba de la grilla SOLO en modo home. Mismo
 * patrón de scroll que el HeroRow:
 *   - Track con `overflow-x: auto` → drag/scroll horizontal nativo del browser.
 *   - rAF loop que avanza `scrollLeft` para autoplay (dirección opuesta al
 *     HeroRow: va decreciendo en lugar de creciendo).
 *   - Slides duplicados en JSX (set A + set B) para loop infinito sin saltos.
 *   - Pause-on-hover via state.
 *
 * En modo catálogo (homeMode=false), este componente NO se renderiza.
 */

import { useEffect, useRef, useState } from 'react'
import type { LandingItem } from '@/lib/content/landing-cf'

interface HomeSliderProps {
  items: LandingItem[]
  onVerCatalogo: () => void
}

type SlideVariant =
  | { variant: 'dark-wide'; showCta?: boolean }
  | { variant: 'photo'; photoUrl: string; showCta?: boolean }
  | { variant: 'olive'; showCta?: boolean }
  | { variant: 'cream-wide'; showCta?: boolean }
  | { variant: 'photo-cta'; photoUrl: string; showCta?: boolean }

// Estilos por slide (index-based). Mezcla fondos sólidos + fotos + anchos
// variables para que el slider tenga ritmo visual estilo HeroRow.
const SLIDE_VARIANTS: SlideVariant[] = [
  { variant: 'dark-wide', showCta: true },              // 0. Todo en Uno
  { variant: 'photo', photoUrl: '/home/4.jpeg' },       // 1. Atención 24/7
  { variant: 'olive', showCta: true },                  // 2. Garantía Real
  { variant: 'cream-wide' },                            // 3. Financiación
  { variant: 'photo-cta', photoUrl: '/home/1.jpeg', showCta: true }, // 4. Elegí tu casa
]

export default function HomeSlider({ items, onVerCatalogo }: HomeSliderProps) {
  // Duplicamos los slides (set A + set B) para que el loop infinito de
  // scrollLeft sea seamless: cuando el rAF detecta que pasamos al inicio
  // del set B, sumamos el ancho del set A → scrollLeft "salta" al
  // equivalente visual en el set A. El salto es invisible porque los sets
  // son idénticos.
  const loopItems = [...items, ...items]

  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // Autoplay: rAF avanza scrollLeft cada frame. Dirección INVERSA al HeroRow:
  // scrollLeft empieza alto (en el set B) y va DECRECIENDO → los slides
  // parecen entrar desde la izquierda y moverse hacia la derecha.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const SPEED = 0.7 // px/frame ≈ 42 px/s (más lento que HeroRow)
    // Arrancamos en la mitad del scroll para tener slides por ambos lados.
    track.scrollLeft = track.scrollWidth / 2
    let rafId = 0

    const tick = () => {
      const t = trackRef.current
      if (!t) return
      if (!pausedRef.current) {
        const halfWidth = t.scrollWidth / 2
        let next = t.scrollLeft - SPEED
        // Loop: si nos pasamos al "set A" inicial, saltamos al equivalente
        // del "set B" (sumamos halfWidth) — invisible porque son idénticos.
        if (next < 0) next += halfWidth
        t.scrollLeft = next
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <section
      className="cf-home-slider"
      aria-label="ConstruirFácil — qué nos hace diferentes"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={trackRef} className="cf-home-slider-track">
        {loopItems.map((it, i) => {
          // Modulo para que los slides duplicados (5-9) reutilicen las
          // mismas variantes que los originales (0-4).
          const v = SLIDE_VARIANTS[i % items.length] ?? SLIDE_VARIANTS[0]
          const isPhoto =
            v.variant === 'photo' || v.variant === 'photo-cta'
          const bgImage = isPhoto
            ? `url('${(v as { photoUrl: string }).photoUrl}')`
            : undefined

          // Estilos por variant aplicados INLINE para evitar problemas de
          // cache de CSS (el bundle compilado puede estar stale en el
          // browser). Inline styles siempre ganan y no dependen del bundle.
          // Texto interno (color del título/body) lo manejamos también acá
          // según si el fondo es oscuro o claro.
          const inlineByVariant: React.CSSProperties = (() => {
            switch (v.variant) {
              case 'dark-wide':
                return {
                  background: '#0a0a0a',
                  flex: '0 0 clamp(440px, 42vw, 600px)',
                  color: '#ffffff',
                }
              case 'photo':
                return { color: '#ffffff' }
              case 'olive':
                return { background: '#969483', color: '#0a0a0a' }
              case 'cream-wide':
                return {
                  background: '#ebe8df',
                  flex: '0 0 clamp(440px, 42vw, 580px)',
                  color: '#0a0a0a',
                }
              case 'photo-cta':
                return {
                  flex: '0 0 clamp(360px, 34vw, 460px)',
                  color: '#ffffff',
                }
              default:
                return {}
            }
          })()

          // Colores de título y body inheritados del color del article via
          // `color: inherit` en los hijos. Para `olive`, el body queda en
          // gris medio (override abajo).
          const titleStyle: React.CSSProperties = { color: 'inherit' }
          const bodyStyle: React.CSSProperties =
            v.variant === 'dark-wide' || v.variant === 'photo' || v.variant === 'photo-cta'
              ? { color: 'rgba(255, 255, 255, 0.85)' }
              : v.variant === 'olive'
              ? { color: '#2a2a2a' }
              : v.variant === 'cream-wide'
              ? { color: '#555555' }
              : { color: 'inherit' }

          return (
            <article
              key={`${it.key}-${i}`}
              className={`cf-home-slider-card cf-home-slider-card--${v.variant}`}
              style={{
                ...inlineByVariant,
                ...(bgImage
                  ? {
                      backgroundImage: bgImage,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }
                  : {}),
              }}
              aria-hidden={i >= items.length ? 'true' : undefined}
            >
              {/* Photo variants tienen un overlay oscuro para legibilidad */}
              {isPhoto && (
                <div
                  className="cf-home-slider-card-overlay"
                  aria-hidden="true"
                />
              )}

              <div className="cf-home-slider-card-content">
                <h3
                  className="cf-home-slider-card-title"
                  style={titleStyle}
                >
                  {it.label}
                </h3>
                <p
                  className="cf-home-slider-card-body"
                  style={bodyStyle}
                >
                  {it.body}
                </p>
                {v.showCta && (
                  <button
                    type="button"
                    className="cf-home-slider-cta"
                    onClick={onVerCatalogo}
                  >
                    Ver catálogo
                    <span aria-hidden="true"> →</span>
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
