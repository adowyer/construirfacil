'use client'

import { useRef, useEffect, useState } from 'react'
import type { MarcaVideoContent } from '@/lib/content/marca-landing/types'
import styles from './landing.module.css'

interface VideoProps {
  content: MarcaVideoContent
}

export default function Video({ content }: VideoProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(100)
  const [opacityPart2, setOpacityPart2] = useState(0)
  const [opacityCopy, setOpacityCopy] = useState(0)
  const [maskAlpha, setMaskAlpha] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return
      
      const rect = containerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const totalHeight = rect.height
      
      let progress = -rect.top / (totalHeight - viewportHeight)
      progress = Math.max(0, Math.min(1, progress))
      
      // Fase 0: Fade in de la máscara (0 a 0.05)
      if (progress < 0.05) {
        setMaskAlpha(progress / 0.05)
      } else {
        setMaskAlpha(1)
      }

      // Fase 1: Zoom out (0 a 0.3) - Más rápido
      const phase1 = Math.min(1, progress / 0.3)
      const easeOut = 1 - Math.pow(1 - phase1, 3) 
      setScale(100 - (99 * easeOut))

      // Fase 2: "se fabrican." (0.35 a 0.5)
      if (progress > 0.35) {
        const p2 = Math.min(1, (progress - 0.35) / 0.15)
        setOpacityPart2(p2)
      } else {
        setOpacityPart2(0)
      }

      // Fase 3: Copy (0.5 a 0.65)
      if (progress > 0.5) {
        const p3 = Math.min(1, (progress - 0.5) / 0.15)
        setOpacityCopy(p3)
      } else {
        setOpacityCopy(0)
      }

      // Nueva Fase: Desvanecer la máscara una vez que el zoom termina (0.3 a 0.4)
      if (progress > 0.3) {
        const fadeOut = Math.max(0, 1 - (progress - 0.3) / 0.1)
        setMaskAlpha(fadeOut)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Modestbranding y controls=0. El scale(1.3) vía CSS va a esconder los títulos que YouTube inyecta en los bordes.
  const embedUrl = `https://www.youtube-nocookie.com/embed/${content.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${content.youtubeId}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`

  return (
    <section className={styles.videoZoomSection} id="video" ref={containerRef}>
      <div className={styles.videoZoomSticky}>
        
        <div className={styles.videoZoomFrameWrap}>
          <iframe
            className={styles.videoZoomFrame}
            src={embedUrl}
            title={content.title ?? 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            style={{ pointerEvents: 'none' }}
          />

          {/* Máscara SVG: La forma más robusta de hacer huecos sobre video */}
          <svg className={styles.videoZoomSvgMask} viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
            <defs>
              <mask id="holeMask">
                <rect x="0" y="0" width="1000" height="1000" fill="white" />
                <text 
                  x="500" y="500" 
                  textAnchor="middle" 
                  fill="black"
                  style={{ 
                    fontSize: '45px', 
                    fontWeight: '900', 
                    transform: `scale(${scale})`, 
                    transformOrigin: 'center' 
                  }}
                >
                  <tspan x="500" dy="-0.6em">Casas que</tspan>
                  <tspan x="500" dy="1.1em">no se</tspan>
                  <tspan x="500" dy="1.1em">construyen,</tspan>
                </text>
              </mask>
            </defs>
            <rect x="0" y="0" width="1000" height="1000" fill="black" mask="url(#holeMask)" style={{ opacity: maskAlpha }} />
          </svg>
        </div>

        {/* Capa Overlay (Z-index 10) para "se fabrican." y el copy */}
        <div className={styles.videoZoomOverlayContent}>
          <div className={styles.videoZoomFinalTextWrap}>
            {/* El título principal se repite aquí de forma estática para mantener la estructura */}
            {/* Solo se vuelve visible cuando el zoom termina */}
            <h2 
              className={styles.videoZoomTextCentered}
              style={{ opacity: scale < 1.5 ? 1 : 0 }}
            >
              Casas que no se construyen,
            </h2>
            
            <h3 
              className={styles.videoZoomTextSecondPart} 
              style={{ 
                opacity: opacityPart2, 
                transform: `translateY(${(1 - opacityPart2) * 20}px)`,
                display: opacityPart2 > 0 ? 'block' : 'none'
              }}
            >
              se fabrican.
            </h3>

            <div 
              className={styles.videoZoomOverlayIntro}
              style={{ 
                opacity: opacityCopy,
                transform: `translateY(${(1 - opacityCopy) * 20}px)`,
                display: opacityCopy > 0 ? 'block' : 'none'
              }}
            >
              {content.intro}
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
