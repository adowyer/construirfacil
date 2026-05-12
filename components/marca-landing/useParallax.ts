'use client'

/**
 * components/marca-landing/useParallax.ts
 *
 * Hook minimal que devuelve un offset (px) según la posición del
 * elemento en el viewport. Útil para parallax sutil de títulos/textos.
 *
 *   factor 0    → sin movimiento.
 *   factor 0.1  → el elemento se mueve 10% de un viewport.
 *   factor 0.3  → el elemento se mueve 30% (más prominente).
 *
 * El offset = 0 cuando el centro del elemento está en el centro del
 * viewport; signo y magnitud van con la distancia. Aplicalo como:
 *
 *   const ref = useRef<HTMLDivElement>(null)
 *   const offset = useParallax(ref, 0.15)
 *   <div ref={ref} style={{ transform: `translateY(${offset}px)` }} />
 */

import { useEffect, useRef, useState, type RefObject } from 'react'

export function useParallax<T extends HTMLElement = HTMLElement>(
  factor = 0.15,
): { ref: RefObject<T | null>; offset: number } {
  const ref = useRef<T | null>(null)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let rafId = 0
    const update = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      // distancia del centro del elemento al centro del viewport,
      // normalizada (0 = centrado, ±1 = entrando/saliendo).
      const centerOffsetNorm =
        (rect.top + rect.height / 2 - vh / 2) / vh
      // Convertir a px: 100vh × factor sería el rango.
      const px = centerOffsetNorm * factor * vh
      setOffset(-px) // signo negativo: cuando el elemento está abajo
      // del centro (centerOffsetNorm > 0), translate UP (más lento que
      // el scroll → sensación parallax).
    }

    const onScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [factor])

  return { ref, offset }
}
