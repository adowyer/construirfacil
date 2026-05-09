/**
 * components/marca-landing/Manifesto.tsx
 *
 * Bloque editorial centrado. Tipografía protagonista, mucho aire,
 * imagen de apoyo a la derecha (mobile: arriba).
 */

import type { MarcaManifestoContent } from '@/lib/content/marca-landing/types'
import Reveal from './Reveal'
import styles from './landing.module.css'

interface ManifestoProps {
  content: MarcaManifestoContent
}

export default function Manifesto({ content }: ManifestoProps) {
  return (
    <section className={styles.manifesto} id="manifiesto">
      <Reveal className={styles.manifestoInner}>
        <div className={styles.manifestoText}>
          {content.eyebrow && (
            <span className={styles.eyebrow}>{content.eyebrow}</span>
          )}
          <h2 className={styles.manifestoTitle}>{content.title}</h2>
          <p className={styles.manifestoBody}>{content.body}</p>
        </div>
        <div className={styles.manifestoImageWrap}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.manifestoImage}
            src={content.image}
            alt={content.title}
            loading="lazy"
          />
        </div>
      </Reveal>
    </section>
  )
}
