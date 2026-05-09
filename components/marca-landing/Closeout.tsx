/**
 * components/marca-landing/Closeout.tsx
 *
 * Sección de cierre con dos CTAs: B2C primario (catálogo) y B2B secundario (mailto).
 */

import type { MarcaCloseoutContent } from '@/lib/content/marca-landing/types'
import Reveal from './Reveal'
import styles from './landing.module.css'

interface CloseoutProps {
  content: MarcaCloseoutContent
}

export default function Closeout({ content }: CloseoutProps) {
  return (
    <section className={styles.closeout} id="contacto">
      <Reveal className={styles.closeoutInner}>
        <h2 className={styles.closeoutTitle}>{content.title}</h2>
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
