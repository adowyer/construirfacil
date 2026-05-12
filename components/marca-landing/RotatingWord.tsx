'use client'

/**
 * components/marca-landing/RotatingWord.tsx
 *
 * Cicla por una lista de palabras con cross-fade vertical. Se usa en el
 * Hero al final del headline para crear movimiento ("Construir más rápido
 * / más eficiente / más rentable / más inteligente"). Color amarillo CF.
 *
 * Strategy: reservamos el ancho de la palabra más larga para evitar
 * reflow del título cuando rota.
 */

import { useEffect, useState } from 'react'
import styles from './landing.module.css'

interface RotatingWordProps {
  words: string[]
  intervalMs?: number
}

export default function RotatingWord({
  words,
  intervalMs = 1500,
}: RotatingWordProps) {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (words.length <= 1) return
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % words.length)
    }, intervalMs)
    return () => clearInterval(id)
  }, [words.length, intervalMs])

  if (words.length === 0) return null

  // Calcula la palabra más larga para reservar ancho — el headline no
  // hace reflow horizontal al cambiar de palabra.
  const longest = words.reduce((a, b) => (a.length >= b.length ? a : b))

  return (
    <span className={styles.rotatingWord} aria-live="polite">
      {/* Ghost: marca el ancho de la palabra más larga, invisible. */}
      <span className={styles.rotatingWordGhost} aria-hidden="true">
        {longest}
      </span>
      {words.map((w, i) => (
        <span
          key={w}
          className={`${styles.rotatingWordSlot} ${i === idx ? styles.rotatingWordSlotActive : ''}`}
          aria-hidden={i !== idx}
        >
          {w}
        </span>
      ))}
    </span>
  )
}
