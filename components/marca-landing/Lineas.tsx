/**
 * components/marca-landing/Lineas.tsx
 *
 * Tres líneas comerciales (Atlas / Bosque / Terra) en cards grandes
 * con imagen full y label encima. Click → catálogo filtrado.
 */

import type { MarcaLineasContent } from '@/lib/content/marca-landing/types'
import Reveal from './Reveal'
import styles from './landing.module.css'

interface LineasProps {
  content: MarcaLineasContent
}

export default function Lineas({ content }: LineasProps) {
  return (
    <section className={styles.lineas} id="lineas">
      <Reveal className={styles.lineasHeader}>
        <span className={styles.eyebrow}>{content.eyebrow}</span>
        <h2 className={styles.sectionTitle}>{content.title}</h2>
        {content.intro && (
          <p className={styles.sectionIntro}>{content.intro}</p>
        )}
      </Reveal>

      <div className={styles.lineasGrid}>
        {content.items.map((item, i) => (
          <Reveal
            key={item.slug}
            className={styles.lineaCardWrap}
            delay={i * 90}
          >
            <a className={styles.lineaCard} href={item.href}>
              <div
                className={styles.lineaImage}
                style={{ backgroundImage: `url('${item.image}')` }}
                aria-hidden="true"
              />
              <div className={styles.lineaOverlay} aria-hidden="true" />
              <div className={styles.lineaBody}>
                <h3 className={styles.lineaLabel}>{item.label}</h3>
                <p className={styles.lineaTagline}>{item.tagline}</p>
                <span className={styles.lineaArrow} aria-hidden="true">
                  Ver línea →
                </span>
              </div>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
