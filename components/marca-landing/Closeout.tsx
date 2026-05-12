'use client'

/**
 * components/marca-landing/Closeout.tsx
 *
 * Sección de cierre con dos CTAs: B2C primario (catálogo) y B2B
 * secundario (mailto). Título con parallax sutil.
 */

import type { MarcaCloseoutContent } from '@/lib/content/marca-landing/types'
import Reveal from './Reveal'
import { useParallax } from './useParallax'
import styles from './landing.module.css'

interface CloseoutProps {
  content: MarcaCloseoutContent
}

export default function Closeout({ content }: CloseoutProps) {
  const { ref: titleRef, offset: titleOffset } =
    useParallax<HTMLHeadingElement>(0.12)

  return (
    <section className={styles.closeout} id="contacto">
      <Reveal className={styles.closeoutInner}>
        <h2
          ref={titleRef}
          className={styles.closeoutTitle}
          style={{ transform: `translateY(${titleOffset}px)` }}
        >
          {content.title}
        </h2>
        {content.body && (
          <p className={styles.closeoutBody}>{content.body}</p>
        )}
        <div className={styles.closeoutCtas}>
          <a className={styles.btnPrimaryDark} href={content.ctaB2C.href}>
            {content.ctaB2C.label}
            <span aria-hidden="true">→</span>
          </a>
          <a className={styles.btnGhostDark} href={content.ctaB2B.href}>
            {content.ctaB2B.label}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </Reveal>
    </section>
  )
}
