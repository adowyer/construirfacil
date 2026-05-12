'use client'

/**
 * components/marca-landing/TypewriterText.tsx
 *
 * Escribe el texto letra por letra cuando entra al viewport. Al final,
 * deja un cursor "|" titilando. La animación corre una sola vez por
 * montaje. Respeta prefers-reduced-motion (muestra el texto completo).
 */

import { useEffect, useRef, useState } from 'react'
import styles from './landing.module.css'

interface TypewriterTextProps {
  text: string
  speedMs?: number
  className?: string
}

export default function TypewriterText({
  text,
  speedMs = 70,
  className,
}: TypewriterTextProps) {
  const wrapRef = useRef<HTMLSpanElement | null>(null)
  const [shown, setShown] = useState('')
  const [started, setStarted] = useState(false)
  const done = shown.length >= text.length

  // Reduced motion: mostramos el texto completo sin animación.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) {
      setShown(text)
      setStarted(true)
    }
  }, [text])

  // Disparo al entrar en viewport.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || started) return
    if (typeof IntersectionObserver === 'undefined') {
      setStarted(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [started])

  // Tipeo letra por letra.
  useEffect(() => {
    if (!started) return
    if (shown.length >= text.length) return
    const t = window.setTimeout(() => {
      setShown(text.slice(0, shown.length + 1))
    }, speedMs)
    return () => window.clearTimeout(t)
  }, [started, shown, text, speedMs])

  return (
    <span ref={wrapRef} className={className}>
      {shown}
      <span
        className={`${styles.typewriterCursor}${done ? ` ${styles.typewriterCursorBlink}` : ''}`}
        aria-hidden="true"
      >
        |
      </span>
    </span>
  )
}
