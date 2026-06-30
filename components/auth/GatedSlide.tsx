'use client'

/**
 * components/auth/GatedSlide.tsx
 *
 * Wrapper para slides técnicos/sensibles (Planos, Axos, Tipología,
 * Comparativo, Equipamiento, Datos) que deben quedar gateados para
 * visitantes NO identificados.
 *
 * Comportamiento:
 *   - Identified → renderiza children normal.
 *   - NO identified → renderiza children con blur + overlay con CTA
 *     que dispara `onGateRequired` (CatalogPage abre el modal del gate).
 *
 * El blur (vs ocultar) genera FOMO: el visitante VE que hay contenido
 * y se motiva a registrarse en vez de irse.
 */

import type { ReactNode } from 'react'
import { useClientIdentified } from '@/lib/auth/use-client-identified'

interface GatedSlideProps {
  children: ReactNode
  /** Texto del overlay — describe brevemente QUÉ se desbloquea.
   *  Ej: "Registrate para ver los Planos arquitectónicos". */
  teaser: string
  /** Callback que dispara el modal del gate. Lo provee CatalogPage. */
  onGateRequired?: () => void
  /** Hint SSR del estado de identidad. Si llega `true`, evitamos el
   *  flicker del primer paint cliente (que arranca con cached=false hasta
   *  que /api/client-status responda). Si llega undefined o false, el
   *  hook decide. */
  ssrIdentified?: boolean
}

export default function GatedSlide({
  children,
  teaser,
  onGateRequired,
  ssrIdentified = false,
}: GatedSlideProps) {
  const { identified } = useClientIdentified()
  // OR: si SSR ya sabía que el usuario está identified, no esperamos al
  // fetch del cliente — render directo. Si no, el hook decide.
  if (ssrIdentified || identified) return <>{children}</>

  return (
    <div className="cf-gated-slide">
      {/* inert (HTML 2022) saca el subtree completo del tab order, focus
          y screen reader. Bloquea el bypass por keyboard donde el usuario
          podía tabear a CTAs invisibles debajo del overlay. */}
      <div className="cf-gated-slide-content" aria-hidden="true" inert>
        {children}
      </div>
      <div className="cf-gated-slide-overlay">
        <div className="cf-gated-slide-lock" aria-hidden="true">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <p className="cf-gated-slide-teaser">{teaser}</p>
        <button
          type="button"
          onClick={onGateRequired}
          className="cf-gated-slide-cta"
        >
          Registrarme
        </button>
        <p className="cf-gated-slide-fineprint">
          Sólo te va tomar 30 segundos. Te pedimos mail y nombre y desbloqueás toda la información de precios por localidad, planos y características técnicas.
        </p>
      </div>
    </div>
  )
}
