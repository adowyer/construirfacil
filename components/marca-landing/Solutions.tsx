'use client'

/**
 * components/marca-landing/Solutions.tsx
 *
 * Slider horizontal scroll-driven con casas destacadas del catálogo.
 * Replica el sizing del slide expandido del catálogo: cada card es una
 * "vista" de casa con foto exterior grande + overlay (línea, nombre,
 * medidas, tipología). Al final, pill "Ver todo el catálogo".
 *
 *   Section alta. Sticky pin 100vh. Rail horizontal que se mueve con
 *   translateX según progress vertical.
 *
 * Estrategia de imágenes:
 *   - Si `content.items[i]` provee un `image` que es URL web válida
 *     (empieza con http/https o /), se usa esa.
 *   - Sino se intenta matchear con `models[i]` (primeros 3 del catálogo)
 *     usando su cover_url.
 *   - Esto evita paths del filesystem absoluto que se rompen en el browser.
 */

import { useEffect, useRef, useState } from 'react'
import type { MarcaSolutionsContent } from '@/lib/content/marca-landing/types'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import { displayLinea } from '@/lib/supabase/queries/catalog_grouped'
import styles from './landing.module.css'

interface SolutionsProps {
  content: MarcaSolutionsContent
  /** Modelos del catálogo para tomar fotos / metadatos reales. */
  models?: CatalogModel[]
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

function formatBeds(min: number | null, max: number | null): string {
  if (min == null && max == null) return ''
  if (min == null || max == null) return `${min ?? max} dorm.`
  if (min === max) return `${min} dorm.`
  return `${min}–${max} dorm.`
}

function formatArea(min: number | null, max: number | null): string {
  if (min == null && max == null) return ''
  if (min == null || max == null) return `${min ?? max} m²`
  if (min === max) return `${min} m²`
  return `${min}–${max} m²`
}

/** Filesystem paths no funcionan en web — devuelve null si la URL no
 *  es navegable (no empieza con http/https/data o /). */
function safeWebUrl(url: string | undefined | null): string | null {
  if (!url) return null
  // Si es un path absoluto del sistema de archivos local, lo ignoramos.
  if (url.startsWith('/Users/') || url.startsWith('/home/') || url.startsWith('/var/') || url.startsWith('/tmp/')) {
    return null
  }
  // Si empieza con / (root del sitio) o http (URL externa), es válido.
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:')) {
    return url
  }
  return null
}

