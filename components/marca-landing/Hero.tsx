/**
 * components/marca-landing/Hero.tsx
 *
 * Hero cinematográfico full-bleed. Foto de fondo, eyebrow + headline
 * gigante + sub + CTAs duales. Indicador de scroll abajo.
 */

import type { MarcaHeroContent } from '@/lib/content/marca-landing/types'
import styles from './landing.module.css'

interface HeroProps {
  content: MarcaHeroContent
}

export default function Hero({ content }: HeroProps) {
  return (
    <section className={styles.hero}>
      <div
        className={styles.heroBg}
        style={{ backgroundImage: `url('${content.backgroundImage}')` }}
        aria-hidden="true"
      />
      <div className={styles.heroOverlay} aria-hidden="true" />

      <div className={styles.heroContent}>
        {content.eyebrow && (
          <span className={styles.heroEyebrow}>{content.eyebrow}</span>
        )}
        <h1 className={styles.heroHeadline}>{content.headline}</h1>
        {content.subheadline && (
          <p className={styles.heroSub}>{content.subheadline}</p>
        )}

        <div className={styles.heroCtas}>
          <a className={styles.btnPrimary} href={content.ctaPrimary.href}>
            {content.ctaPrimary.label}
            <span aria-hidden="true">→</span>
          </a>
          {content.ctaSecondary && (
            <a className={styles.btnGhost} href={content.ctaSecondary.href}>
              {content.ctaSecondary.label}
              <span aria-hidden="true">↓</span>
            </a>
          )}
        </div>
      </div>

      <div className={styles.heroScrollHint} aria-hidden="true">
        <span>Scroll</span>
        <span className={styles.heroScrollLine} />
      </div>
    </section>
  )
}
