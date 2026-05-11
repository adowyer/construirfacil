/**
 * lib/hooks/useInViewport.ts
 *
 * Hook que usa IntersectionObserver para reportar si un elemento está
 * actualmente intersectando el viewport (o un root opcional). Usado por
 * componentes animados (marquees, cross-fades) para pausar el trabajo
 * cuando el elemento no se ve y así reducir CPU/GPU.
 *
 * Convención: por defecto consideramos "in view" cuando hay >= 0.01 de
 * intersección, así un marquee muy alto pero apenas asomando sigue
 * animando. Si querés pausar solo cuando esté totalmente fuera, podés
 * pasarle `threshold: 0`.
 */

import { useEffect, useRef, useState } from 'react'

interface Options {
  /** Mínimo de intersección para considerar "in view". Default 0.01. */
  threshold?: number
  /** Margen extra alrededor del root antes de disparar. Default '0px'. */
  rootMargin?: string
  /** Valor inicial — útil para SSR / primer render. Default true (para que
   *  no parpadee on/off al montar y haya menos flash de pausa). */
  initialInView?: boolean
}

export function useInViewport<T extends Element>(opts: Options = {}) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(opts.initialInView ?? true)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // IntersectionObserver no existe en muy viejos browsers/SSR — fallback
    // a "siempre in view" para no romper la animación.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      {
        threshold: opts.threshold ?? 0.01,
        rootMargin: opts.rootMargin ?? '0px',
      },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [opts.threshold, opts.rootMargin])

  return { ref, inView }
}
