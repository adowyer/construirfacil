'use client'

/**
 * components/catalog/HomeRow.tsx
 *
 * Slider editorial INFERIOR (debajo del HeroRow) que se ve SOLO en modo
 * home. Misma estructura visual que HeroRow (slides 16:10 height 420,
 * scroll horizontal nativo, autoplay rAF, loop infinito con set A + set B
 * duplicados), pero corriendo en sentido INVERSO (scrollLeft decrementa
 * en lugar de crecer).
 *
 * 5 slides, uno por beneficio editorial, cada uno con su propio diseño
 * (foto de fondo, fondo oscuro, olive, etc.). Algunos disparan
 * `onVerCatalogo` para abrir el catálogo.
 *
 * Reutiliza las classes `.cf-hero-row*` del HeroRow para que la apariencia
 * (paddings, gap, aspect-ratio, height) sea idéntica.
 */

import { useEffect, useRef, useState } from 'react'
import type { LandingItem } from '@/lib/content/landing-cf'

interface HomeRowProps {
  items: LandingItem[]
  onVerCatalogo: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Variantes de slide. Una por beneficio (5 en total). Cada una define su
// background (color sólido o foto), el color del texto, y si muestra el CTA
// "Ver catálogo". Pensadas para que visualmente cada slide se distinga del
// resto, igual que el HeroRow (Pasos / Crece / Principal / Flex / Líneas).
// ─────────────────────────────────────────────────────────────────────────────

interface SlideStyle {
  bg: string
  photoUrl?: string
  textColor: string
  bodyColor: string
  ctaStyle: 'primary' | 'ghost' | 'none'
  eyebrow?: string
  /** Si true, el slide usa la clase `cf-hero-row-slide-intro` que lo deja
   *  angosto (~290px de ancho) en lugar del aspect-ratio 16:10 default.
   *  Rompe la repetición visual del marquee con slides anchos. */
  narrow?: boolean
}

const SLIDE_STYLES: Record<string, SlideStyle> = {
  // 1. Todo en Uno — slide dark angosto. Statement de apertura con eyebrow.
  'todo-en-uno': {
    bg: '#0a0a0a',
    textColor: '#ffffff',
    bodyColor: 'rgba(255, 255, 255, 0.75)',
    ctaStyle: 'none',
    eyebrow: 'Marketplace',
    narrow: true,
  },
  // 2. Atención 24/7 — foto de gente "haciendo techo" + overlay oscuro
  'atencion-24-7': {
    bg: '#1a1a1a',
    photoUrl: '/home/4.jpeg',
    textColor: '#ffffff',
    bodyColor: 'rgba(255, 255, 255, 0.88)',
    ctaStyle: 'none',
    eyebrow: 'Soporte',
  },
  // 3. Garantía Real — olive del catálogo (matchea HeroRow). Angosto para
  //    romper la repetición visual de los slides anchos.
  'garantia-real': {
    bg: '#969483',
    textColor: '#0a0a0a',
    bodyColor: '#2a2a2a',
    ctaStyle: 'none',
    eyebrow: 'Confianza',
    narrow: true,
  },
  // 4. Financiación flexible — crema cálido, angosto.
  financiacion: {
    bg: '#ebe8df',
    textColor: '#0a0a0a',
    bodyColor: '#555555',
    ctaStyle: 'none',
    eyebrow: 'Crédito',
    narrow: true,
  },
  // 5. Elegí tu casa — foto + CTA primario destacado
  'elegi-tu-casa': {
    bg: '#1a1a1a',
    photoUrl: '/home/1.jpeg',
    textColor: '#ffffff',
    bodyColor: 'rgba(255, 255, 255, 0.9)',
    ctaStyle: 'primary',
    eyebrow: 'Catálogo',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide individual: usa las clases del HeroRow para dimensiones + nueva
// clase para el styling del contenido. Inline styles para colores (robusto
// contra cache de CSS bundle).
// ─────────────────────────────────────────────────────────────────────────────

function HomeRowSlide({
  item,
  onVerCatalogo,
}: {
  item: LandingItem
  onVerCatalogo: () => void
}) {
  const style = SLIDE_STYLES[item.key] ?? SLIDE_STYLES['todo-en-uno']
  const isPhoto = Boolean(style.photoUrl)

  return (
    <div
      className={`cf-hero-row-slide cf-home-row-slide${
        style.narrow ? ' cf-hero-row-slide-intro' : ''
      }`}
      style={{
        background: style.bg,
        backgroundImage: style.photoUrl ? `url('${style.photoUrl}')` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay oscuro solo para slides con foto, para legibilidad */}
      {isPhoto && <div className="cf-home-row-slide-overlay" aria-hidden="true" />}

      <div className="cf-home-row-slide-content">
        {style.eyebrow && (
          <p
            className="cf-home-row-slide-eyebrow"
            style={{ color: style.textColor, opacity: 0.7 }}
          >
            {style.eyebrow}
          </p>
        )}
        <h3
          className="cf-home-row-slide-title"
          style={{ color: style.textColor }}
        >
          {item.label}
        </h3>
        <p
          className="cf-home-row-slide-body"
          style={{ color: style.bodyColor }}
        >
          {item.body}
        </p>
        {style.ctaStyle !== 'none' && (
          <button
            type="button"
            onClick={onVerCatalogo}
            className={`cf-home-row-slide-cta cf-home-row-slide-cta--${style.ctaStyle}`}
            style={
              style.ctaStyle === 'ghost'
                ? {
                    background: 'transparent',
                    color: style.textColor,
                    border: `1px solid ${style.textColor}`,
                  }
                : undefined
            }
          >
            Ver catálogo <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeRow principal
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeRow({ items, onVerCatalogo }: HomeRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const numSlides = items.length

  // Autoplay INVERSO al HeroRow: scrollLeft decrece en cada frame.
  // Visualmente: los slides entran desde la izquierda y se mueven hacia
  // la derecha (opuesto al HeroRow superior que se mueve hacia la izquierda).
  useEffect(() => {
    if (!trackRef.current) return

    const SPEED = 1.4 // px/frame — mismo speed que HeroRow para consistencia
    let rafId = 0

    // Arrancamos en la mitad del scroll (inicio del set B) — así hay slides
    // por ambos lados desde el primer frame, y la dirección inversa tiene
    // espacio para "salir" hacia la derecha sin chocar con scrollLeft = 0.
    const initialPosition = () => {
      const t = trackRef.current
      if (!t) return
      const firstB = t.children[numSlides] as HTMLElement | undefined
      if (firstB) t.scrollLeft = firstB.offsetLeft
    }
    initialPosition()

    const tick = () => {
      const t = trackRef.current
      if (!t) return
      if (!pausedRef.current) {
        const firstA = t.children[0] as HTMLElement | undefined
        const firstB = t.children[numSlides] as HTMLElement | undefined
        if (firstA && firstB) {
          const loopAmount = firstB.offsetLeft - firstA.offsetLeft
          let next = t.scrollLeft - SPEED
          // Loop: si bajamos del inicio del set A, saltamos al equivalente
          // del set B (sumamos loopAmount). Salto invisible.
          if (loopAmount > 0 && next < firstA.offsetLeft) {
            next += loopAmount
          }
          t.scrollLeft = next
        }
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [numSlides])

  return (
    <div
      className="cf-hero-row cf-home-row"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={trackRef} className="cf-hero-row-track">
        {/* Set A */}
        {items.map((it) => (
          <HomeRowSlide
            key={`a-${it.key}`}
            item={it}
            onVerCatalogo={onVerCatalogo}
          />
        ))}
        {/* Set B (duplicado para loop seamless) */}
        {items.map((it) => (
          <HomeRowSlide
            key={`b-${it.key}`}
            item={it}
            onVerCatalogo={onVerCatalogo}
          />
        ))}
      </div>
    </div>
  )
}