export default function Solutions({ content, models = [] }: SolutionsProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  // Translate base impulsado por el scroll vertical.
  const [translate, setTranslate] = useState(0)
  // Offset adicional del drag.
  const [dragOffset, setDragOffset] = useState(0)
  // Ref que espeja dragOffset — evita capturar el state viejo en
  // closures del listener.
  const dragOffsetRef = useRef(0)
  const dragRef = useRef({
    active: false,
    startX: 0,
    startOffset: 0,
    maxOffset: 0,
    moved: 0,
  })

  // Tomamos hasta 3 items. Para cada uno: intentamos resolver foto +
  // datos contra el modelo del catálogo (si está disponible).
  const cards = content.items.slice(0, 3).map((item, i) => {
    const model = models[i] // primer match por posición — pragmático
    const image =
      safeWebUrl(item.image) ?? safeWebUrl(model?.cover_url) ?? null
    return {
      key: item.key,
      title: item.title,
      tagline: item.tagline,
      body: item.body,
      image,
      lqip: model?.lqip_color ?? '#dcdcd6',
      linea: model?.linea ? displayLinea(model.linea) : item.tagline,
      tipologia: model?.tipologia_code ?? null,
      bedsLabel: model ? formatBeds(model.beds_min, model.beds_max) : '',
      areaLabel: model ? formatArea(model.area_min, model.area_max) : '',
      slug: model?.group_slug ?? null,
      cta: item.cta,
    }
  })

  useEffect(() => {
    const onScroll = () => {
      const section = sectionRef.current
      const rail = railRef.current
      if (!section || !rail) return
      const rect = section.getBoundingClientRect()
      const vh = window.innerHeight
      const totalScroll = rect.height - vh
      if (totalScroll <= 0) return
      const progress = clamp01(-rect.top / totalScroll)
      const railWidth = rail.scrollWidth
      const vw = window.innerWidth
      const horizontalDist = Math.max(0, railWidth - vw)
      setTranslate(progress * horizontalDist)
      dragRef.current.maxOffset = horizontalDist
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [cards.length])

  // Drag-to-pan: el user mantiene click y arrastra para mover el rail
  // horizontalmente sin avanzar a la siguiente sección. Listeners
  // montados UNA VEZ — usamos refs en lugar de state para evitar
  // re-montaje en cada frame (que perdía eventos).
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const onMouseDown = (e: MouseEvent) => {
      // Solo botón principal.
      if (e.button !== 0) return
      dragRef.current.active = true
      dragRef.current.startX = e.clientX
      dragRef.current.startOffset = dragOffsetRef.current
      dragRef.current.moved = 0
      rail.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return
      e.preventDefault()
      const delta = e.clientX - dragRef.current.startX
      dragRef.current.moved = Math.abs(delta)
      const next = dragRef.current.startOffset - delta
      const max = dragRef.current.maxOffset
      const clamped = Math.max(-max, Math.min(max, next))
      dragOffsetRef.current = clamped
      setDragOffset(clamped)
    }

    const onMouseUp = () => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      rail.style.cursor = 'grab'
      document.body.style.userSelect = ''
    }

    // Si el user arrastró >5px, prevenimos que el click siguiente
    // navegue al link.
    const onClickCapture = (e: MouseEvent) => {
      if (dragRef.current.moved > 5) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    rail.style.cursor = 'grab'
    rail.addEventListener('mousedown', onMouseDown)
    rail.addEventListener('click', onClickCapture, true)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      rail.removeEventListener('mousedown', onMouseDown)
      rail.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    // Mount-only: no depende de dragOffset (refs en lugar de state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Translate efectivo = base (scroll-driven) + offset (drag).
  const effectiveTranslate = Math.max(
    0,
    Math.min(dragRef.current.maxOffset || Infinity, translate + dragOffset),
  )

  return (
    <section
      ref={sectionRef}
      className={styles.solutionsSlider}
      id="soluciones"
      style={{ height: '280vh' }}
    >
      <div className={styles.solutionsSliderPin}>
        <div
          ref={railRef}
          className={styles.solutionsSliderRail}
          style={{
            transform: `translate3d(-${effectiveTranslate}px, 0, 0)`,
          }}
        >
          {/* Slide 0: texto editorial */}
          <div
            className={`${styles.solutionsSliderSlide} ${styles.solutionsSliderText}`}
          >
            <span className={styles.eyebrowLight}>{content.eyebrow}</span>
            {content.title && (
              <h2 className={styles.solutionsSliderTitle}>{content.title}</h2>
            )}
            {content.intro && (
              <p className={styles.solutionsSliderIntro}>{content.intro}</p>
            )}
          </div>

          {/* Cards con foto exterior full + overlay info estilo catálogo */}
          {cards.map((c, i) => {
            // Calculamos un factor de zoom individual basado en la posición relativa al rail
            // Queremos que haga un ligero zoom-in cuando la card está en el centro del viewport.
            // Aproximación simple: usamos el translate global para desplazar el bg.
            const bgTranslateX = (translate * 0.1) % 50 
            
            return (
              <a
                key={c.key}
                href={
                  c.slug
                    ? `/catalogo?modelo=${encodeURIComponent(c.slug)}`
                    : c.cta?.href ?? '/catalogo'
                }
                className={`${styles.solutionsSliderSlide} ${styles.solutionsSliderCard}`}
                style={{
                  backgroundColor: c.image ? undefined : c.lqip,
                  overflow: 'hidden'
                }}
              >
                {/* Capa de imagen con parallax interno */}
                {c.image && (
                  <div 
                    className={styles.solutionsSliderCardBg}
                    style={{ 
                      backgroundImage: `url('${c.image}')`,
                      transform: `scale(1.15) translateX(${bgTranslateX}px)`
                    }}
                  />
                )}
                
                <div className={styles.solutionsSliderCardOverlay}>
                <div className={styles.solutionsSliderCardTop}>
                  <span className={styles.solutionsSliderCardLinea}>
                    {c.linea}
                  </span>
                  {c.tipologia && (
                    <span className={styles.solutionsSliderCardTipo}>
                      Tipología {c.tipologia}
                    </span>
                  )}
                </div>
                <div className={styles.solutionsSliderCardBottom}>
                  <h3 className={styles.solutionsSliderCardName}>{c.title}</h3>
                  {(c.bedsLabel || c.areaLabel || c.body) && (
                    <div className={styles.solutionsSliderCardSpecs}>
                      {c.bedsLabel && <span>{c.bedsLabel}</span>}
                      {c.bedsLabel && c.areaLabel && <span aria-hidden>·</span>}
                      {c.areaLabel && <span>{c.areaLabel}</span>}
                    </div>
                  )}
                </div>
              </div>
              </a>
            )
          })}

          {/* Slide final: pill grande "Ver todo el catálogo" */}
          <div
            className={`${styles.solutionsSliderSlide} ${styles.solutionsSliderCtaSlide}`}
          >
            <a href="/catalogo" className={styles.solutionsSliderCtaPill}>
              <span className={styles.eyebrowLight}>Y mucho más</span>
              <span className={styles.solutionsSliderCtaLabel}>
                Ver todo el catálogo
              </span>
              <span aria-hidden className={styles.solutionsSliderCtaArrow}>
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
