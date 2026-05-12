'use client'

/**
 * components/marca-landing/Reveal.tsx
 *
 * Wrapper liviano de scroll-reveal. Pone data-revealed="true" cuando el
 * elemento entra al viewport. Los estilos de transición viven en el
 * CSS module (.cf-ml-reveal[data-revealed="true"]).
 */

import { useEffect, useRef, useState } from 'react'

type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'fade'

interface RevealProps {
  children: React.ReactNode
  /** Delay en ms antes de revelar (para staggers). */
  delay?: number
  /** className extra del consumidor (compone con la clase reveal del module). */
  className?: string
  /** Tag HTML del wrapper. Default: div. */
  as?: 'div' | 'section' | 'article'
  /** id para anclas. */
  id?: string
  /** Tipo de animación de entrada. Default 'up' (slide up + fade). */
  variant?: RevealVariant
}

export default function Reveal({
  children,
  delay = 0,
  className,
  as = 'div',
  id,
  variant = 'up',
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (delay > 0) {
              setTimeout(() => setRevealed(true), delay)
            } else {
              setRevealed(true)
            }
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [delay])

  const Tag = as as 'div'
  return (
    <Tag
      ref={ref as React.RefObject<HTMLDivElement>}
      id={id}
      className={className}
      data-revealed={revealed ? 'true' : 'false'}
      data-reveal-variant={variant}
    >
      {children}
    </Tag>
  )
}
