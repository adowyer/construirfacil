'use client'

/**
 * components/catalog/HomeRow.tsx
 *
 * Slider editorial INFERIOR (debajo del HeroRow), solo en modo home.
 * Estructura/animación idénticas a antes (marquee rAF inverso, set A+B).
 *
 * Contenido + visual ahora vienen de la DB (home_slide_content) resueltos
 * con fallback a lib/content/home-defaults.ts (fuente única). Sin filas /
 * campos vacíos → defaults = comportamiento anterior (cero regresión).
 * B2B hereda B2C (resuelto en getResolvedHomeSlides).
 */

import { useEffect, useRef, useState } from 'react'
import type {
  HomeSlide,
  HomeVariant,
} from '@/lib/supabase/queries/home_content'
import { HOME_SLIDE_KEYS } from '@/lib/supabase/queries/home_content'
import {
  effectiveHomeSlide,
  effectiveHomeBanner,
  type EffectiveHomeSlide,
} from '@/lib/content/home-defaults'

interface HomeRowProps {
  homeSlides: HomeSlide[]
  variant: HomeVariant
  onVerCatalogo: () => void
}

function HomeRowSlide({
  slide,
  onVerCatalogo,
}: {
  slide: EffectiveHomeSlide
  onVerCatalogo: () => void
}) {
  const isPhoto = Boolean(slide.image_url)

  return (
    <div
      className={`cf-hero-row-slide cf-home-row-slide${
        slide.narrow ? ' cf-hero-row-slide-intro' : ''
      }`}
      style={{
        background: slide.bg,
        backgroundImage: slide.image_url
          ? `url('${slide.image_url}')`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {isPhoto && (
        <div className="cf-home-row-slide-overlay" aria-hidden="true" />
      )}

      <div className="cf-home-row-slide-content">
        {slide.eyebrow && (
          <p
            className="cf-home-row-slide-eyebrow"
            style={{ color: slide.text_color, opacity: 0.7 }}
          >
            {slide.eyebrow}
          </p>
        )}
        <h3
          className="cf-home-row-slide-title"
          style={{ color: slide.text_color }}
        >
          {slide.label}
        </h3>
        <p
          className="cf-home-row-slide-body"
          style={{ color: slide.body_color }}
        >
          {slide.body}
        </p>
        {slide.cta_style !== 'none' && (
          <button
            type="button"
            onClick={onVerCatalogo}
            className={`cf-home-row-slide-cta cf-home-row-slide-cta--${slide.cta_style}`}
            style={
              slide.cta_style === 'ghost'
                ? {
                    background: 'transparent',
                    color: slide.text_color,
                    border: `1px solid ${slide.text_color}`,
                  }
                : undefined
            }
          >
            {slide.cta_label} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default function HomeRow({
  homeSlides,
  variant,
  onVerCatalogo,
}: HomeRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // 5 slots canónicos + banners repetibles, ordenados por sort_order
  // efectivo (fila → su sort_order; slot sin fila → su índice natural).
  // Desempate estable por el índice de construcción (slots antes que
  // banners; entre slots, el orden natural home-1..home-5).
  const built: EffectiveHomeSlide[] = [
    ...HOME_SLIDE_KEYS.map((key, idx) =>
      effectiveHomeSlide(
        key,
        variant,
        homeSlides.find((s) => s.slide_key === key),
        idx,
      ),
    ),
    ...homeSlides
      .filter((s) => s.slide_key === 'banner')
      .map((s) => effectiveHomeBanner(s)),
  ]
  const slides: EffectiveHomeSlide[] = built
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.sort_order - b.s.sort_order || a.i - b.i)
    .map(({ s }) => s)
  const numSlides = slides.length

  useEffect(() => {
    if (!trackRef.current) return
    const SPEED = 1.4
    let rafId = 0

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
        {slides.map((s) => (
          <HomeRowSlide
            key={`a-${s.key}`}
            slide={s}
            onVerCatalogo={onVerCatalogo}
          />
        ))}
        {slides.map((s) => (
          <HomeRowSlide
            key={`b-${s.key}`}
            slide={s}
            onVerCatalogo={onVerCatalogo}
          />
        ))}
      </div>
    </div>
  )
}
