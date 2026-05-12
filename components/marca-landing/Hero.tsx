'use client'

/**
 * components/marca-landing/Hero.tsx
 *
 * Hero cinematográfico full-bleed.
 * Fondo con efecto parallax, eyebrow + headline gigante brutalista
 * + sub + CTAs con diseño ultra-premium.
 */

import { useState, useEffect } from 'react'
import type { MarcaHeroContent } from '@/lib/content/marca-landing/types'
import RotatingWord from './RotatingWord'
import styles from './landing.module.css'

interface HeroProps {
  content: MarcaHeroContent
}
export default function Hero({ content }: HeroProps) {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <section className={styles.heroParallax}>
      <div className={styles.heroParallaxBgWrap}>
        <div
          className={styles.heroParallaxBg}
          style={{ 
            backgroundImage: `url('${content.backgroundImage}')`,
            transform: `translateY(${scrollY * 0.4}px)` 
          }}
          aria-hidden="true"
        />
        <div className={styles.heroParallaxOverlay} aria-hidden="true" />
      </div>

      <div 
        className={styles.heroParallaxContentWrap}
        style={{ transform: `translateY(${scrollY * -0.1}px)` }}
      >
        <div className={styles.heroParallaxContent}>
          {content.eyebrow && (
            <span className={styles.eyebrowLight}>{content.eyebrow}</span>
          )}
          <h1 className={styles.heroParallaxHeadline}>
            {content.headline}
            {content.rotatingSuffix && content.rotatingSuffix.length > 0 && (
              <>
                <br />
                <span className={styles.heroParallaxAccent}>más </span>
                <span className={styles.heroParallaxAccent}>
                  <RotatingWord words={content.rotatingSuffix} intervalMs={1000} />
                </span>
              </>
            )}
          </h1>
          {content.subheadline && (
            <p className={styles.heroParallaxSub}>{content.subheadline}</p>
          )}

          <div className={styles.heroParallaxCtas}>
            <a className={styles.btnPrimaryParallax} href={content.ctaPrimary.href}>
              {content.ctaPrimary.label}
            </a>
            {content.ctaSecondary && (
              <a className={styles.btnGhostParallax} href={content.ctaSecondary.href}>
                {content.ctaSecondary.label}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
