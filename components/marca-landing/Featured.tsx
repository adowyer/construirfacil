'use client'

/**
 * components/marca-landing/Featured.tsx
 *
 * Slider horizontal scroll-driven estilo catálogo expandido.
 */

import { useEffect, useRef, useState } from 'react'
import type { MarcaFeaturedContent } from '@/lib/content/marca-landing/types'
import type { CatalogModel } from '@/lib/supabase/queries/catalog_grouped'
import { displayLinea } from '@/lib/supabase/queries/catalog_grouped'
import styles from './landing.module.css'

interface FeaturedProps {
  content: MarcaFeaturedContent
  models: CatalogModel[]
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

/** Previene que paths locales del disco (/Users/...) se cuelen en la web */
function safeWebUrl(url: string | undefined | null): string | null {
  if (!url) return null
  if (url.startsWith('/Users/') || url.startsWith('/home/') || url.startsWith('/var/') || url.startsWith('/tmp/')) {
    return null
  }
  if (url.startsWith('/') || url.startsWith('http') || url.startsWith('data:')) {
    return url
  }
  return null
}

export default function Featured({ content, models }: FeaturedProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const [translate, setTranslate] = useState(0)

  // Tomamos los 3 primeros modelos para el slider.
  const items = models.slice(0, 3)

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
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [items.length])

  return (
    <section
      ref={sectionRef}
      className={styles.featuredHoriz}
      id="modelos"
      style={{ height: '280vh' }}
    >
      <div className={styles.featuredHorizPin}>
        <div
          ref={railRef}
          className={styles.featuredHorizRail}
          style={{ transform: `translate3d(-${translate}px, 0, 0)` }}
        >
          {/* Slide 0: texto editorial */}
          <div
            className={`${styles.featuredHorizSlide} ${styles.featuredHorizText}`}
          >
            <span className={styles.eyebrow}>{content.eyebrow}</span>
            <h2 className={styles.featuredHorizTitle}>{content.title}</h2>
            {content.intro && (
              <p className={styles.featuredHorizIntro}>{content.intro}</p>
            )}
          </div>

          {/* Cards de modelos — foto full-card con overlay encima */}
          {items.map((m, i) => {
            const bgTranslateX = (translate * 0.12) % 60
            
            return (
              <a
                key={m.group_slug}
                href={`/catalogo?modelo=${encodeURIComponent(m.group_slug)}`}
                className={`${styles.featuredHorizSlide} ${styles.featuredHorizCard}`}
                style={{
                  backgroundColor: m.cover_url
                    ? undefined
                    : m.lqip_color ?? '#dcdcd6',
                  overflow: 'hidden'
                }}
              >
                {safeWebUrl(m.cover_url) && (
                  <div 
                    className={styles.featuredHorizCardBg}
                    style={{ 
                      backgroundImage: `url('${safeWebUrl(m.cover_url)}')`,
                      transform: `scale(1.18) translateX(${bgTranslateX}px)`
                    }}
                  />
                )}
                <div className={styles.featuredHorizCardOverlay}>
                  <div className={styles.featuredHorizCardTop}>
                    <span className={styles.featuredHorizCardLinea}>
                      {displayLinea(m.linea)}
                    </span>
                    {m.tipologia_code && (
                      <span className={styles.featuredHorizCardTipo}>
                        Tipología {m.tipologia_code}
                      </span>
                    )}
                  </div>
                  <div className={styles.featuredHorizCardBottom}>
                    <h3 className={styles.featuredHorizCardName}>
                      {m.display_name}
                    </h3>
                    <div className={styles.featuredHorizCardSpecs}>
                      {formatBeds(m.beds_min, m.beds_max) && (
                        <span>{formatBeds(m.beds_min, m.beds_max)}</span>
                      )}
                      {formatArea(m.area_min, m.area_max) && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{formatArea(m.area_min, m.area_max)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            )
          })}

          {/* Slide final: pill grande "Ver todo el catálogo" */}
          <div
            className={`${styles.featuredHorizSlide} ${styles.featuredHorizCtaSlide}`}
          >
            <a
              href={content.ctaAll.href}
              className={styles.featuredHorizCtaPill}
            >
              <span className={styles.featuredHorizCtaEyebrow}>
                Y mucho más
              </span>
              <span className={styles.featuredHorizCtaLabel}>
                {content.ctaAll.label}
              </span>
              <span aria-hidden className={styles.featuredHorizCtaArrow}>
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
