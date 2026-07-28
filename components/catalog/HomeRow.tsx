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

import { Fragment, useEffect, useRef, useState } from 'react'
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
import { ensureHtml } from '@/lib/content/rich'

interface HomeRowProps {
  homeSlides: HomeSlide[]
  variant: HomeVariant
  onVerCatalogo: () => void
}

function CatalogCtaSlide({ onVerCatalogo }: { onVerCatalogo: () => void }) {
  return (
    <div
      className="cf-hero-row-slide cf-catalog-cta-slide"
      onClick={onVerCatalogo}
      role="button"
      tabIndex={0}
      aria-label="Ver catálogo"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onVerCatalogo()
        }
      }}
    >
      <div className="cf-catalog-cta-content">
        <p className="cf-catalog-cta-eyebrow">Elegí tu casa</p>
        <h3 className="cf-catalog-cta-title">Mirá nuestro catálogo</h3>
        <span className="cf-catalog-cta-arrow" aria-hidden="true">
          →
        </span>
      </div>
    </div>
  )
}

function HomeRowSlide({
  slide,
  onVerCatalogo,
}: {
  slide: EffectiveHomeSlide
  onVerCatalogo: () => void
}) {
  // Para los slots canónicos (home-1..home-5) seguimos respetando `narrow`
  // (flag legacy que controla un layout angosto puntual). Para banners
  // mandamos por `banner_width` que da 4 anchos diferenciados.
  const isBanner = slide.slide_key === 'banner'
  const widthClass = isBanner
    ? `cf-home-row-slide--${slide.banner_width}`
    : slide.narrow
      ? 'cf-hero-row-slide-intro'
      : ''
  const isTextOnly = isBanner && slide.banner_width === 'text'
  const isPhoto = !isTextOnly && Boolean(slide.image_url)

  return (
    <div
      className={`cf-hero-row-slide cf-home-row-slide${widthClass ? ' ' + widthClass : ''}`}
      style={{
        background: isTextOnly ? 'transparent' : slide.bg,
        backgroundImage:
          !isTextOnly && slide.image_url
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
        <div
          className="cf-home-row-slide-body cf-richtext"
          style={{ color: slide.body_color }}
          dangerouslySetInnerHTML={{ __html: ensureHtml(slide.body) }}
        />
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
  // +1 por el CatalogCtaSlide hardcoded que inyectamos entre home-1 y home-2
  // (banner rojo "Mirá nuestro catálogo"). Cada set A/B tiene N slides + 1 CTA.
  const numSlides = slides.length + 1

  useEffect(() => {
    if (!trackRef.current) return
    const SPEED = 1.4
    let rafId = 0

    // Posición inicial: arrancamos en el CTA rojo del set B (buscándolo por
    // clase — la posición varía según el sort_order de la DB, así que no la
    // podemos hardcodear por índice). Motivo: el HeroRow arranca centrando
    // su "Principal" con el CTA rojo a la derecha; si el HomeRow arrancara
    // en home-1, los dos rojos quedarían en la misma columna X y se verían
    // uno arriba del otro. Arrancar en el CTA del set B lo pega al borde
    // izquierdo del viewport, con "Atención 24/7" a su derecha — misma
    // información visual, desalineado.
    const initialPosition = () => {
      const t = trackRef.current
      if (!t) return
      const ctas = t.querySelectorAll<HTMLElement>('.cf-catalog-cta-slide')
      // El primero es set A, el segundo set B — arrancamos en el segundo
      // (o en el primero como fallback si sólo hay uno por alguna razón).
      const ctaB = ctas[1] ?? ctas[0]
      if (ctaB) t.scrollLeft = ctaB.offsetLeft
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
          <Fragment key={`a-${s.key}`}>
            {s.slide_key === 'home-2' && (
              <CatalogCtaSlide
                key="a-catalog-cta"
                onVerCatalogo={onVerCatalogo}
              />
            )}
            <HomeRowSlide slide={s} onVerCatalogo={onVerCatalogo} />
          </Fragment>
        ))}
        {slides.map((s) => (
          <Fragment key={`b-${s.key}`}>
            {s.slide_key === 'home-2' && (
              <CatalogCtaSlide
                key="b-catalog-cta"
                onVerCatalogo={onVerCatalogo}
              />
            )}
            <HomeRowSlide slide={s} onVerCatalogo={onVerCatalogo} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}
