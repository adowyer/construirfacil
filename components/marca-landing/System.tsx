/**
 * components/marca-landing/System.tsx
 *
 * Sección oscura con el sistema constructivo (Flex Build Suit).
 * Imagen técnica + 8 atributos en grid.
 */

import type { MarcaSystemContent } from '@/lib/content/marca-landing/types'
import Reveal from './Reveal'
import styles from './landing.module.css'

interface SystemProps {
  content: MarcaSystemContent
}

export default function System({ content }: SystemProps) {
  return (
    <section className={styles.system} id="sistema">
      <Reveal className={styles.systemHeader}>
        <span className={styles.eyebrowLight}>{content.eyebrow}</span>
        <h2 className={styles.systemTitle}>{content.title}</h2>
        <p className={styles.systemIntro}>{content.intro}</p>
      </Reveal>

      {content.image && (
        <Reveal className={styles.systemImageWrap} delay={120}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.systemImage}
            src={content.image}
            alt={content.title}
            loading="lazy"
          />
        </Reveal>
      )}

      <div className={styles.systemAttrs}>
        {content.attributes.map((attr, i) => (
          <Reveal
            key={attr.label}
            className={styles.systemAttr}
            delay={i * 60}
          >
            <span className={styles.systemAttrIndex}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className={styles.systemAttrLabel}>{attr.label}</h3>
            {attr.body && (
              <p className={styles.systemAttrBody}>{attr.body}</p>
            )}
          </Reveal>
        ))}
      </div>
    </section>
  )
}
