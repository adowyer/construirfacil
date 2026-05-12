'use client'

/**
 * components/marca-landing/Manifesto.tsx
 *
 * Bloque editorial centrado. Tipografía protagonista, mucho aire,
 * imagen de apoyo a la derecha (mobile: arriba). Parallax sutil para
 * que el bloque flote ligeramente al scrollear.
 */

import type { MarcaManifestoContent } from '@/lib/content/marca-landing/types'
import Reveal from './Reveal'
import { useParallax } from './useParallax'
import styles from './landing.module.css'

interface ManifestoProps {
  content: MarcaManifestoContent
}

export default function Manifesto({ content }: ManifestoProps) {
  const { ref: textRef, offset: textOffset } =
    useParallax<HTMLDivElement>(0.1)
  const { ref: imgRef, offset: imgOffset } =
    useParallax<HTMLDivElement>(0.18)

  return (
    <section className={styles.manifesto} id="manifiesto">
      <div className={styles.manifestoInner}>
        <Reveal className={styles.manifestoText} variant="left">
          <div
            ref={textRef}
            style={{ transform: `translateY(${textOffset}px)` }}
          >
            {content.eyebrow && (
              <span className={styles.eyebrow}>{content.eyebrow}</span>
            )}
            <h2 className={styles.manifestoTitle}>{content.title}</h2>
            <p className={styles.manifestoBody}>{content.body}</p>
          </div>
        </Reveal>
        <Reveal
          className={styles.manifestoImageWrap}
          variant="right"
          delay={120}
        >
          <div
            ref={imgRef}
            style={{
              transform: `translateY(${imgOffset}px)`,
              width: '100%',
              height: '100%',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.manifestoImage}
              src={content.image}
              alt={content.title}
              loading="lazy"
            />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
