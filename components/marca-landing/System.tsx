'use client'

/**
 * components/marca-landing/System.tsx
 *
 * Sección Interactive Explorer (Apple-style).
 * Reemplaza al antiguo Flex Build Suit de scroll narrativo.
 * Un acordeón a la izquierda permite explorar características,
 * actualizando la imagen inmensa a la derecha.
 */

import { useState } from 'react'
import type { MarcaSystemContent } from '@/lib/content/marca-landing/types'
import TypewriterText from './TypewriterText'
import { useParallax } from './useParallax'
import styles from './landing.module.css'

interface SystemProps {
  content: MarcaSystemContent
}

export default function System({ content }: SystemProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const { ref: headerRef, offset: headerOffset } =
    useParallax<HTMLDivElement>(0.12)

  return (
    <section className={styles.explorer} id="sistema">
      <div className={styles.explorerInner}>
        <div
          ref={headerRef}
          className={styles.explorerHeader}
          style={{ transform: `translateY(${headerOffset}px)` }}
        >
          <span className={styles.eyebrowLight}>{content.eyebrow}</span>
          <h2 className={styles.explorerTitle}>
            <TypewriterText text={content.title} speedMs={75} />
          </h2>
          {content.intro && (
            <p className={styles.explorerIntro}>{content.intro}</p>
          )}
        </div>

        <div className={styles.explorerInteractiveWrap}>
          {/* Background Images Layer */}
          <div className={styles.explorerBackgrounds}>
            {content.attributes.map((attr, i) => {
              const isActive = i === activeIdx
              if (!attr.image) return null
              return (
                <div 
                  key={`img-${attr.label}`} 
                  className={`${styles.explorerBgImage} ${isActive ? styles.explorerBgActive : ''}`}
                  aria-hidden={!isActive}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={attr.image} 
                    alt={attr.label} 
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </div>
              )
            })}
            <div className={styles.explorerBgOverlay} />
          </div>

          {/* Accordion Layer (Foreground) */}
          <div className={styles.explorerAccordionWrap}>
            <div className={styles.explorerAccordion}>
              {content.attributes.map((attr, i) => {
                const isActive = i === activeIdx
                return (
                  <div 
                    key={attr.label}
                    className={`${styles.accordionItem} ${isActive ? styles.accordionItemActive : ''}`}
                  >
                    <button 
                      type="button" 
                      className={styles.accordionHeader}
                      onClick={() => setActiveIdx(i)}
                      aria-expanded={isActive}
                    >
                      <span className={styles.accordionIcon}>
                        {isActive ? '−' : '+'}
                      </span>
                      <span className={styles.accordionLabel}>{attr.label}</span>
                    </button>
                    <div className={styles.accordionBodyWrap}>
                      <div className={styles.accordionBody}>
                        <div className={styles.accordionBodyInner}>
                          {attr.body}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
