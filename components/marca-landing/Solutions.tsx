/**
 * components/marca-landing/Solutions.tsx
 *
 * Tres formatos de producto (Smart Box / Smart House / Smart Build)
 * en cards verticales con foto encima.
 */

import type { MarcaSolutionsContent } from '@/lib/content/marca-landing/types'
import Reveal from './Reveal'
import styles from './landing.module.css'

interface SolutionsProps {
  content: MarcaSolutionsContent
}

export default function Solutions({ content }: SolutionsProps) {
  return (
    <section className={styles.solutions} id="soluciones">
      <Reveal className={styles.solutionsHeader}>
        <span className={styles.eyebrow}>{content.eyebrow}</span>
        {content.title && (
          <h2 className={styles.sectionTitle}>{content.title}</h2>
        )}
        {content.intro && (
          <p className={styles.sectionIntro}>{content.intro}</p>
        )}
      </Reveal>

      <div className={styles.solutionsGrid}>
        {content.items.map((item, i) => (
          <Reveal
            key={item.key}
            className={styles.solutionCard}
            delay={i * 100}
            as="article"
          >
            {item.image && (
              <div className={styles.solutionImageWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.solutionImage}
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                />
              </div>
            )}
            <div className={styles.solutionBody}>
              <span className={styles.solutionIndex}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className={styles.solutionTitle}>{item.title}</h3>
              <p className={styles.solutionTagline}>{item.tagline}</p>
              <p className={styles.solutionText}>{item.body}</p>
              {item.cta && (
                <a className={styles.solutionCta} href={item.cta.href}>
                  {item.cta.label}
                  <span aria-hidden="true">→</span>
                </a>
              )}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
