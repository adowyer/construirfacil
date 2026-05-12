'use client'

import type { MarcaFeaturesContent } from '@/lib/content/marca-landing/types'
import {
  Layers,
  Box,
  Maximize,
  Target,
  Zap,
  Move,
  Leaf,
  TrendingUp,
} from 'lucide-react'
import Reveal from './Reveal'
import { useParallax } from './useParallax'
import styles from './landing.module.css'

interface FeaturesProps {
  content: MarcaFeaturesContent
}

const icons = [
  Layers,
  Box,
  Maximize,
  Target,
  Zap,
  Move,
  Leaf,
  TrendingUp,
]

const bgs = [
  '/terra.jpg',
  null,
  null,
  '/atlas.jpg',
  null,
  null,
  '/bosque.jpg',
  null,
]

export default function Features({ content }: FeaturesProps) {
  return (
    <section className={styles.featuresBento} id="features">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <linearGradient id="lucideGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff9933" />
            <stop offset="100%" stopColor="#4CAF50" />
          </linearGradient>
        </defs>
      </svg>

      <div className={styles.featuresBentoInner}>
        <Reveal className={styles.featuresBentoHeader}>
          <span className={styles.eyebrowLight}>{content.eyebrow}</span>
          <h2 className={styles.featuresBentoTitle}>{content.title}</h2>
          {content.intro && <p className={styles.featuresBentoIntro}>{content.intro}</p>}
        </Reveal>

        <div className={styles.featuresBentoRows}>
          {[
            content.items.slice(0, 3), 
            content.items.slice(3, 6), 
            content.items.slice(6, 8), 
          ].map((rowItems, rowIndex) => (
            <div key={rowIndex} className={styles.bentoRow}>
              {rowItems.map((item, colIndex) => {
                const i = rowIndex === 0 ? colIndex : rowIndex === 1 ? colIndex + 3 : colIndex + 6
                const Icon = icons[i] || Box
                const isDefaultWide = i === 0 || i === 4 || i === 6 || i === 7
                
                // Variamos el factor de parallax según la posición para que "floten" distinto
                const parallaxFactor = (i % 3) * 0.05 + 0.05

                return (
                  <Reveal 
                    key={item.title} 
                    className={`${styles.bentoCard} ${isDefaultWide ? styles.bentoCardWide : ''}`}
                    delay={i * 100}
                    variant="up"
                  >
                    <BentoCardContent item={item} Icon={Icon} factor={parallaxFactor} />
                  </Reveal>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function BentoCardContent({ item, Icon, factor }: { item: any, Icon: any, factor: number }) {
  const { ref, offset } = useParallax<HTMLDivElement>(factor)
  
  return (
    <div className={styles.bentoCardInner} ref={ref} style={{ transform: `translateY(${offset}px)` }}>
      <div className={styles.bentoCardHeader}>
        <div className={styles.bentoIconDynamic}>
          <Icon stroke="url(#lucideGradient)" strokeWidth={1.5} size={36} />
        </div>
        <h3 className={styles.bentoCardTitle}>
          {item.title}
        </h3>
      </div>
      <p className={styles.bentoCardBody}>
        {item.body}
      </p>
    </div>
  )
}
