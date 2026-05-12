'use client'

/**
 * components/marca-landing/VideoStory.tsx
 *
 * Scroll storytelling tipo Apple Performance — SVG text mask reveal.
 *
 *   Capas (z-index ascendente):
 *     1. Section background: NEGRO siempre.
 *     2. Video iframe full-bleed (fade-out durante handoff).
 *     3. SVG mask: rect negro con texto-agujero. El texto escala 60→1.
 *        Fade-out durante el handoff.
 *     4. SVG con texto sólido blanco (mismo viewBox, misma posición, mismo
 *        tamaño que el mask al final del zoom) → cross-fade perfecto.
 *     5. Accent naranja debajo del título.
 *     6. Body copy más abajo.
 *
 *   Resultado: el user ve UN SOLO texto que pasa de "agujero con video" a
 *   "texto sólido blanco sobre negro". Como en Apple Performance.
 *
 * Fases:
 *   0.00 – 0.30  Mask zoom 60→1 (easeOutCubic). Video full.
 *   0.30 – 0.40  Cross-fade: mask + video fade-out, texto sólido fade-in.
 *   0.40 – 0.60  Accent naranja slide-up + fade.
 *   0.60 – 0.80  Body copy slide-up + fade.
 *   0.80 – 1.00  Estable.
 */

import { useEffect, useRef, useState } from 'react'
import type { MarcaVideoContent } from '@/lib/content/marca-landing/types'
import styles from './landing.module.css'

interface VideoStoryProps {
  content: MarcaVideoContent
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)

export default function VideoStory({ content }: VideoStoryProps) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const s = sectionRef.current
      if (!s) return
      const rect = s.getBoundingClientRect()
      const vh = window.innerHeight
      const total = rect.height - vh
      if (total <= 0) return
      setProgress(clamp01(-rect.top / total))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // Buffer inicial (0-18%): solo video, sin máscara — el user puede
  // admirar el video antes de que cualquier texto aparezca.
  const phaseIntro = clamp01((progress - 0.18) / 0.10) // 18–28%: mask fade-in
  const phaseZoom = easeOutCubic(clamp01((progress - 0.24) / 0.22)) // 24–46%
  const phaseHandoff = clamp01((progress - 0.46) / 0.10) // 46–56%
  const phaseAccent = clamp01((progress - 0.58) / 0.14) // 58–72%
  const phaseBody = clamp01((progress - 0.72) / 0.16) // 72–88%

  // Mask scale: arranca grande para ver el video casi entero, escala a 1.
  const maskScale = lerp(60, 1, phaseZoom)

  // Mask rect opacity — el video se ve completo cuando es 0; cuando llega
  // a 1 la máscara cubre toda la pantalla (excepto el agujero del texto).
  const maskRectOpacity = phaseIntro

  // Cross-fade: cuando termina el zoom, el texto-agujero (negro) se vuelve
  // invisible y el texto sólido blanco aparece en el MISMO lugar y tamaño.
  // Parece que las letras pasan de "video adentro" a "blanco sólido".
  const maskTextOpacity = 1 - phaseHandoff
  const titleOpacity = phaseHandoff

  // Accent + body — slide-up + fade.
  const accentOpacity = phaseAccent
  const accentY = lerp(28, 0, phaseAccent)
  const bodyOpacity = phaseBody
  const bodyY = lerp(40, 0, phaseBody)

  const story = content.story
  if (!story) return null

  return (
    <section
      ref={sectionRef}
      className={styles.videoStory}
      id="video"
      style={{ height: '450vh' }}
    >
      <div className={styles.videoStoryPin}>
        {/* Capa 1: video MP4 local, autoplay/loop/muted. Más liviano que
            iframe YouTube y permite control directo de play/pause.
            Tiene un overlay con gradient sutil estilo Hero — suaviza
            colores planos del video y le da peso editorial. */}
        <div className={styles.videoStoryVideo}>
          <video
            className={styles.videoStoryFrame}
            src="/Wooden-Modular-House-Timelapse.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className={styles.videoStoryVideoOverlay} aria-hidden="true" />
        </div>

        {/* Capa 2: SVG mask. El <rect> negro cubre todo el viewport y
            usa este mask para perforar el agujero del texto. La
            opacity del SVG entero es siempre 1 — el "cierre" del
            agujero se logra animando la opacity DEL TEXT dentro del
            mask (1 = perfora; 0 = no perfora → mask todo blanco → rect
            negro cubre todo, incluido el video que sigue corriendo). */}
        <svg
          className={styles.videoStoryMask}
          style={{ opacity: maskRectOpacity }}
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <mask id="storyMask" maskUnits="userSpaceOnUse">
              <rect x="0" y="0" width="1920" height="1080" fill="white" />
              <text
                x="960"
                y="460"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="black"
                fontSize="110"
                fontWeight="700"
                letterSpacing="-3"
                opacity={maskTextOpacity}
                style={{
                  fontFamily: 'inherit',
                  transform: `scale(${maskScale})`,
                  transformOrigin: '960px 460px',
                  transformBox: 'view-box',
                }}
              >
                {story.title}
              </text>
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="1920"
            height="1080"
            fill="#000"
            mask="url(#storyMask)"
          />
        </svg>

        {/* Capa 4: SVG con texto sólido. Title + accent en MISMO viewBox
            y MISMO fontSize → tienen exactamente el mismo tamaño visual.
            El cross-fade title aparece sincronizado con la salida del
            mask. El accent entra después (otro fade + slide-up). */}
        {/* Cuando aparece el body, el bloque title+accent sube un poco
            para que la composición final quede centrada verticalmente. */}
        <svg
          className={styles.videoStoryTextSolid}
          viewBox="0 0 1920 1080"
          preserveAspectRatio="xMidYMid slice"
          style={{ transform: `translateY(${-120 * phaseBody}px)` }}
          aria-hidden="true"
        >
          {/* Title — mismo y/fontSize/letterSpacing que el text del mask
              en scale 1 → cross-fade perfecto. */}
          <text
            x="960"
            y="460"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize="110"
            fontWeight="700"
            letterSpacing="-3"
            opacity={titleOpacity}
            style={{ fontFamily: 'inherit' }}
          >
            {story.title}
          </text>
          {/* Accent en naranja, debajo del title (offset ~130 unidades).
              Mismo fontSize que el title — tamaño visual idéntico. */}
          <text
            x="960"
            y="590"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ff9933"
            fontSize="110"
            fontWeight="700"
            letterSpacing="-3"
            opacity={accentOpacity}
            style={{
              fontFamily: 'inherit',
              transform: `translateY(${accentY * 0.4}px)`,
              transformBox: 'view-box',
              transformOrigin: '960px 590px',
            }}
          >
            {story.accent}
          </text>
        </svg>

        {/* Body como HTML normal, debajo de los textos SVG. */}
        <div className={styles.videoStoryExtras} aria-hidden={progress < 0.6}>
          <p
            className={styles.videoStoryBody}
            style={{
              opacity: bodyOpacity,
              transform: `translateY(${bodyY}px)`,
            }}
          >
            {story.body}
          </p>
        </div>

        {/* H1 accesible — para screen readers y SEO, sin afectar visual. */}
        <h2 className={styles.visuallyHidden}>
          {story.title} {story.accent}
        </h2>
      </div>
    </section>
  )
}
